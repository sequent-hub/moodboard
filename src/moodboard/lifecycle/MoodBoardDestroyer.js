export function safeDestroy(obj, name) {
    if (obj) {
        try {
            if (typeof obj.destroy === 'function') {
                obj.destroy();
            } else {
                console.warn(`Объект ${name} не имеет метода destroy()`);
            }
        } catch (error) {
            console.error(`Ошибка при уничтожении ${name}:`, error);
        }
    }
}

export function destroyMoodBoard(board) {
    if (board.destroyed) {
        console.warn('MoodBoard уже был уничтожен');
        return;
    }

    board.destroyed = true;

    safeDestroy(board.toolbar, 'toolbar');
    board.toolbar = null;

    safeDestroy(board.topbar, 'topbar');
    board.topbar = null;

    safeDestroy(board.saveStatus, 'saveStatus');
    board.saveStatus = null;

    safeDestroy(board.textPropertiesPanel, 'textPropertiesPanel');
    board.textPropertiesPanel = null;

    safeDestroy(board.framePropertiesPanel, 'framePropertiesPanel');
    board.framePropertiesPanel = null;

    safeDestroy(board.notePropertiesPanel, 'notePropertiesPanel');
    board.notePropertiesPanel = null;

    safeDestroy(board.filePropertiesPanel, 'filePropertiesPanel');
    board.filePropertiesPanel = null;

    safeDestroy(board.alignmentGuides, 'alignmentGuides');
    board.alignmentGuides = null;

    // HTML-слои (текст и ручки) также нужно корректно уничтожать,
    // чтобы удалить DOM и отписаться от глобальных слушателей resize/DPR
    safeDestroy(board.htmlTextLayer, 'htmlTextLayer');
    board.htmlTextLayer = null;

    safeDestroy(board.mindmapHtmlTextLayer, 'mindmapHtmlTextLayer');
    board.mindmapHtmlTextLayer = null;

    safeDestroy(board.mindmapConnectionLayer, 'mindmapConnectionLayer');
    board.mindmapConnectionLayer = null;

    safeDestroy(board.htmlHandlesLayer, 'htmlHandlesLayer');
    board.htmlHandlesLayer = null;

    safeDestroy(board.commentPopover, 'commentPopover');
    board.commentPopover = null;

    safeDestroy(board.contextMenu, 'contextMenu');
    board.contextMenu = null;

    safeDestroy(board.zoombar, 'zoombar');
    board.zoombar = null;

    safeDestroy(board.mapbar, 'mapbar');
    board.mapbar = null;

    safeDestroy(board.dotGridDebugPanel, 'dotGridDebugPanel');
    board.dotGridDebugPanel = null;

    safeDestroy(board.coreMoodboard, 'coreMoodboard');
    board.coreMoodboard = null;

    safeDestroy(board.workspaceManager, 'workspaceManager');
    board.workspaceManager = null;

    board.dataManager = null;
    board.actionHandler = null;

    if (board.container) {
        board.container.classList.remove('moodboard-root');
    }
    board.container = null;

    if (typeof window !== 'undefined') {
        if (window.moodboardHtmlTextLayer === board.htmlTextLayer) {
            window.moodboardHtmlTextLayer = null;
        }
        if (window.moodboardMindmapHtmlTextLayer === board.mindmapHtmlTextLayer) {
            window.moodboardMindmapHtmlTextLayer = null;
        }
        if (window.moodboardMindmapConnectionLayer === board.mindmapConnectionLayer) {
            window.moodboardMindmapConnectionLayer = null;
        }
        if (window.moodboardHtmlHandlesLayer === board.htmlHandlesLayer) {
            window.moodboardHtmlHandlesLayer = null;
        }
    }

    if (typeof board.options.onDestroy === 'function') {
        try {
            board.options.onDestroy();
        } catch (error) {
            console.warn('⚠️ Ошибка в коллбеке onDestroy:', error);
        }
    }
}
