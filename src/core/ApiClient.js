// src/core/ApiClient.js
export class ApiClient {
    constructor(baseUrl, authToken = null) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }

    async getBoard(boardId) {
        try {
            const response = await fetch(`/api/v2/moodboard/${boardId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                const payload = result.data || {};
                const state = (payload.state && typeof payload.state === 'object')
                    ? payload.state
                    : {};
                return {
                    data: {
                        ...state,
                        objects: Array.isArray(state.objects) ? state.objects : [],
                        moodboardId: payload.moodboardId || boardId,
                        name: payload.name || null,
                        description: payload.description || null,
                        settings: payload.settings || {},
                        version: payload.version || null,
                        meta: { allowEmptyLoad: true },
                    }
                };
            } else {
                throw new Error(result.message || 'Ошибка загрузки доски');
            }
        } catch (error) {
            console.warn('API: Ошибка загрузки доски, используем заглушку:', error);
            // Fallback к заглушке
            return {
                data: {
                    id: boardId,
                    name: 'Demo Board',
                    objects: []
                }
            };
        }
    }

    async saveBoard(boardId, boardData, options = {}) {
        try {
            const actionType = options?.actionType || 'command_execute';
            // Поддержка формата core.getBoardData(): { id, boardData, settings }
            const payloadBoardData = boardData && boardData.boardData ? boardData.boardData : boardData;
            const payloadSettings = boardData && boardData.settings ? boardData.settings : {};

            // Фильтруем объекты изображений и файлов - убираем избыточные данные
            const cleanedData = this._cleanObjectData(payloadBoardData);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            // 1) Метаданные moodboard (settings/name/description) сохраняем отдельно.
            // Ошибка метаданных не должна блокировать сохранение контента в истории.
            try {
                const metadataResponse = await fetch('/api/v2/moodboard/metadata/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        moodboardId: boardId,
                        name: cleanedData?.name || null,
                        description: cleanedData?.description ?? null,
                        settings: payloadSettings || {}
                    })
                });
                if (!metadataResponse.ok) {
                    console.warn(`ApiClient: metadata/save вернул HTTP ${metadataResponse.status}`);
                }
            } catch (metadataError) {
                console.warn('ApiClient: metadata/save завершился с ошибкой:', metadataError);
            }

            // 2) Контент (state) сохраняем append-only в history.
            const response = await fetch('/api/v2/moodboard/history/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    moodboardId: boardId,
                    state: cleanedData,
                    actionType
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                return {
                    success: true,
                    deduplicated: !!result.deduplicated,
                    historyVersion: result.historyVersion,
                    moodboardId: result.moodboardId || boardId,
                    data: result
                };
            } else {
                throw new Error(result.message || 'Ошибка сохранения истории moodboard');
            }
        } catch (error) {
            console.error('ApiClient: Ошибка сохранения доски:', error);
            throw error;
        }
    }

    /**
     * Очищает данные объектов от избыточной информации
     * @private
     */
    _cleanObjectData(boardData) {
        if (!boardData || !boardData.objects) {
            return boardData;
        }

        const cleanedObjects = boardData.objects.map(obj => {
            if (obj.type === 'image') {
                const imageId = typeof obj.imageId === 'string' ? obj.imageId.trim() : '';
                const topSrc = typeof obj.src === 'string' ? obj.src : '';
                const propSrc = typeof obj.properties?.src === 'string' ? obj.properties.src : '';
                const hasForbiddenInlineSrc = /^data:/i.test(topSrc)
                    || /^blob:/i.test(topSrc)
                    || /^data:/i.test(propSrc)
                    || /^blob:/i.test(propSrc);

                // Жесткий контракт v2: сохраняем image только через server imageId.
                if (!imageId) {
                    throw new Error(`Image object "${obj.id || 'unknown'}" has no imageId. Save is blocked.`);
                }
                if (hasForbiddenInlineSrc) {
                    throw new Error(`Image object "${obj.id || 'unknown'}" contains forbidden data/blob src. Save is blocked.`);
                }

                const cleanedObj = { ...obj };

                // imageId валиден — src можно безопасно убрать из history payload.
                if (cleanedObj.src) {
                    delete cleanedObj.src;
                }
                if (cleanedObj.properties?.src) {
                    cleanedObj.properties = { ...cleanedObj.properties };
                    delete cleanedObj.properties.src;
                }

                return cleanedObj;
            }
            
            if (obj.type === 'file') {
                const cleanedObj = { ...obj };
                
                // Если есть fileId, убираем content для экономии места
                if (obj.fileId && typeof obj.fileId === 'string' && obj.fileId.trim().length > 0) {
                    // Убираем content с верхнего уровня
                    if (cleanedObj.content) {
                        delete cleanedObj.content;
                    }
                    
                    // Убираем content из properties
                    if (cleanedObj.properties?.content) {
                        cleanedObj.properties = { ...cleanedObj.properties };
                        delete cleanedObj.properties.content;
                    }
                }
                // Если нет fileId, предупреждаем о наличии content
                else {
                    // Для файлов сейчас сохраняем поведение: без fileId не модифицируем объект.
                }
                
                return cleanedObj;
            }
            
            return obj;
        });

        return {
            ...boardData,
            objects: cleanedObjects
        };
    }

    /**
     * Восстанавливает URL изображений и файлов при загрузке
     */
    async restoreObjectUrls(boardData) {
        if (!boardData || !boardData.objects) {
            return boardData;
        }

        const restoredObjects = await Promise.all(
            boardData.objects.map(async (obj) => {
                if (obj.type === 'image') {
                    if (obj.imageId && (!obj.src && !obj.properties?.src)) {
                        try {
                            // Формируем URL изображения
                            const imageUrl = `/api/v2/images/${obj.imageId}/download`;
                            
                            return {
                                ...obj,
                                src: imageUrl,
                                properties: {
                                    ...obj.properties,
                                    src: imageUrl
                                }
                            };
                        } catch (error) {
                            console.warn(`Не удалось восстановить URL для изображения ${obj.imageId}:`, error);
                            return obj;
                        }
                    }
                    return obj;
                }
                
                if (obj.type === 'file') {
                    if (obj.fileId) {
                        try {
                            // Формируем URL файла для скачивания
                            const fileUrl = `/api/v2/files/${obj.fileId}/download`;
                            
                            // Создаем обновленный объект с восстановленными данными
                            const restoredObj = {
                                ...obj,
                                url: fileUrl,
                                properties: {
                                    ...obj.properties,
                                    url: fileUrl
                                }
                            };
                            
                            // Пытаемся восстановить актуальные метаданные файла с сервера
                            // (Это будет выполнено асинхронно, чтобы не блокировать загрузку)
                            setTimeout(async () => {
                                try {
                                    const response = await fetch(`/api/v2/files/${obj.fileId}`, {
                                        headers: {
                                            'Accept': 'application/json',
                                            'X-Requested-With': 'XMLHttpRequest'
                                        },
                                        credentials: 'same-origin'
                                    });
                                    
                                    if (response.ok) {
                                        const result = await response.json();
                                        if (result.success && result.data) {
                                            // Эмитим событие для обновления метаданных файла в состоянии
                                            // (это будет обработано в core, если EventBus доступен)
                                            if (typeof window !== 'undefined' && window.moodboardEventBus) {
                                                window.moodboardEventBus.emit('file:metadata:updated', {
                                                    objectId: obj.id,
                                                    fileId: obj.fileId,
                                                    metadata: result.data
                                                });
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.warn(`Не удалось обновить метаданные файла ${obj.fileId}:`, error);
                                }
                            }, 100);
                            
                            return restoredObj;
                        } catch (error) {
                            console.warn(`Не удалось восстановить данные для файла ${obj.fileId}:`, error);
                            return obj;
                        }
                    }
                    return obj;
                }
                
                return obj;
            })
        );

        return {
            ...boardData,
            objects: restoredObjects
        };
    }
}