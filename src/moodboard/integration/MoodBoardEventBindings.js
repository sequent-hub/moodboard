import { Events } from '../../core/events/Events.js';
import { logMindmapCompoundDebug } from '../../mindmap/MindmapCompoundContract.js';
import { loadExistingBoard } from './MoodBoardLoadApi.js';

function getSelectTool(board) {
    const toolManager = board?.coreMoodboard?.toolManager;
    if (!toolManager) return null;
    return toolManager?.tools?.get?.('select')
        || toolManager?.registry?.get?.('select')
        || null;
}

function shouldOpenEditorForObject(objectType) {
    return objectType === 'mindmap'
        || objectType === 'text'
        || objectType === 'simple-text'
        || objectType === 'note'
        || objectType === 'file';
}

// Картинки при размещении не выделяем: выделение с попаданием в AI-композер —
// только осознанный клик пользователя по уже лежащему на мудборде изображению.
function shouldSelectOnCreate(objectType) {
    return objectType !== 'image'
        && objectType !== 'revit-screenshot-img'
        && objectType !== 'model3d-screenshot-img';
}

function focusCreatedObject(board, createdObject) {
    if (!board?.coreMoodboard?.eventBus || !createdObject?.id) return;
    const objectType = createdObject?.type || null;
    const objectPayload = {
        id: createdObject.id,
        type: objectType,
        position: createdObject.position || null,
        properties: createdObject.properties || {},
    };

    // Run after object is mounted so selection/HTML overlays can sync first.
    setTimeout(() => {
        board.coreMoodboard.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
        const selectTool = getSelectTool(board);
        if (shouldSelectOnCreate(objectType) && typeof selectTool?.setSelection === 'function') {
            selectTool.setSelection([createdObject.id]);
        }
        if (shouldOpenEditorForObject(objectType)) {
            board.coreMoodboard.eventBus.emit(Events.Tool.ObjectEdit, {
                object: objectPayload,
                create: true,
            });
        }
    }, 0);
}

export function bindToolbarEvents(board) {
    board.coreMoodboard.eventBus.on(Events.UI.ToolbarAction, (action) => {
        if (action?.type === 'mindmap') {
            logMindmapCompoundDebug('toolbar:action', {
                type: action.type,
                position: action.position || null,
                mindmap: action.properties?.mindmap || null,
            });
        }
        const createdObject = board.actionHandler.handleToolbarAction(action);
        if (createdObject?.id) {
            // Рисунки карандашом/кистью не выделяем и не переключаем инструмент:
            // пользователь должен сразу продолжить рисовать следующий штрих.
            if (action?.type !== 'drawing') {
                focusCreatedObject(board, createdObject);
            }
        }
    });

    const loadVersion = async (targetVersion) => {
        const moodboardId = board.options.boardId;
        if (!moodboardId) return;
        if (!Number.isFinite(targetVersion) || targetVersion < 1) return;
        try {
            await board.loadFromApi(moodboardId, targetVersion, {
                fallbackToSeedOnError: false,
                historyNavigation: true,
            });
        } catch (error) {
            console.warn(`⚠️ Не удалось загрузить версию ${targetVersion}:`, error?.message || error);
        }
    };

    board.coreMoodboard.eventBus.on(Events.UI.LoadPrevVersion, () => {
        const current = Number(board.historyCursorVersion);
        if (!Number.isFinite(current) || current <= 1) return;
        loadVersion(current - 1);
    });

    board.coreMoodboard.eventBus.on(Events.UI.LoadNextVersion, () => {
        const current = Number(board.historyCursorVersion);
        const head = Number(board.historyHeadVersion);
        if (!Number.isFinite(current) || !Number.isFinite(head) || current >= head) return;
        loadVersion(current + 1);
    });
}

export function bindTopbarEvents(board) {
    board.coreMoodboard.eventBus.on(Events.UI.PaintPick, ({ color }) => {
        if (!color) {
            return;
        }

        if (board.settingsApplier && typeof board.settingsApplier.set === 'function') {
            board.settingsApplier.set({ backgroundColor: color });
        } else {
            const hex = (typeof color === 'string' && color.startsWith('#'))
                ? parseInt(color.slice(1), 16)
                : color;
            if (board.coreMoodboard?.pixi?.app?.renderer) {
                board.coreMoodboard.pixi.app.renderer.backgroundColor = hex;
            }
            board.coreMoodboard.eventBus.emit(Events.Grid.BoardDataChanged, { settings: { backgroundColor: color } });
        }
    });
}

/**
 * Аддитивно переприменяет локальные объекты, которых нет в текущем (только что
 * перечитанном с сервера) состоянии доски. Вызывается после 409
 * stale_base_version, чтобы не потерять только что созданные локально объекты
 * (например, нарисованный штрих). Серверные объекты не трогаем — это безопасный
 * union по id, а не перезапись чужих данных.
 * @returns {number} сколько объектов переприменено
 */
