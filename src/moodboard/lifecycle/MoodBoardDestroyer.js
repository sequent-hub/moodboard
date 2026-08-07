import { LAYER_GLOBAL_REFS } from '../bootstrap/layerGlobalRefs.js';

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

    // Список window-ключей этого экземпляра фиксируем ДО уничтожения слоёв:
    // ниже поля board обнуляются, и сравнение window[key] === board[field]
    // сравнивало бы с null. Тогда ссылка оставалась бы висеть, удерживая
    // открепленный DOM, слушателей и ядро до перезагрузки страницы.
    const ownedGlobals = typeof window !== 'undefined'
        ? [...LAYER_GLOBAL_REFS, ['reloadIcon', '_reloadIconGlobal']]
            .filter(([globalKey, field]) => board[field] && window[globalKey] === board[field])
            .map(([globalKey]) => globalKey)
        : [];

    safeDestroy(board.toolbar, 'toolbar');
    board.toolbar = null;

    safeDestroy(board.topbar, 'topbar');
    board.topbar = null;

    safeDestroy(board.saveStatus, 'saveStatus');
    board.saveStatus = null;

    safeDestroy(board.textPropertiesPanel, 'textPropertiesPanel');
    board.textPropertiesPanel = null;

    safeDestroy(board.mindmapPropertiesPanel, 'mindmapPropertiesPanel');
    board.mindmapPropertiesPanel = null;

    safeDestroy(board.framePropertiesPanel, 'framePropertiesPanel');
    board.framePropertiesPanel = null;

    safeDestroy(board.notePropertiesPanel, 'notePropertiesPanel');
    board.notePropertiesPanel = null;

    safeDestroy(board.filePropertiesPanel, 'filePropertiesPanel');
    board.filePropertiesPanel = null;

    safeDestroy(board.imagePropertiesPanel, 'imagePropertiesPanel');
    board.imagePropertiesPanel = null;

    safeDestroy(board.connectorPropertiesPanel, 'connectorPropertiesPanel');
    board.connectorPropertiesPanel = null;

    safeDestroy(board.shapePropertiesPanel, 'shapePropertiesPanel');
    board.shapePropertiesPanel = null;

    safeDestroy(board.drawingPropertiesPanel, 'drawingPropertiesPanel');
    board.drawingPropertiesPanel = null;

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

    safeDestroy(board.mindmapCollapseLayer, 'mindmapCollapseLayer');
    board.mindmapCollapseLayer = null;

    safeDestroy(board.connectorLayer, 'connectorLayer');
    board.connectorLayer = null;

    safeDestroy(board.connectorLabelLayer, 'connectorLabelLayer');
    board.connectorLabelLayer = null;

    safeDestroy(board.connectionAnchorsLayer, 'connectionAnchorsLayer');
    board.connectionAnchorsLayer = null;

    safeDestroy(board.connectorHandlesLayer, 'connectorHandlesLayer');
    board.connectorHandlesLayer = null;

    safeDestroy(board.imageGeneratorControlsLayer, 'imageGeneratorControlsLayer');
    board.imageGeneratorControlsLayer = null;

    safeDestroy(board.imageGeneratorRunner, 'imageGeneratorRunner');
    board.imageGeneratorRunner = null;

    safeDestroy(board.videoGeneratorControlsLayer, 'videoGeneratorControlsLayer');
    board.videoGeneratorControlsLayer = null;

    safeDestroy(board.videoGeneratorRunner, 'videoGeneratorRunner');
    board.videoGeneratorRunner = null;

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

    safeDestroy(board.hoverAnimationToggle, 'hoverAnimationToggle');
    board.hoverAnimationToggle = null;

    safeDestroy(board.dotGridDebugPanel, 'dotGridDebugPanel');
    board.dotGridDebugPanel = null;

    safeDestroy(board.chatWindow, 'chatWindow');
    board.chatWindow = null;

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

    ownedGlobals.forEach((globalKey) => {
        window[globalKey] = null;
    });
    board._reloadIconGlobal = null;

    if (typeof board.options.onDestroy === 'function') {
        try {
            board.options.onDestroy();
        } catch (error) {
            console.warn('⚠️ Ошибка в коллбеке onDestroy:', error);
        }
    }
}
