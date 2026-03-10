import { Events } from '../../../core/events/Events.js';
import { alignStaticTextToEditorCssPosition } from './TextEditorPositioningService.js';
import {
    cleanupActiveTextEditor,
    showNotePixiText,
    showStaticTextAfterEditing,
    updateGlobalTextEditorHandlesLayer,
} from './TextEditorLifecycleRegistry.js';

export function applyTextEditorCaretFromClick({ create, objectId, object, textarea }) {
    try {
        const click = (object && object.caretClick) ? object.caretClick : null;
        if (!create && objectId && click && typeof window !== 'undefined') {
            setTimeout(() => {
                try {
                    const el = window.moodboardHtmlTextLayer ? window.moodboardHtmlTextLayer.idToEl.get(objectId) : null;
                    const fullText = (typeof textarea.value === 'string') ? textarea.value : '';
                    if (!el || !fullText || !el.firstChild) return;
                    const textNode = el.firstChild;
                    const len = textNode.textContent.length;
                    if (len === 0) {
                        textarea.selectionStart = textarea.selectionEnd = 0;
                        return;
                    }
                    const doc = el.ownerDocument || document;
                    let bestIdx = 0;
                    let bestDist = Infinity;
                    for (let i = 0; i <= len; i++) {
                        const range = doc.createRange();
                        range.setStart(textNode, i);
                        range.setEnd(textNode, i);
                        const rects = range.getClientRects();
                        const rect = rects && rects.length > 0 ? rects[0] : range.getBoundingClientRect();
                        if (rect && isFinite(rect.left) && isFinite(rect.top)) {
                            if (click.clientX >= rect.left && click.clientX <= rect.right &&
                                click.clientY >= rect.top && click.clientY <= rect.bottom) {
                                bestIdx = i;
                                bestDist = 0;
                                break;
                            }
                            const cx = Math.max(rect.left, Math.min(click.clientX, rect.right));
                            const cy = Math.max(rect.top, Math.min(click.clientY, rect.bottom));
                            const dx = click.clientX - cx;
                            const dy = click.clientY - cy;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < bestDist) {
                                bestDist = d2;
                                bestIdx = i;
                            }
                        }
                    }
                    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
                    const caret = clamp(bestIdx, 0, fullText.length);
                    textarea.selectionStart = textarea.selectionEnd = caret;
                    if (typeof textarea.scrollTop === 'number') textarea.scrollTop = 0;
                    console.log('🧭 Text caret set', { objectId, caret, len: fullText.length });
                } catch (_) {}
            }, 0);
        }
    } catch (_) {}
}

export function createTextEditorFinalize(controller, {
    textarea,
    wrapper,
    view,
    viewRes,
    position,
    fontSize,
    objectId,
    isNewCreation,
    initialContent = '',
}) {
    return (commit) => {
        if (controller.textEditor?._removeDomListeners) {
            controller.textEditor._removeDomListeners();
            controller.textEditor._removeDomListeners = null;
        }

        const value = textarea.value.trim();
        const commitValue = commit && value.length > 0;

        const currentObjectType = controller.textEditor.objectType;

        if (objectId && (commitValue || !isNewCreation)) {
            showStaticTextAfterEditing(controller, objectId);
        }

        if (objectId && (currentObjectType === 'text' || currentObjectType === 'simple-text')) {
            try {
                const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
                const scaleX = worldLayerRef?.scale?.x || 1;
                const viewResLocal = (controller.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
                const wPx = Math.max(1, wrapper.offsetWidth);
                const hPx = Math.max(1, wrapper.offsetHeight);
                const newW = Math.max(1, Math.round(wPx * viewResLocal / scaleX));
                const newH = Math.max(1, Math.round(hPx * viewResLocal / scaleX));
                const sizeReq = { objectId, size: null };
                controller.eventBus.emit(Events.Tool.GetObjectSize, sizeReq);
                const oldSize = sizeReq.size || { width: newW, height: newH };
                const posReq = { objectId, position: null };
                controller.eventBus.emit(Events.Tool.GetObjectPosition, posReq);
                const oldPos = posReq.position || { x: position.x, y: position.y };
                const newSize = { width: newW, height: newH };
                controller.eventBus.emit(Events.Tool.ResizeUpdate, { object: objectId, size: newSize, position: oldPos });
                controller.eventBus.emit(Events.Tool.ResizeEnd, { object: objectId, oldSize, newSize, oldPosition: oldPos, newPosition: oldPos });
            } catch (err) {
                console.warn('⚠️ Не удалось применить размеры после редактирования текста:', err);
            }
        }

        cleanupActiveTextEditor(controller, wrapper);
        if (currentObjectType === 'note') {
            controller.eventBus.emit(Events.UI.NoteEditEnd, { objectId: objectId || null });
            showNotePixiText(controller, objectId);
        } else {
            controller.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
        }

        updateGlobalTextEditorHandlesLayer();

        if (!commitValue) {
            if (isNewCreation && objectId) {
                controller.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [objectId] });
            }
            return;
        }

        if (objectId == null) {
            const objectType = currentObjectType || 'text';
            const worldLayerRef = controller.textEditor.world || (controller.app?.stage);
            const scaleX = worldLayerRef?.scale?.x || 1;
            const wPx = Math.max(1, wrapper.offsetWidth);
            const hPx = Math.max(1, wrapper.offsetHeight);
            const wWorld = Math.max(1, Math.round(wPx * viewRes / scaleX));
            const hWorld = Math.max(1, Math.round(hPx * viewRes / scaleX));
            controller.eventBus.emit(Events.UI.ToolbarAction, {
                type: objectType,
                id: objectType,
                position: { x: position.x, y: position.y },
                properties: { content: value, fontSize, width: wWorld, height: hWorld },
            });
        } else {
            if (isNewCreation) {
                controller.eventBus.emit(Events.Tool.UpdateObjectContent, { objectId, content: value });
                controller.eventBus.emit(Events.Object.StateChanged, {
                    objectId,
                    updates: { properties: { content: value } },
                });
            } else {
                const oldContent = typeof initialContent === 'string' ? initialContent : '';
                controller.eventBus.emit(Events.Object.ContentChange, {
                    objectId,
                    oldContent,
                    newContent: value,
                });
            }
        }
    };
}

