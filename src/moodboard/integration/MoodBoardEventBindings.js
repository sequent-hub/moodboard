import { Events } from '../../core/events/Events.js';
import { logMindmapCompoundDebug } from '../../mindmap/MindmapCompoundContract.js';

function getSelectTool(board) {
    const toolManager = board?.coreMoodboard?.toolManager;
    if (!toolManager) return null;
    return toolManager?.tools?.get?.('select')
        || toolManager?.registry?.get?.('select')
        || null;
}

function hasOpenTextEditorInDom(board) {
    const doc = board?.workspaceElement?.ownerDocument
        || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.querySelector !== 'function') return false;
    return Boolean(doc.querySelector('.moodboard-text-input'));
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
        if (action?.type === 'mindmap' && createdObject?.id) {
            const content = String(createdObject?.properties?.content || '');
            const createdMeta = createdObject?.properties?.mindmap || {};
            const isRootMindmap = createdMeta?.role === 'root';
            const mindmapObjects = (board?.coreMoodboard?.state?.state?.objects || [])
                .filter((obj) => obj?.type === 'mindmap');
            const rootCount = mindmapObjects.filter((obj) => (obj?.properties?.mindmap?.role || null) === 'root').length;
            const shouldAutoOpenForRoot = !isRootMindmap || rootCount <= 1;
            const selectTool = getSelectTool(board);
            const hasActiveEditor = Boolean(selectTool?.textEditor?.active);
            const hasEditorDom = hasOpenTextEditorInDom(board);
            const shouldBlockAutoOpen = hasActiveEditor && hasEditorDom;
            if (content.trim().length === 0 && !shouldBlockAutoOpen && shouldAutoOpenForRoot) {
                const doc = board?.workspaceElement?.ownerDocument
                    || (typeof document !== 'undefined' ? document : null);
                const closeSeqAtSchedule = Number(selectTool?._mindmapEditorCloseSeq || 0);
                let cancelledByPointer = false;
                const cancelOnPointerDown = () => {
                    cancelledByPointer = true;
                };
                const cancelOnEscape = (event) => {
                    if (event?.key === 'Escape') {
                        cancelledByPointer = true;
                    }
                };
                if (doc && typeof doc.addEventListener === 'function') {
                    doc.addEventListener('pointerdown', cancelOnPointerDown, true);
                    doc.addEventListener('keydown', cancelOnEscape, true);
                }
                setTimeout(() => {
                    if (doc && typeof doc.removeEventListener === 'function') {
                        doc.removeEventListener('pointerdown', cancelOnPointerDown, true);
                        doc.removeEventListener('keydown', cancelOnEscape, true);
                    }
                    if (cancelledByPointer) return;
                    const latestSelectTool = getSelectTool(board);
                    const latestCloseSeq = Number(latestSelectTool?._mindmapEditorCloseSeq || 0);
                    if (latestCloseSeq !== closeSeqAtSchedule) return;

                    const nextSelectTool = getSelectTool(board);
                    const nextHasActiveEditor = Boolean(nextSelectTool?.textEditor?.active);
                    const nextHasEditorDom = hasOpenTextEditorInDom(board);
                    if (nextHasActiveEditor || nextHasEditorDom) {
                        return;
                    }
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
                }, 0);
            }
        }
    });

    const loadVersion = async (targetVersion) => {
        const moodboardId = board.options.boardId;
        if (!moodboardId) return;
        if (!Number.isFinite(targetVersion) || targetVersion < 1) return;
        try {
            await board.loadFromApi(moodboardId, targetVersion, { fallbackToSeedOnError: false });

            // В append-only модели откат/переход по версии фиксируем новой записью,
            // чтобы дальнейшие изменения шли от нового head и не теряли "будущее".
            const restoreSnapshot = board.coreMoodboard?.getBoardData?.();
            if (restoreSnapshot && board.coreMoodboard?.apiClient) {
                const saveResult = await board.coreMoodboard.apiClient.saveBoard(
                    moodboardId,
                    restoreSnapshot,
                    { actionType: 'history_restore' }
                );
                const restoredVersion = Number(saveResult?.historyVersion);
                if (Number.isFinite(restoredVersion) && restoredVersion > 0) {
                    board.currentLoadedVersion = restoredVersion;
                    board.coreMoodboard.eventBus.emit(Events.UI.UpdateHistoryButtons, {
                        canUndo: restoredVersion > 1,
                        canRedo: false,
                    });
                }
            }
        } catch (error) {
            console.warn(`⚠️ Не удалось загрузить версию ${targetVersion}:`, error?.message || error);
        }
    };

    board.coreMoodboard.eventBus.on(Events.UI.LoadPrevVersion, () => {
        const current = Number(board.currentLoadedVersion);
        if (!Number.isFinite(current) || current <= 1) return;
        loadVersion(current - 1);
    });

    board.coreMoodboard.eventBus.on(Events.UI.LoadNextVersion, () => {
        const current = Number(board.currentLoadedVersion);
        if (!Number.isFinite(current)) return;
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
