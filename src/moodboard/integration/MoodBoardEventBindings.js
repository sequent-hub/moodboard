import { Events } from '../../core/events/Events.js';
import { logMindmapCompoundDebug } from '../../mindmap/MindmapCompoundContract.js';

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
        if (typeof selectTool?.setSelection === 'function') {
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
            focusCreatedObject(board, createdObject);
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

export function bindSaveCallbacks(board) {
    if (!board.coreMoodboard || !board.coreMoodboard.eventBus) {
        return;
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
