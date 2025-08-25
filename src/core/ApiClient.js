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
                return { data: result.data };
            } else {
                throw new Error(result.message || 'Ошибка сохранения доски');
            }
        } catch (error) {
            console.warn('API: Ошибка сохранения доски:', error);
            // Возвращаем данные как есть для совместимости
            return { data: boardData };
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
                const cleanedObj = { ...obj };
                
                // Если есть imageId, убираем src (base64)
                if (obj.imageId) {
                    if (cleanedObj.properties) {
                        delete cleanedObj.properties.src;
                    }
                    delete cleanedObj.src;
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
                if (obj.type === 'image' && obj.imageId && !obj.properties?.src) {
                    try {
                        // Формируем URL изображения
                        const imageUrl = `/api/images/${obj.imageId}/file`;
                        
                        return {
                            ...obj,
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
            })
        );

        return {
            ...boardData,
            objects: restoredObjects
        };
    }
}