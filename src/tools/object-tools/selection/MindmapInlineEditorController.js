import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    createTextEditorTextarea,
    createTextEditorWrapper,
} from './TextEditorDomFactory.js';
import {
    hideGlobalTextEditorHandlesLayer,
    hideStaticTextDuringEditing,
    showStaticTextAfterEditing,
    updateGlobalTextEditorHandlesLayer,
} from './TextEditorLifecycleRegistry.js';

function applyMindmapCaretFromClick({ create, objectId, object, textarea }) {
    try {
        const click = object?.caretClick || null;
        if (create || !objectId || !click || typeof window === 'undefined') return;
        setTimeout(() => {
            try {
                const el = window.moodboardMindmapHtmlTextLayer?.idToEl?.get?.(objectId) || null;
                const fullText = (typeof textarea.value === 'string') ? textarea.value : '';
                if (!fullText) {
                    textarea.selectionStart = textarea.selectionEnd = 0;
                    return;
                }
                const contentEl = el?.querySelector?.('.mb-text--mindmap-content') || null;
                const textNode = contentEl?.firstChild || null;
                if (!el || !textNode) return;
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
            } catch (_) {}
        }, 0);
    } catch (_) {}
}

/**
 * Изолированный входной контроллер редактирования mindmap.
 * Не зависит от TextInlineEditorController.
 */
