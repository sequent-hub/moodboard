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
            // Фильтруем объекты изображений - убираем base64, оставляем только imageId
            const cleanedData = this._cleanImageData(boardData);

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
                    boardData: cleanedData
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
     * Очищает данные изображений от base64, оставляет только ссылки
     * @private
     */
    _cleanImageData(boardData) {
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
            return obj;
        });

        return {
            ...boardData,
            objects: cleanedObjects
        };
    }

    /**
     * Восстанавливает URL изображений при загрузке
     */
    async restoreImageUrls(boardData) {
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
                return obj;
            })
        );

        return {
            ...boardData,
            objects: restoredObjects
        };
    }
}