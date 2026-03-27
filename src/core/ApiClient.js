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
                console.log('🧹 DEBUG _cleanImageData: обрабатываем изображение:', {
                    id: obj.id,
                    imageId: obj.imageId,
                    hasSrc: !!obj.src,
                    hasPropertiesSrc: !!obj.properties?.src,
                    srcIsBase64: !!(obj.src && obj.src.startsWith('data:')),
                    propertiesSrcIsBase64: !!(obj.properties?.src && obj.properties.src.startsWith('data:'))
                });
                
                const cleanedObj = { ...obj };
                
                // Если есть imageId, убираем src для экономии места
                if (obj.imageId && typeof obj.imageId === 'string' && obj.imageId.trim().length > 0) {
                    console.log('🧹 DEBUG _cleanImageData: у изображения есть imageId, убираем src');
                    
                    // Убираем src с верхнего уровня
                    if (cleanedObj.src) {
                        delete cleanedObj.src;
                        console.log('🧹 DEBUG: удален src с верхнего уровня');
                    }
                    
                    // Убираем src из properties
                    if (cleanedObj.properties?.src) {
                        cleanedObj.properties = { ...cleanedObj.properties };
                        delete cleanedObj.properties.src;
                        console.log('🧹 DEBUG: удален src из properties');
                    }
                }
                // Если нет imageId, предупреждаем о base64
                else {
                    console.log('🧹 DEBUG _cleanImageData: у изображения НЕТ imageId, оставляем src как есть');
                    if (cleanedObj.properties?.src && cleanedObj.properties.src.startsWith('data:')) {
                        console.warn('❌ Изображение сохраняется с base64 в properties, так как нет imageId:', cleanedObj.id);
                    }
                    if (cleanedObj.src && cleanedObj.src.startsWith('data:')) {
                        console.warn('❌ Изображение сохраняется с base64 в src, так как нет imageId:', cleanedObj.id);
                    }
                    if (!obj.imageId) {
                        console.warn('❌ У изображения отсутствует imageId:', cleanedObj.id);
                    }
                }
                
                return cleanedObj;
            }
            
            if (obj.type === 'file') {
                console.log('🧹 DEBUG _cleanObjectData: обрабатываем файл:', {
                    id: obj.id,
                    fileId: obj.fileId,
                    hasContent: !!obj.content,
                    hasPropertiesContent: !!obj.properties?.content
                });
                
                const cleanedObj = { ...obj };
                
                // Если есть fileId, убираем content для экономии места
                if (obj.fileId && typeof obj.fileId === 'string' && obj.fileId.trim().length > 0) {
                    console.log('🧹 DEBUG _cleanObjectData: у файла есть fileId, убираем content');
                    
                    // Убираем content с верхнего уровня
                    if (cleanedObj.content) {
                        delete cleanedObj.content;
                        console.log('🧹 DEBUG: удален content с верхнего уровня');
                    }
                    
                    // Убираем content из properties
                    if (cleanedObj.properties?.content) {
                        cleanedObj.properties = { ...cleanedObj.properties };
                        delete cleanedObj.properties.content;
                        console.log('🧹 DEBUG: удален content из properties');
                    }
                }
                // Если нет fileId, предупреждаем о наличии content
                else {
                    console.log('🧹 DEBUG _cleanObjectData: у файла НЕТ fileId, оставляем content как есть');
                    if (cleanedObj.properties?.content) {
                        console.warn('❌ Файл сохраняется с content в properties, так как нет fileId:', cleanedObj.id);
                    }
                    if (cleanedObj.content) {
                        console.warn('❌ Файл сохраняется с content, так как нет fileId:', cleanedObj.id);
                    }
                    if (!obj.fileId) {
                        console.warn('❌ У файла отсутствует fileId:', cleanedObj.id);
                    }
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
                    console.log('🔗 DEBUG restoreImageUrls: обрабатываем изображение:', {
                        id: obj.id,
                        imageId: obj.imageId,
                        hasSrc: !!obj.src,
                        hasPropertiesSrc: !!obj.properties?.src
                    });
                    
                    if (obj.imageId && (!obj.src && !obj.properties?.src)) {
                        console.log('🔗 DEBUG: восстанавливаем URL для изображения');
                        try {
                            // Формируем URL изображения
                            const imageUrl = `/api/images/${obj.imageId}/file`;
                            
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
                    } else {
                        console.log('🔗 DEBUG: изображение уже имеет URL или нет imageId, оставляем как есть');
                        return obj;
                    }
                }
                
                if (obj.type === 'file') {
                    console.log('🔗 DEBUG restoreObjectUrls: обрабатываем файл:', {
                        id: obj.id,
                        fileId: obj.fileId,
                        hasUrl: !!obj.url,
                        hasPropertiesUrl: !!obj.properties?.url
                    });
                    
                    if (obj.fileId) {
                        console.log('🔗 DEBUG: восстанавливаем данные для файла');
                        try {
                            // Формируем URL файла для скачивания
                            const fileUrl = `/api/files/${obj.fileId}/download`;
                            
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
                                    const response = await fetch(`/api/files/${obj.fileId}`, {
                                        headers: {
                                            'Accept': 'application/json',
                                            'X-Requested-With': 'XMLHttpRequest'
                                        },
                                        credentials: 'same-origin'
                                    });
                                    
                                    if (response.ok) {
                                        const result = await response.json();
                                        if (result.success && result.data) {
                                            console.log('🔄 Обновляем метаданные файла с сервера:', result.data);
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
                    } else {
                        console.log('🔗 DEBUG: файл не имеет fileId, оставляем как есть');
                        return obj;
                    }
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