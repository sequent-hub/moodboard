// src/core/ApiClient.js
export class ApiClient {
    constructor(baseUrl, authToken = null) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
    }

    async getBoard(boardId) {
        try {
            const response = await fetch(`/api/moodboard/${boardId}`, {
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
                return { data: result.data };
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

    async saveBoard(boardId, boardData) {
        try {
            // Поддержка нового формата: { boardData: {...}, settings: {...} }
            let payloadBoardData = boardData && boardData.boardData ? boardData.boardData : boardData;
            let payloadSettings = boardData && boardData.settings ? boardData.settings : undefined;

            // Фильтруем объекты изображений и файлов - убираем избыточные данные
            const cleanedData = this._cleanObjectData(payloadBoardData);

            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const response = await fetch('/api/moodboard/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    boardId: boardId,
                    boardData: cleanedData,
                    settings: payloadSettings
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                return { success: true, data: result };
            } else {
                throw new Error(result.message || 'Ошибка сохранения доски');
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
                    
                    
                    // Убираем src с верхнего уровня
                    if (cleanedObj.src) {
                        delete cleanedObj.src;
                        
                    }
                    
                    // Убираем src из properties
                    if (cleanedObj.properties?.src) {
                        cleanedObj.properties = { ...cleanedObj.properties };
                        delete cleanedObj.properties.src;
                        
                    }
                }
                // Если нет imageId, предупреждаем о base64
                else {
                    
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
                
                    id: obj.id,
                    fileId: obj.fileId,
                    hasContent: !!obj.content,
                    hasPropertiesContent: !!obj.properties?.content
                });
                
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
                    
                        id: obj.id,
                        imageId: obj.imageId,
                        hasSrc: !!obj.src,
                        hasPropertiesSrc: !!obj.properties?.src
                    });
                    
                    if (obj.imageId && (!obj.src && !obj.properties?.src)) {
                        
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
                        
                        return obj;
                    }
                }
                
                if (obj.type === 'file') {
                    
                        id: obj.id,
                        fileId: obj.fileId,
                        hasUrl: !!obj.url,
                        hasPropertiesUrl: !!obj.properties?.url
                    });
                    
                    if (obj.fileId) {
                        
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