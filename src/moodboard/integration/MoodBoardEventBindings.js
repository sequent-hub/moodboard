import { Events } from '../../core/events/Events.js';
import { logMindmapCompoundDebug } from '../../mindmap/MindmapCompoundContract.js';

export function bindToolbarEvents(board) {
    board.coreMoodboard.eventBus.on(Events.UI.ToolbarAction, (action) => {
        if (action?.type === 'mindmap') {
            logMindmapCompoundDebug('toolbar:action', {
                type: action.type,
                position: action.position || null,
                mindmap: action.properties?.mindmap || null,
            });
        }
        board.actionHandler.handleToolbarAction(action);
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

    if (typeof board.options.onSave === 'function') {
        board.coreMoodboard.eventBus.on('save:success', (data) => {
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
        });

        board.coreMoodboard.eventBus.on('save:error', (data) => {
            try {
                board.options.onSave({
                    success: false,
                    error: data.error,
                    boardId: board.options.boardId,
                });
            } catch (error) {
                console.warn('⚠️ Ошибка в коллбеке onSave:', error);
            }
        });
    }
}
