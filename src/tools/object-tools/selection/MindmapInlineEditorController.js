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
        if (typeof window === 'undefined') return;
        setTimeout(() => {
            try {
                textarea.selectionStart = textarea.selectionEnd = 0;
                if (typeof textarea.scrollTop === 'number') textarea.scrollTop = 0;
            } catch (_) {}
        }, 0);
    } catch (_) {}
}

function measureMindmapTextWidthPx(textarea, measureEl) {
    if (!textarea || !measureEl) return 0;
    const text = String(textarea.value || '');
    if (text.length === 0) return 0;

    const style = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
        ? window.getComputedStyle(textarea)
        : null;
    if (style) {
        measureEl.style.fontFamily = style.fontFamily || '';
        measureEl.style.fontSize = style.fontSize || '';
        measureEl.style.fontWeight = style.fontWeight || '';
        measureEl.style.fontStyle = style.fontStyle || '';
        measureEl.style.letterSpacing = style.letterSpacing || 'normal';
    }

    const lines = text.split('\n');
    let maxWidth = 0;
    for (const rawLine of lines) {
        const line = rawLine.length > 0 ? rawLine : ' ';
        measureEl.textContent = line;
        const rect = measureEl.getBoundingClientRect();
        if (Number.isFinite(rect.width)) {
            maxWidth = Math.max(maxWidth, rect.width);
        }
    }
    return Math.max(0, Math.ceil(maxWidth));
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

    let objectWidth = properties.width || 320;
    let objectHeight = properties.height || 125;
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
    textarea.style.fontWeight = '400';
    textarea.style.textAlign = 'left';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordBreak = 'break-word';
    textarea.style.paddingTop = '0px';
    textarea.style.paddingBottom = '0px';
    textarea.setAttribute('rows', '1');

    const measureEl = (typeof document !== 'undefined')
        ? document.createElement('span')
        : null;
    if (measureEl) {
        measureEl.style.position = 'fixed';
        measureEl.style.left = '-99999px';
        measureEl.style.top = '-99999px';
        measureEl.style.visibility = 'hidden';
        measureEl.style.pointerEvents = 'none';
        measureEl.style.whiteSpace = 'pre';
        measureEl.style.margin = '0';
        measureEl.style.padding = '0';
        document.body.appendChild(measureEl);
    }

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

    const initialCssWidth = targetWidth;
    const initialWorldWidth = objectWidth;
    const resizeSession = {
        started: false,
        oldSize: null,
        newSize: null,
        oldPosition: null,
        newPosition: null,
    };

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

    const getEditorHorizontalPaddingPx = () => {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
            return { left: 0, right: 0 };
        }
        const style = window.getComputedStyle(textarea);
        const left = parseFloat(style.paddingLeft || '0');
        const right = parseFloat(style.paddingRight || '0');
        return {
            left: Number.isFinite(left) ? left : 0,
            right: Number.isFinite(right) ? right : 0,
        };
    };

    const getCssToWorldScale = () => {
        const viewRes = (this.app?.renderer?.resolution)
            || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
        const worldScale = world?.scale?.x || 1;
        if (!Number.isFinite(viewRes) || !Number.isFinite(worldScale) || worldScale === 0) {
            return 1;
        }
        return viewRes / worldScale;
    };

    const syncMindmapWidth = () => {
        if (!objectId) return;

        const value = String(textarea.value || '');
        const hasText = value.length > 0;
        const textWidth = hasText ? measureMindmapTextWidthPx(textarea, measureEl) : 0;
        const padding = getEditorHorizontalPaddingPx();
        const nextCssWidth = hasText
            ? Math.max(1, Math.ceil(textWidth + padding.left + padding.right))
            : initialCssWidth;

        const currentCssWidth = Math.max(1, Math.round(parseFloat(wrapper.style.width || `${initialCssWidth}`)));
        if (Math.abs(nextCssWidth - currentCssWidth) <= 0) return;

        wrapper.style.width = `${nextCssWidth}px`;

        const cssToWorld = getCssToWorldScale();
        const nextWorldWidth = hasText
            ? Math.max(1, Math.round(nextCssWidth * cssToWorld))
            : Math.max(1, Math.round(initialWorldWidth));

        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        const currentSize = sizeData.size || { width: initialWorldWidth, height: objectHeight };
        const currentWorldWidth = Math.max(1, Math.round(currentSize.width || initialWorldWidth));
        if (nextWorldWidth === currentWorldWidth) return;

        const posData = { objectId, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        const currentPosition = posData.position || position;

        if (!resizeSession.started) {
            resizeSession.started = true;
            resizeSession.oldSize = { width: currentWorldWidth, height: currentSize.height };
            resizeSession.oldPosition = { x: currentPosition.x, y: currentPosition.y };
        }

        resizeSession.newSize = { width: nextWorldWidth, height: currentSize.height };
        resizeSession.newPosition = { x: currentPosition.x, y: currentPosition.y };

        this.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: objectId,
            size: resizeSession.newSize,
            position: resizeSession.newPosition,
        });
    };

    const onInput = () => {
        syncMindmapWidth();
        syncTextareaHeight(false);
    };

    textarea.addEventListener('input', onInput);
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
        textarea.removeEventListener('input', onInput);

        const value = textarea.value.trim();
        const commitValue = commit;

        if (objectId && resizeSession.started && resizeSession.oldSize && resizeSession.newSize) {
            const widthChanged = resizeSession.oldSize.width !== resizeSession.newSize.width;
            const heightChanged = resizeSession.oldSize.height !== resizeSession.newSize.height;
            if (widthChanged || heightChanged) {
                this.eventBus.emit(Events.Tool.ResizeEnd, {
                    object: objectId,
                    oldSize: resizeSession.oldSize,
                    newSize: resizeSession.newSize,
                    oldPosition: resizeSession.oldPosition,
                    newPosition: resizeSession.newPosition,
                });
            }
        }

        if (objectId) {
            showStaticTextAfterEditing(this, objectId);
        }

        wrapper.remove();
        if (measureEl && typeof measureEl.remove === 'function') {
            measureEl.remove();
        }
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