export function bindTextEditorInteractions(controller, {
    textarea,
    isNewCreation,
    isNote,
    autoSize,
    updateNoteEditor,
    finalize,
}) {
    const blurHandler = () => {
        const value = (textarea.value || '').trim();
        if (isNewCreation && value.length === 0) {
            finalize(false);
            return;
        }
        finalize(true);
    };

    const keydownHandler = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finalize(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finalize(false);
        }
    };

    const inputHandler = !isNote
        ? autoSize
        : () => { try { if (updateNoteEditor) updateNoteEditor(); } catch (_) {} };

    textarea.addEventListener('blur', blurHandler);
    textarea.addEventListener('keydown', keydownHandler);
    textarea.addEventListener('input', inputHandler);

    const removeDomListeners = () => {
        textarea.removeEventListener('blur', blurHandler);
        textarea.removeEventListener('keydown', keydownHandler);
        textarea.removeEventListener('input', inputHandler);
    };

    if (controller.textEditor) {
        controller.textEditor._removeDomListeners = removeDomListeners;
    }
}

export function closeTextEditorFromState(controller, commit) {
    const textarea = controller.textEditor.textarea;
    if (!textarea) return;
    const value = textarea.value.trim();
    const commitValue = commit && value.length > 0;
    const objectType = controller.textEditor.objectType || 'text';
    const objectId = controller.textEditor.objectId;
    const position = controller.textEditor.position;
    const properties = controller.textEditor.properties;
    const isNewCreation = controller.textEditor.isNewCreation;
    const initialContent = controller.textEditor.initialContent ?? '';

    if (objectId) {
        if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
            const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
            if (el) {
                controller.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                alignStaticTextToEditorCssPosition({
                    controller,
                    objectId,
                    worldLayerRef: controller.textEditor.world || (controller.app?.stage),
                    view: controller.app?.view,
                    cssLeft: controller.textEditor._cssLeftPx,
                    cssTop: controller.textEditor._cssTopPx,
                });
            } else {
                console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
            }
        } else {
            controller.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
        }
    }

    textarea.remove();
    controller.textEditor = { active: false, objectId: null, textarea: null, world: null, objectType: 'text' };
    if (!commitValue) return;
    if (objectId == null) {
        controller.eventBus.emit(Events.UI.ToolbarAction, {
            type: objectType,
            id: objectType,
            position: { x: position.x, y: position.y },
            properties: { content: value, fontSize: properties.fontSize },
        });
    } else {
        if (isNewCreation) {
            controller.eventBus.emit(Events.Tool.UpdateObjectContent, { objectId, content: value });
            controller.eventBus.emit(Events.Object.StateChanged, {
                objectId,
                updates: { properties: { content: value } },
            });
        } else {
            controller.eventBus.emit(Events.Object.ContentChange, {
                objectId,
                oldContent: initialContent,
                newContent: value,
            });
        }
    }
}
