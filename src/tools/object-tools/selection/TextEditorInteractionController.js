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
            // Safety against race conditions: when a newly-created editor is blurred by
            // tool-switch/outside click, do not auto-delete the object. Explicit cancel
            // (Esc -> commit === false) still removes empty creation.
            const shouldDeleteEmptyNewCreation = isNewCreation && objectId && commit === false;
            if (shouldDeleteEmptyNewCreation) {
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
                const oldContent = typeof initialContent === 'string' ? initialContent : '';
                controller.eventBus.emit(Events.Object.ContentChange, {
                    objectId,
                    oldContent,
                    newContent: value,
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
    isShape,
    autoSize,
    updateNoteEditor,
    finalize,
    listType,
}) {
    const blurHandler = () => {
        const editorObjectId = controller?.textEditor?.objectId || null;
        setTimeout(() => {
            // Если редактор уже закрыт/переключен другим обработчиком (outside click),
            // blur не должен дублировать finalize.
            if (!controller?.textEditor?.active) return;
            if ((controller?.textEditor?.objectId || null) !== editorObjectId) return;
            if (controller?.textEditor?._closingByOutside) return;

            const value = (textarea.value || '').trim();
            if (isNewCreation && value.length === 0) {
                finalize(false);
                return;
            }
            finalize(true);
        }, 0);
    };

    const keydownHandler = (e) => {
        const isList = listType && listType !== 'none';
        if (e.key === 'Enter') {
            if (isList && !e.shiftKey) {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = value.indexOf('\n', start);
                const curLineEnd = lineEnd === -1 ? value.length : lineEnd;
                const currentLine = value.slice(lineStart, curLineEnd);
                if (currentLine.trim() === '' && start === end) {
                    finalize(true);
                } else {
                    textarea.setRangeText('\n', start, end, 'end');
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (isList && e.shiftKey) {
                e.preventDefault();
                finalize(true);
            } else if (!e.shiftKey) {
                e.preventDefault();
                finalize(true);
            }
            // Shift+Enter в режиме без списка: нативный перевод строки
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finalize(false);
        }
    };

    // Записка и фигура имеют фиксированные границы — autoSize по вводу им не нужен.
    // Для фигуры autoSize раздувал поле до minWBound (120px) и при textAlign:center
    // уносил текст вправо от фигуры. Поэтому ввод в фигуре границы не меняет.
    let inputHandler;
    if (isNote) {
        inputHandler = () => { try { if (updateNoteEditor) updateNoteEditor(); } catch (_) {} };
    } else if (isShape) {
        inputHandler = () => {};
    } else {
        inputHandler = autoSize;
    }

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
    const wrapper = controller.textEditor.wrapper || null;
    const removeDomListeners = controller.textEditor._removeDomListeners || null;
    const placeholderStyleEl = controller.textEditor._phStyle || null;
    const value = textarea.value.trim();
    const commitValue = commit && value.length > 0;
    const objectType = controller.textEditor.objectType || 'text';
    const objectId = controller.textEditor.objectId;
    const position = controller.textEditor.position;
    const properties = controller.textEditor.properties;
    const isNewCreation = controller.textEditor.isNewCreation;
    const initialContent = controller.textEditor.initialContent ?? '';
    const shouldDeleteEmptyNewCreation = !commitValue && !!isNewCreation && !!objectId;

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

    if (typeof removeDomListeners === 'function') {
        try { removeDomListeners(); } catch (_) {}
    }
    if (placeholderStyleEl && typeof placeholderStyleEl.remove === 'function') {
        try { placeholderStyleEl.remove(); } catch (_) {}
    }
    if (wrapper && typeof wrapper.remove === 'function') {
        wrapper.remove();
    } else {
        textarea.remove();
    }
    controller.textEditor = { active: false, objectId: null, textarea: null, world: null, objectType: 'text' };

    // Синхронно с createTextEditorFinalize: UI (в т.ч. панель свойств текста) ждёт окончание редактирования.
    if (objectType === 'note') {
        controller.eventBus.emit(Events.UI.NoteEditEnd, { objectId: objectId || null });
        showNotePixiText(controller, objectId);
    } else {
        controller.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
    }
    updateGlobalTextEditorHandlesLayer();

    if (!commitValue) {
        if (shouldDeleteEmptyNewCreation) {
            controller.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [objectId] });
        }
        return;
    }
    if (objectId == null) {
        controller.eventBus.emit(Events.UI.ToolbarAction, {
            type: objectType,
            id: objectType,
            position: { x: position.x, y: position.y },
            properties: { content: value, fontSize: properties.fontSize },
        });
    } else {
        if (isNewCreation) {
            const oldContent = typeof initialContent === 'string' ? initialContent : '';
            controller.eventBus.emit(Events.Object.ContentChange, {
                objectId,
                oldContent,
                newContent: value,
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
