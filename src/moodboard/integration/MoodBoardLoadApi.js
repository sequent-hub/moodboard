import { Events } from '../../core/events/Events.js';

function getSeedData(board) {
    return board.data || { objects: [] };
}

function invokeOnLoad(board, payload) {
    if (typeof board.options.onLoad === 'function') {
        board.options.onLoad(payload);
    }
}

export function getCsrfToken(board) {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        || window.csrfToken
        || board.options.csrfToken
        || '';
}

function resolveMoodboardApiBase(board) {
    const raw = String(board?.options?.apiUrl || '').trim();
    if (!raw) return '/api/v2/moodboard';

    const hasLegacyPath = /\/api\/moodboard(?:\/|$)/i.test(raw);
    const hasV2Path = /\/api\/v2\/moodboard(?:\/|$)/i.test(raw);
    if (hasLegacyPath && !hasV2Path) {
        throw new Error('Legacy apiUrl "/api/moodboard" is not supported. Use "/api/v2/moodboard".');
    }

    return raw;
}

function normalizeLoadedPayload(payload, moodboardIdFallback) {
    const state = (payload?.state && typeof payload.state === 'object')
        ? payload.state
        : {};
    return {
        ...state,
        objects: Array.isArray(state.objects) ? state.objects : [],
        moodboardId: payload?.moodboardId || moodboardIdFallback,
        name: payload?.name || null,
        description: payload?.description || null,
        settings: payload?.settings || {},
        version: payload?.version || null,
        // Это загрузка с сервера, поэтому пустое состояние допустимо.
        meta: { allowEmptyLoad: true },
    };
}

export async function loadExistingBoard(board, version = null, options = {}) {
    const fallbackToSeedOnError = options?.fallbackToSeedOnError !== false;
    const historyNavigation = options?.historyNavigation === true;
    try {
        const boardId = board.options.boardId;

        if (!boardId || !board.options.apiUrl) {
            console.log('📦 MoodBoard: нет boardId или apiUrl, загружаем пустую доску');
            const seedData = getSeedData(board);
            board.dataManager.loadData(seedData);
            invokeOnLoad(board, { success: true, data: seedData });
            return;
        }

        const apiBase = resolveMoodboardApiBase(board);
        console.log(`📦 MoodBoard: загружаем доску ${boardId} с ${apiBase}`);

        const baseUrl = apiBase.endsWith('/')
            ? `${apiBase}${boardId}`
            : `${apiBase}/${boardId}`;
        const loadUrl = Number.isFinite(version) ? `${baseUrl}/${version}` : baseUrl;

        const response = await fetch(loadUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(board),
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const apiResponse = await response.json();
        const payload = apiResponse?.data || null;

        if (apiResponse?.success && payload) {
            const normalizedData = normalizeLoadedPayload(payload, boardId);
            const loadedObjects = Array.isArray(normalizedData.objects) ? normalizedData.objects : [];
            const imageObjects = loadedObjects.filter((obj) => obj?.type === 'image');
            const imageObjectsWithSrc = imageObjects.filter((obj) => typeof obj?.src === 'string' && obj.src.trim().length > 0);
            console.log('MoodBoard load image src diagnostics:', {
                totalObjects: loadedObjects.length,
                imageObjects: imageObjects.length,
                imageObjectsWithSrc: imageObjectsWithSrc.length
            });
            const loadedVersion = Number(normalizedData.version) || null;
            board.currentLoadedVersion = loadedVersion;
            board.historyCursorVersion = loadedVersion;
            if (!historyNavigation) {
                board.historyHeadVersion = loadedVersion;
            }
            console.log('✅ MoodBoard: данные загружены с сервера', normalizedData);
            board.dataManager.loadData(normalizedData);
            if (board?.coreMoodboard?.eventBus) {
                const cursor = Number(board.historyCursorVersion);
                const head = Number(board.historyHeadVersion);
                board.coreMoodboard.eventBus.emit(Events.UI.UpdateHistoryButtons, {
                    canUndo: Number.isFinite(cursor) && cursor > 1,
                    canRedo: Number.isFinite(cursor) && Number.isFinite(head) && cursor < head,
                });
            }
            invokeOnLoad(board, { success: true, data: normalizedData });
        } else {
            console.log('📦 MoodBoard: нет данных с сервера, загружаем пустую доску');
            const seedData = getSeedData(board);
            board.dataManager.loadData(seedData);
            if (board?.coreMoodboard?.eventBus) {
                board.coreMoodboard.eventBus.emit(Events.UI.UpdateHistoryButtons, {
                    canUndo: false,
                    canRedo: false,
                });
            }
            invokeOnLoad(board, { success: true, data: seedData });
        }
    } catch (error) {
        if (!fallbackToSeedOnError) {
            throw error;
        }
        console.warn('⚠️ MoodBoard: ошибка загрузки доски, создаем новую:', error.message);
        const seedData = getSeedData(board);
        board.dataManager.loadData(seedData);
        invokeOnLoad(board, { success: false, error: error.message, data: seedData });
    }
}

export async function loadFromApi(board, boardId = null, version = null, options = {}) {
    const targetBoardId = boardId || board.options.boardId;
    if (!targetBoardId) {
        throw new Error('boardId не указан');
    }

    const originalBoardId = board.options.boardId;
    board.options.boardId = targetBoardId;

    try {
        await loadExistingBoard(board, version, options);
    } finally {
        board.options.boardId = originalBoardId;
    }
}