export function openMindmapEditor(object, create = false) {
    let objectId;
    let position;
    let properties;

    if (create) {
        const objData = object.object || object;
        objectId = objData.id || null;
        position = objData.position || null;
        properties = objData.properties || {};
    } else {
        objectId = object.id || null;
        position = object.position || null;
        properties = object.properties || {};
    }

    if (this.textEditor.active) {
        if (this.textEditor.objectType === 'file') {
            this._closeFileNameEditor(true);
        } else if (this.textEditor.objectType === 'mindmap') {
            this._closeMindmapEditor(true);
        } else {
            this._closeTextEditor(true);
        }
    }

    if (!position && objectId) {
        const posData = { objectId, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        position = posData.position;
    }
    if (!position) return;

    const view = this.app?.view;
    const world = this.app?.stage?.getChildByName?.('worldLayer');
    if (!view || !world || !view.parentElement) return;

    this.eventBus.emit(Events.UI.TextEditStart, { objectId: objectId || null });
    hideGlobalTextEditorHandlesLayer();

    let objectWidth = properties.width || 220;
    let objectHeight = properties.height || 140;
    if (objectId) {
        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (sizeData.size) {
            objectWidth = sizeData.size.width;
            objectHeight = sizeData.size.height;
        }
    }

    const wrapper = createTextEditorWrapper();
    const textarea = createTextEditorTextarea(properties.content || '');
    wrapper.classList.add('moodboard-text-editor--mindmap-debug');
    textarea.classList.add('moodboard-text-input--mindmap-debug');
    textarea.placeholder = 'Напишите что-нибудь';
    textarea.style.fontFamily = properties.fontFamily || 'Roboto, Arial, sans-serif';
    textarea.style.textAlign = 'center';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordBreak = 'break-word';
    textarea.style.paddingTop = '0px';
    textarea.style.paddingBottom = '0px';
    textarea.setAttribute('rows', '1');

    const containerRect = view.parentElement.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    const offsetLeft = viewRect.left - containerRect.left;
    const offsetTop = viewRect.top - containerRect.top;

    const tl = world.toGlobal(new PIXI.Point(position.x, position.y));
    const br = world.toGlobal(new PIXI.Point(position.x + objectWidth, position.y + objectHeight));
    const left = offsetLeft + tl.x;
    const top = offsetTop + tl.y;
    const width = Math.max(1, br.x - tl.x);
    const height = Math.max(1, br.y - tl.y);

    let targetLeft = Math.round(left);
    let targetTop = Math.round(top);
    let targetWidth = Math.max(1, Math.round(width));
    let targetHeight = Math.max(1, Math.round(height));

    const staticTextEl = (typeof window !== 'undefined')
        ? window.moodboardMindmapHtmlTextLayer?.idToEl?.get?.(objectId)
        : null;
    if (staticTextEl) {
        const cssLeft = parseFloat(staticTextEl.style.left || 'NaN');
        const cssTop = parseFloat(staticTextEl.style.top || 'NaN');
        const cssWidth = parseFloat(staticTextEl.style.width || 'NaN');
        const cssHeight = parseFloat(staticTextEl.style.height || 'NaN');
        if (isFinite(cssLeft)) targetLeft = Math.round(cssLeft);
        if (isFinite(cssTop)) targetTop = Math.round(cssTop);
        if (isFinite(cssWidth) && cssWidth > 0) targetWidth = Math.max(1, Math.round(cssWidth));
        if (isFinite(cssHeight) && cssHeight > 0) targetHeight = Math.max(1, Math.round(cssHeight));

        if (typeof window.getComputedStyle === 'function') {
            const staticStyle = window.getComputedStyle(staticTextEl);
            if (staticStyle?.fontFamily) textarea.style.fontFamily = staticStyle.fontFamily;
            if (staticStyle?.fontSize) textarea.style.fontSize = staticStyle.fontSize;
            if (staticStyle?.lineHeight) textarea.style.lineHeight = staticStyle.lineHeight;
            if (staticStyle?.fontWeight) textarea.style.fontWeight = staticStyle.fontWeight;
            if (staticStyle?.color) textarea.style.color = staticStyle.color;
            if (staticStyle?.paddingLeft) textarea.style.paddingLeft = staticStyle.paddingLeft;
            if (staticStyle?.paddingRight) textarea.style.paddingRight = staticStyle.paddingRight;
        }
    } else if (properties.fontSize) {
        textarea.style.fontSize = `${properties.fontSize}px`;
    }

    wrapper.style.left = `${targetLeft}px`;
    wrapper.style.top = `${targetTop}px`;
    wrapper.style.width = `${targetWidth}px`;
    wrapper.style.height = `${targetHeight}px`;
    wrapper.style.borderRadius = '999px';
    wrapper.style.padding = '0';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    textarea.style.width = '100%';
    textarea.style.height = 'auto';
    textarea.style.minHeight = '0';

    const getSingleLineTextareaHeight = () => {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 1;
        const style = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(style.lineHeight || '0');
        const paddingTop = parseFloat(style.paddingTop || '0');
        const paddingBottom = parseFloat(style.paddingBottom || '0');
        const base = lineHeight + paddingTop + paddingBottom;
        return Math.max(1, Math.ceil(Number.isFinite(base) ? base : 1));
    };

    const alignTextareaLineCenter = () => {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return;
        const wrapperRect = wrapper.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        const textareaStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(textareaStyle.lineHeight || '0');
        const paddingTop = parseFloat(textareaStyle.paddingTop || '0');
        if (!Number.isFinite(lineHeight) || lineHeight <= 0 || !Number.isFinite(paddingTop)) return;
        const desiredLineCenterY = wrapperRect.top + wrapperRect.height / 2;
        const currentLineCenterY = textareaRect.top + paddingTop + lineHeight / 2;
        const deltaY = desiredLineCenterY - currentLineCenterY;
        textarea.style.transform = `translateY(${deltaY}px)`;
    };

    const syncTextareaHeight = (isInitial = false) => {
        textarea.style.height = 'auto';
        const singleLineHeight = getSingleLineTextareaHeight();
        const scrollHeight = Math.max(1, Math.ceil(textarea.scrollHeight));
        const nextHeight = isInitial
            ? singleLineHeight
            : Math.max(singleLineHeight, scrollHeight);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.marginTop = '0px';
        textarea.style.transform = 'translateY(0px)';
        alignTextareaLineCenter();
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => {
                alignTextareaLineCenter();
            });
        }
    };

    textarea.addEventListener('input', syncTextareaHeight);
    wrapper.appendChild(textarea);
    view.parentElement.appendChild(wrapper);
    syncTextareaHeight(true);

    hideStaticTextDuringEditing(this, objectId);

    const initialContent = String(properties.content || '');
    let finalized = false;
    const finalize = (commit) => {
        if (finalized) return;
        finalized = true;

        textarea.removeEventListener('blur', onBlur);
        textarea.removeEventListener('keydown', onKeyDown);
        textarea.removeEventListener('input', syncTextareaHeight);

        const value = textarea.value.trim();
        const commitValue = commit;

        if (objectId) {
            showStaticTextAfterEditing(this, objectId);
        }

        wrapper.remove();
        this.textEditor = {
            active: false,
            objectId: null,
            textarea: null,
            wrapper: null,
            world: null,
            position: null,
            properties: null,
            objectType: 'text',
        };

        this.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
        updateGlobalTextEditorHandlesLayer();

        if (!commitValue) return;

        if (objectId) {
            this.eventBus.emit(Events.Object.ContentChange, {
                objectId,
                oldContent: initialContent,
                newContent: value,
            });
        } else {
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'mindmap',
                id: 'mindmap',
                position: { x: position.x, y: position.y },
                properties: { ...properties, content: value },
            });
        }
    };

    const onBlur = () => finalize(true);
    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            finalize(true);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            finalize(false);
        }
    };

    textarea.addEventListener('blur', onBlur);
    textarea.addEventListener('keydown', onKeyDown);

    this.textEditor = {
        active: true,
        objectId,
        textarea,
        wrapper,
        world,
        position,
        properties: { ...properties },
        objectType: 'mindmap',
        isResizing: false,
        _finalize: finalize,
    };

    textarea.focus();
    applyMindmapCaretFromClick({
        create,
        objectId,
        object,
        textarea,
    });
}

export function closeMindmapEditor(commit) {
    if (!this.textEditor?.active || this.textEditor.objectType !== 'mindmap') return;
    const finalize = this.textEditor._finalize;
    if (typeof finalize === 'function') {
        finalize(commit);
    }
}
