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
            const objects = Array.isArray(cleanedData?.objects) ? cleanedData.objects : [];
            const imageObjects = objects.filter((obj) => obj?.type === 'image');
            const imageObjectsWithSrc = imageObjects.filter((obj) => typeof obj?.src === 'string' && obj.src.trim().length > 0);
            const imageObjectsWithoutSrc = imageObjects
                .filter((obj) => !(typeof obj?.src === 'string' && obj.src.trim().length > 0))
                .map((obj) => obj?.id || 'unknown');
            const fileObjects = objects.filter((obj) => obj?.type === 'file');
            const fileObjectsWithSrc = fileObjects.filter((obj) => typeof obj?.src === 'string' && obj.src.trim().length > 0);
            const fileObjectsWithoutSrc = fileObjects
                .filter((obj) => !(typeof obj?.src === 'string' && obj.src.trim().length > 0))
                .map((obj) => obj?.id || 'unknown');
            console.log('history/save payload stats:', {
                totalObjects: objects.length,
                imageObjects: imageObjects.length,
                imageObjectsWithSrc: imageObjectsWithSrc.length,
                fileObjects: fileObjects.length,
                fileObjectsWithSrc: fileObjectsWithSrc.length
            });
            if (imageObjectsWithoutSrc.length > 0) {
                console.warn('history/save warning: image objects without src (kept as broken placeholders):', imageObjectsWithoutSrc);
            }
            if (fileObjectsWithoutSrc.length > 0) {
                console.warn('history/save warning: file objects without src:', fileObjectsWithoutSrc);
            }

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
                const topSrcRaw = typeof obj.src === 'string' ? obj.src : '';
                const propSrcRaw = typeof obj.properties?.src === 'string' ? obj.properties.src : '';
                const normalizedSrc = topSrcRaw.trim() || propSrcRaw.trim();

                if (!normalizedSrc) {
                    return obj;
                }
                if (/^data:/i.test(normalizedSrc) || /^blob:/i.test(normalizedSrc)) {
                    throw new Error(`Image object "${obj.id || 'unknown'}" contains forbidden data/blob src. Save is blocked.`);
                }
                if (/^\/api\/images\//i.test(normalizedSrc)) {
                    throw new Error(`Image object "${obj.id || 'unknown'}" has legacy src URL. Save is blocked.`);
                }

                const cleanedObj = {
                    ...obj,
                    src: normalizedSrc
                };
                if (cleanedObj.properties?.src) {
                    cleanedObj.properties = { ...cleanedObj.properties };
                    delete cleanedObj.properties.src;
                }
                return cleanedObj;
            }
            
            if (obj.type === 'file') {
                const topSrcRaw = typeof obj.src === 'string' ? obj.src : '';
                const propSrcRaw = typeof obj.properties?.src === 'string' ? obj.properties.src : '';
                const topUrlRaw = typeof obj.url === 'string' ? obj.url : '';
                const propUrlRaw = typeof obj.properties?.url === 'string' ? obj.properties.url : '';
                const normalizedSrc = topSrcRaw.trim() || propSrcRaw.trim() || topUrlRaw.trim() || propUrlRaw.trim();

                if (!normalizedSrc) {
                    throw new Error(`File object "${obj.id || 'unknown'}" has no src. Save is blocked.`);
                }
                if (/^data:/i.test(normalizedSrc) || /^blob:/i.test(normalizedSrc)) {
                    throw new Error(`File object "${obj.id || 'unknown'}" contains forbidden data/blob src. Save is blocked.`);
                }
                if (/^\/api\/v2\/files\//i.test(normalizedSrc)) {
                    throw new Error(`File object "${obj.id || 'unknown'}" has legacy id-based src URL. Save is blocked.`);
                }

                const cleanedObj = {
                    ...obj,
                    src: normalizedSrc
                };
                if (cleanedObj.url) delete cleanedObj.url;
                if (cleanedObj.content) delete cleanedObj.content;
                if (cleanedObj.fileId) delete cleanedObj.fileId;
                if (cleanedObj.properties?.src || cleanedObj.properties?.url || cleanedObj.properties?.content) {
                    cleanedObj.properties = { ...cleanedObj.properties };
                    delete cleanedObj.properties.src;
                    delete cleanedObj.properties.url;
                    delete cleanedObj.properties.content;
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
     * Нормализует URL ресурсов при загрузке
     */
    async restoreObjectUrls(boardData) {
        if (!boardData || !boardData.objects) {
            return boardData;
        }

        const restoredObjects = await Promise.all(
            boardData.objects.map(async (obj) => {
                if (obj.type === 'image') {
                    const topSrc = typeof obj.src === 'string' ? obj.src.trim() : '';
                    const propSrc = typeof obj.properties?.src === 'string' ? obj.properties.src.trim() : '';
                    const normalizedSrc = topSrc || propSrc;
                    if (!normalizedSrc) return obj;
                    const restoredObj = {
                        ...obj,
                        src: normalizedSrc
                    };
                    if (restoredObj.properties?.src) {
                        restoredObj.properties = { ...restoredObj.properties };
                        delete restoredObj.properties.src;
                    }
                    return restoredObj;
                }
                
                if (obj.type === 'file') {
                    const topSrc = typeof obj.src === 'string' ? obj.src.trim() : '';
                    const propSrc = typeof obj.properties?.src === 'string' ? obj.properties.src.trim() : '';
                    const topUrl = typeof obj.url === 'string' ? obj.url.trim() : '';
                    const propUrl = typeof obj.properties?.url === 'string' ? obj.properties.url.trim() : '';
                    const normalizedSrc = topSrc || propSrc || topUrl || propUrl;
                    const restoredObj = { ...obj };
                    if (normalizedSrc) {
                        restoredObj.src = normalizedSrc;
                    }
                    if (restoredObj.url) delete restoredObj.url;
                    if (restoredObj.fileId) delete restoredObj.fileId;
                    if (restoredObj.properties?.src || restoredObj.properties?.url) {
                        restoredObj.properties = { ...restoredObj.properties };
                        delete restoredObj.properties.src;
                        delete restoredObj.properties.url;
                    }
                    return restoredObj;
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