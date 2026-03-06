import { Events } from '../../../core/events/Events.js';
import { unregisterEditorListeners } from './InlineEditorListenersRegistry.js';

export function hideGlobalTextEditorHandlesLayer() {
    try {
        if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
            window.moodboardHtmlHandlesLayer.hide();
        }
    } catch (_) {}
}

export function updateGlobalTextEditorHandlesLayer() {
    try {
        if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
            window.moodboardHtmlHandlesLayer.update();
        }
    } catch (_) {}
}

export function hideStaticTextDuringEditing(controller, objectId) {
    if (!objectId) return;

    if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
        const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
        if (el) {
            controller.eventBus.emit(Events.Tool.HideObjectText, { objectId });
        } else {
            console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем HideObjectText`);
        }
    } else {
        controller.eventBus.emit(Events.Tool.HideObjectText, { objectId });
    }
}

export function showStaticTextAfterEditing(controller, objectId) {
    if (!objectId) return;

    if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
        const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
        if (el) {
            controller.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
        } else {
            console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
        }
    } else {
        controller.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
    }
}

export function hideNotePixiText(controller, objectId) {
    try {
        const pixiReq = { objectId, pixiObject: null };
        controller.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
        const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
        if (inst && typeof inst.hideText === 'function') {
            inst.hideText();
        }
    } catch (_) {}
}

export function showNotePixiText(controller, objectId) {
    try {
        const pixiReq = { objectId, pixiObject: null };
        controller.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
        const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
        if (inst && typeof inst.showText === 'function') {
            inst.showText();
        }
    } catch (_) {}
}

export function cleanupActiveTextEditor(controller, wrapper) {
    try {
        if (controller.textEditor && Array.isArray(controller.textEditor._listeners)) {
            unregisterEditorListeners(controller.eventBus, controller.textEditor._listeners);
        }
    } catch (_) {}

    wrapper.remove();
    controller.textEditor = {
        active: false,
        objectId: null,
        textarea: null,
        wrapper: null,
        world: null,
        position: null,
        properties: null,
        objectType: 'text',
    };
}
