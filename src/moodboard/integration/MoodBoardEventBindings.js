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
        const createdObject = board.actionHandler.handleToolbarAction(action);
        if (action?.type === 'mindmap' && createdObject?.id) {
            const content = String(createdObject?.properties?.content || '');
            if (content.trim().length === 0) {
                setTimeout(() => {
                    board.coreMoodboard.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                    board.coreMoodboard.eventBus.emit(Events.Tool.ObjectEdit, {
                        object: {
                            id: createdObject.id,
                            type: 'mindmap',
                            position: createdObject.position || null,
                            properties: createdObject.properties || {},
                        },
                        create: true,
                    });
                }, 20);
            }
        }
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