function reapplyLocalOnlyObjects(board, pendingData) {
    const core = board?.coreMoodboard;
    if (!core || typeof core.createObjectFromData !== 'function') {
        return 0;
    }

    const pendingObjects = Array.isArray(pendingData?.boardData?.objects)
        ? pendingData.boardData.objects
        : Array.isArray(pendingData?.objects)
            ? pendingData.objects
            : [];
    if (pendingObjects.length === 0) {
        return 0;
    }

    const currentObjects = Array.isArray(core.state?.state?.objects)
        ? core.state.state.objects
        : [];
    const currentIds = new Set(currentObjects.map((obj) => obj && obj.id).filter(Boolean));

    let reapplied = 0;
    for (const obj of pendingObjects) {
        if (!obj || !obj.id || currentIds.has(obj.id)) {
            continue;
        }
        try {
            // Клонируем: createObjectFromData мутирует objectData (transform/properties).
            const created = core.createObjectFromData(JSON.parse(JSON.stringify(obj)));
            if (created) {
                reapplied++;
            }
        } catch (error) {
            console.warn('⚠️ rebase после 409: не удалось переприменить объект', obj.id, error);
        }
    }

    if (reapplied > 0) {
        // PIXI-объекты (рисунок) перерисовываются сразу; для текстовых/заметок
        // синхронизируем HTML-оверлеи, как это делает DataManager.loadData.
        setTimeout(() => {
            try { window.moodboardHtmlTextLayer?.rebuildFromState?.(); } catch (_) {}
            try { window.moodboardHtmlTextLayer?.updateAll?.(); } catch (_) {}
        }, 0);
    }

    return reapplied;
}

export function bindSaveCallbacks(board) {
    if (!board.coreMoodboard || !board.coreMoodboard.eventBus) {
        return;
    }

    // Прокидываем актуальную версию экземпляра в SaveManager, чтобы payload
    // содержал baseVersion и бэкенд мог отклонить сохранение устаревшего состояния (409).
    const saveManager = board.coreMoodboard.saveManager;
    if (saveManager) {
        saveManager.setVersionGetter(() => {
            const v = board.historyHeadVersion ?? board.currentLoadedVersion ?? null;
            return (v !== null && Number.isFinite(Number(v)) && Number(v) > 0) ? Number(v) : null;
        });

        // На 409 stale_base_version — перечитываем latest с сервера (не затираем
        // чужие данные) и аддитивно переприменяем локальные НОВЫЕ объекты, которых
        // ещё нет в свежем состоянии (например, только что нарисованный штрих).
        // Возвращаем число переприменённых объектов, чтобы SaveManager понял,
        // нужно ли пересохранять с актуальной версией.
        saveManager.setReloadHandler(async (context = {}) => {
            const serverVersion = Number(context?.currentVersion);
            const hasServerVersion = Number.isFinite(serverVersion) && serverVersion > 0;
            try {
                await loadExistingBoard(board, null, { fallbackToSeedOnError: false });
                const reapplied = reapplyLocalOnlyObjects(board, context?.pendingData);
                return { reapplied };
            } catch (error) {
                // Перечитать latest не удалось (типичный случай — GET вернул 404,
                // потому что мета-запись доски ещё не создана, а история уже есть).
                // Но сервер сообщил авторитетную версию прямо в ответе 409
                // (currentVersion). Берём её напрямую, чтобы пересохранить локальное
                // состояние с корректным baseVersion и не зациклиться на 409.
                if (hasServerVersion) {
                    board.historyHeadVersion = serverVersion;
                    board.currentLoadedVersion = serverVersion;
                    board.historyCursorVersion = serverVersion;
                    console.warn(
                        `⚠️ rebase после 409: перечитывание не удалось (${error?.message || error}); `
                        + `приняли версию ${serverVersion} из ответа сервера и пересохраняем локальное состояние.`
                    );
                    return { reapplied: 0, resave: true };
                }
                throw error;
            }
        });
    }

    board.coreMoodboard.eventBus.on('save:success', (data) => {
        const savedVersion = Number(data?.response?.historyVersion);
        if (Number.isFinite(savedVersion) && savedVersion > 0) {
            board.currentLoadedVersion = savedVersion;
            board.historyHeadVersion = savedVersion;
            board.historyCursorVersion = savedVersion;
            board.coreMoodboard.eventBus.emit(Events.UI.UpdateHistoryButtons, {
                canUndo: savedVersion > 1,
                canRedo: false,
            });
        }

        if (typeof board.options.onSave === 'function') {
            try {
                let screenshot = null;
                if (board.coreMoodboard.pixi && board.coreMoodboard.pixi.app && board.coreMoodboard.pixi.app.view) {
                    screenshot = board.createCombinedScreenshot('image/jpeg', 0.6);
                }

                board.options.onSave({
                    success: true,
                    data: data,
                    screenshot: screenshot,
                    boardId: board.options.boardId,
                });
            } catch (error) {
                console.warn('⚠️ Ошибка в коллбеке onSave:', error);
            }
        }
    });

    board.coreMoodboard.eventBus.on('save:error', (data) => {
        if (typeof board.options.onSave === 'function') {
            try {
                board.options.onSave({
                    success: false,
                    error: data.error,
                    boardId: board.options.boardId,
                });
            } catch (error) {
                console.warn('⚠️ Ошибка в коллбеке onSave:', error);
            }
        }
    });
}
