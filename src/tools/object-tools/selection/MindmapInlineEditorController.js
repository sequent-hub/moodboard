import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    createTextEditorTextarea,
    createTextEditorWrapper,
} from './TextEditorDomFactory.js';
import {
    registerEditorListeners,
    unregisterEditorListeners,
} from './InlineEditorListenersRegistry.js';
import {
    hideStaticTextDuringEditing,
    showStaticTextAfterEditing,
    updateGlobalTextEditorHandlesLayer,
} from './TextEditorLifecycleRegistry.js';
import { MINDMAP_LAYOUT } from '../../../ui/mindmap/MindmapLayoutConfig.js';

function applyMindmapCaretFromClick({ create, objectId, object, textarea }) {
    try {
        const click = (object && object.caretClick) ? object.caretClick : null;
        if (typeof window === 'undefined') return;
        setTimeout(() => {
            try {
                const fullText = (typeof textarea.value === 'string') ? textarea.value : '';
                if (create || fullText.length === 0) {
                    textarea.selectionStart = textarea.selectionEnd = 0;
                    if (typeof textarea.scrollTop === 'number') textarea.scrollTop = 0;
                    return;
                }

                if (!objectId || !click) {
                    textarea.selectionStart = textarea.selectionEnd = fullText.length;
                    return;
                }

                const contentEl = window.moodboardMindmapHtmlTextLayer?.idToContentEl?.get?.(objectId) || null;
                const textNode = contentEl?.firstChild || null;
                if (!contentEl || !textNode) {
                    textarea.selectionStart = textarea.selectionEnd = fullText.length;
                    return;
                }

                const len = textNode.textContent?.length || 0;
                if (len === 0) {
                    textarea.selectionStart = textarea.selectionEnd = 0;
                    return;
                }

                const doc = contentEl.ownerDocument || document;
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

function measureMindmapTextWidthPx(textarea, measureEl, valueOverride = null) {
    if (!textarea || !measureEl) return 0;
    const rawValue = (typeof valueOverride === 'string') ? valueOverride : textarea.value;
    const text = String(rawValue || '');
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

function normalizeMindmapLineLength(value, maxLineChars = MINDMAP_LAYOUT.maxLineChars) {
    const text = (typeof value === 'string')
        ? value.replace(/\r/g, '').replace(/\n/g, '')
        : '';
    const chunks = [];
    if (text.length === 0) return '';
    for (let i = 0; i < text.length; i += maxLineChars) {
        chunks.push(text.slice(i, i + maxLineChars));
    }
    return chunks.join('\n');
}

function normalizeMindmapValueAndCaret(value, caretPos, maxLineChars = MINDMAP_LAYOUT.maxLineChars) {
    const safeValue = (typeof value === 'string') ? value : '';
    const safeCaret = Number.isFinite(caretPos) ? Math.max(0, Math.min(safeValue.length, caretPos)) : safeValue.length;
    const normalizedValue = normalizeMindmapLineLength(safeValue, maxLineChars);
    const normalizedCaret = normalizeMindmapLineLength(safeValue.slice(0, safeCaret), maxLineChars).length;
    return { normalizedValue, normalizedCaret };
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
    if (objectId && typeof this.setSelection === 'function') {
        this.setSelection([objectId]);
    }
    updateGlobalTextEditorHandlesLayer();

    let objectWidth = properties.width || MINDMAP_LAYOUT.width;
    let objectHeight = properties.height || MINDMAP_LAYOUT.height;
    const maxLineChars = Math.max(1, Math.round(properties.maxLineChars || MINDMAP_LAYOUT.maxLineChars));
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
    textarea.style.whiteSpace = 'pre';
    textarea.style.wordBreak = 'normal';
    textarea.style.overflowWrap = 'normal';
    textarea.style.paddingTop = '0px';
    textarea.style.paddingBottom = '0px';
    textarea.setAttribute('rows', '1');
    textarea.setAttribute('wrap', 'off');

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
    const initialCssHeight = targetHeight;
    const initialWorldWidth = objectWidth;
    const initialWorldHeight = objectHeight;
    const stableBaseWorldWidth = Math.max(
        1,
        Math.round(
            (typeof properties.capsuleBaseWidth === 'number' && properties.capsuleBaseWidth > 0)
                ? properties.capsuleBaseWidth
                : ((typeof objectWidth === 'number' && objectWidth > 0)
                    ? objectWidth
                    : ((typeof properties.width === 'number' && properties.width > 0) ? properties.width : MINDMAP_LAYOUT.width))
        )
    );
    const stableBaseWorldHeight = Math.max(
        1,
        Math.round(
            (typeof properties.capsuleBaseHeight === 'number' && properties.capsuleBaseHeight > 0)
                ? properties.capsuleBaseHeight
                : ((typeof objectHeight === 'number' && objectHeight > 0)
                    ? objectHeight
                    : ((typeof properties.height === 'number' && properties.height > 0) ? properties.height : MINDMAP_LAYOUT.height))
        )
    );
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

    let baselineLineInset = null;

    const alignTextareaLineTop = () => {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return;
        const wrapperRect = wrapper.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        const textareaStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(textareaStyle.lineHeight || '0');
        const paddingTop = parseFloat(textareaStyle.paddingTop || '0');
        if (!Number.isFinite(lineHeight) || lineHeight <= 0 || !Number.isFinite(paddingTop)) return;
        const currentLineTopY = textareaRect.top + paddingTop;
        if (!Number.isFinite(currentLineTopY)) return;
        if (!Number.isFinite(baselineLineInset)) {
            baselineLineInset = currentLineTopY - wrapperRect.top;
        }
        const desiredLineTopY = wrapperRect.top + baselineLineInset;
        const deltaY = desiredLineTopY - currentLineTopY;
        textarea.style.transform = `translateY(${deltaY}px)`;
    };

    const syncTextareaHeight = () => {
        textarea.style.height = 'auto';
        const singleLineHeight = getSingleLineTextareaHeight();
        const scrollHeight = Math.max(1, Math.ceil(textarea.scrollHeight));
        const nextHeight = Math.max(singleLineHeight, scrollHeight);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.marginTop = '0px';
        textarea.style.transform = 'translateY(0px)';
        alignTextareaLineTop();
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => {
                alignTextareaLineTop();
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

    const getWorldToCssScale = () => {
        const cssToWorld = getCssToWorldScale();
        if (!Number.isFinite(cssToWorld) || cssToWorld === 0) return 1;
        return 1 / cssToWorld;
    };

    const getEditorLineCount = () => {
        const value = String(textarea.value || '');
        return Math.max(1, value.split('\n').length);
    };

    const getEditorLineHeightPx = () => {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 1;
        const style = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(style.lineHeight || '0');
        return Math.max(1, Math.ceil(Number.isFinite(lineHeight) ? lineHeight : 1));
    };

    const shouldAnchorRightEdge = String(properties?.mindmap?.side || '') === 'left';

    const syncMindmapSize = () => {
        if (!objectId) return;

        const value = String(textarea.value || '');
        const hasText = value.length > 0;
        const textWidth = hasText ? measureMindmapTextWidthPx(textarea, measureEl) : 0;
        const padding = getEditorHorizontalPaddingPx();
        const placeholderWidth = measureMindmapTextWidthPx(textarea, measureEl, textarea.placeholder || '');
        const baseCssWidth = Math.max(1, Math.round(stableBaseWorldWidth * getWorldToCssScale()));
        const placeholderCssWidth = Math.max(1, Math.ceil(placeholderWidth + padding.left + padding.right));
        const nextCssWidth = hasText
            ? Math.max(1, Math.ceil(textWidth + padding.left + padding.right))
            : Math.max(baseCssWidth, placeholderCssWidth);
        const lineCount = getEditorLineCount();
        const lineHeightPx = getEditorLineHeightPx();
        const baseCssHeight = Math.max(1, Math.round(stableBaseWorldHeight * getWorldToCssScale()));
        const nextCssHeight = Math.max(1, Math.ceil(baseCssHeight + (Math.max(1, lineCount) - 1) * lineHeightPx));

        const currentCssWidth = Math.max(1, Math.round(parseFloat(wrapper.style.width || `${initialCssWidth}`)));
        const currentCssHeight = Math.max(1, Math.round(parseFloat(wrapper.style.height || `${initialCssHeight}`)));
        const widthChangedCss = nextCssWidth !== currentCssWidth;
        const heightChangedCss = nextCssHeight !== currentCssHeight;
        if (!widthChangedCss && !heightChangedCss) return;

        const currentCssLeft = Math.round(parseFloat(wrapper.style.left || '0'));
        const nextCssLeft = shouldAnchorRightEdge
            ? (currentCssLeft + (currentCssWidth - nextCssWidth))
            : currentCssLeft;

        if (widthChangedCss) {
            wrapper.style.width = `${nextCssWidth}px`;
            if (shouldAnchorRightEdge) {
                wrapper.style.left = `${nextCssLeft}px`;
            }
        }
        if (heightChangedCss) wrapper.style.height = `${nextCssHeight}px`;

        const cssToWorld = getCssToWorldScale();
        const nextWorldWidth = Math.max(1, Math.round(nextCssWidth * cssToWorld));
        const nextWorldHeight = Math.max(1, Math.round(nextCssHeight * cssToWorld));

        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        const currentSize = sizeData.size || { width: initialWorldWidth, height: objectHeight };
        const currentWorldWidth = Math.max(1, Math.round(currentSize.width || initialWorldWidth));
        const currentWorldHeight = Math.max(1, Math.round(currentSize.height || initialWorldHeight));
        const widthChangedWorld = nextWorldWidth !== currentWorldWidth;
        const heightChangedWorld = nextWorldHeight !== currentWorldHeight;
        if (!widthChangedWorld && !heightChangedWorld) return;

        const posData = { objectId, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        const currentPosition = posData.position || position;

        if (!resizeSession.started) {
            resizeSession.started = true;
            resizeSession.oldSize = { width: currentWorldWidth, height: currentWorldHeight };
            resizeSession.oldPosition = { x: currentPosition.x, y: currentPosition.y };
        }

        const nextWorldPositionX = shouldAnchorRightEdge
            ? Math.round(currentPosition.x + (currentWorldWidth - nextWorldWidth))
            : Math.round(currentPosition.x);
        resizeSession.newSize = { width: nextWorldWidth, height: nextWorldHeight };
        resizeSession.newPosition = { x: nextWorldPositionX, y: Math.round(currentPosition.y) };

        this.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: objectId,
            size: resizeSession.newSize,
            position: resizeSession.newPosition,
        });
    };

    const onInput = () => {
        const { normalizedValue, normalizedCaret } = normalizeMindmapValueAndCaret(
            textarea.value,
            textarea.selectionStart,
            maxLineChars
        );
        if (normalizedValue !== textarea.value) {
            textarea.value = normalizedValue;
            textarea.selectionStart = textarea.selectionEnd = normalizedCaret;
        }
        syncMindmapSize();
        syncTextareaHeight();
    };

    textarea.addEventListener('input', onInput);
    wrapper.appendChild(textarea);
    view.parentElement.appendChild(wrapper);
    syncTextareaHeight();

    hideStaticTextDuringEditing(this, objectId);

    const syncEditorBoundsToObject = () => {
        if (!objectId || !wrapper || !view || !view.parentElement || !world) return;
        const staticEl = (typeof window !== 'undefined')
            ? window.moodboardMindmapHtmlTextLayer?.idToEl?.get?.(objectId)
            : null;
        if (staticEl) {
            const cssLeft = parseFloat(staticEl.style.left || 'NaN');
            const cssTop = parseFloat(staticEl.style.top || 'NaN');
            const cssWidth = parseFloat(staticEl.style.width || 'NaN');
            const cssHeight = parseFloat(staticEl.style.height || 'NaN');
            if (Number.isFinite(cssLeft)) wrapper.style.left = `${Math.round(cssLeft)}px`;
            if (Number.isFinite(cssTop)) wrapper.style.top = `${Math.round(cssTop)}px`;
            if (Number.isFinite(cssWidth) && cssWidth > 0) wrapper.style.width = `${Math.max(1, Math.round(cssWidth))}px`;
            if (Number.isFinite(cssHeight) && cssHeight > 0) wrapper.style.height = `${Math.max(1, Math.round(cssHeight))}px`;
            syncTextareaHeight();
            return;
        }

        const posData = { objectId, position: null };
        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        const pos = posData.position || position;
        const size = sizeData.size || { width: objectWidth, height: objectHeight };

        const containerRectNow = view.parentElement.getBoundingClientRect();
        const viewRectNow = view.getBoundingClientRect();
        const offsetLeftNow = viewRectNow.left - containerRectNow.left;
        const offsetTopNow = viewRectNow.top - containerRectNow.top;
        const tlNow = world.toGlobal(new PIXI.Point(pos.x, pos.y));
        const brNow = world.toGlobal(new PIXI.Point(pos.x + size.width, pos.y + size.height));
        wrapper.style.left = `${Math.round(offsetLeftNow + tlNow.x)}px`;
        wrapper.style.top = `${Math.round(offsetTopNow + tlNow.y)}px`;
        wrapper.style.width = `${Math.max(1, Math.round(brNow.x - tlNow.x))}px`;
        wrapper.style.height = `${Math.max(1, Math.round(brNow.y - tlNow.y))}px`;
        syncTextareaHeight();
    };

    const onObjectSync = (data) => {
        const changedId = data?.objectId || data?.object || data;
        if (changedId !== objectId) return;
        syncEditorBoundsToObject();
    };
    const onGroupSync = (data) => {
        const ids = Array.isArray(data?.objects) ? data.objects : [];
        if (!ids.includes(objectId)) return;
        syncEditorBoundsToObject();
    };
    const editorListeners = registerEditorListeners(this.eventBus, [
        [Events.Object.TransformUpdated, onObjectSync],
        [Events.Tool.DragUpdate, onObjectSync],
        [Events.Tool.ResizeUpdate, onObjectSync],
        [Events.Tool.RotateUpdate, onObjectSync],
        [Events.Tool.GroupDragUpdate, onGroupSync],
        [Events.Tool.GroupResizeUpdate, onGroupSync],
        [Events.Tool.GroupRotateUpdate, onGroupSync],
        [Events.UI.ZoomPercent, () => syncEditorBoundsToObject()],
        [Events.Tool.PanUpdate, () => syncEditorBoundsToObject()],
    ]);

    const initialContent = String(properties.content || '');
    let finalized = false;
    const finalize = (commit) => {
        if (finalized) return;
        finalized = true;

        unregisterEditorListeners(this.eventBus, editorListeners);

        textarea.removeEventListener('blur', onBlur);
        textarea.removeEventListener('keydown', onKeyDown);
        textarea.removeEventListener('input', onInput);

        const value = normalizeMindmapLineLength(textarea.value, maxLineChars).trim();
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
            const resolveCurrentObjectBox = () => {
                const sizeData = { objectId, size: null };
                const posData = { objectId, position: null };
                this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
                this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
                return {
                    size: {
                        width: Math.max(1, Math.round(sizeData?.size?.width || objectWidth || initialWorldWidth || MINDMAP_LAYOUT.width)),
                        height: Math.max(1, Math.round(sizeData?.size?.height || objectHeight || initialWorldHeight || MINDMAP_LAYOUT.height)),
                    },
                    position: {
                        x: Math.round(posData?.position?.x || position?.x || 0),
                        y: Math.round(posData?.position?.y || position?.y || 0),
                    },
                };
            };
            const currentBox = resolveCurrentObjectBox();
            const oldBox = (resizeSession.started && resizeSession.oldSize)
                ? {
                    size: {
                        width: Math.max(1, Math.round(resizeSession.oldSize.width)),
                        height: Math.max(1, Math.round(resizeSession.oldSize.height)),
                    },
                    position: {
                        x: Math.round(resizeSession.oldPosition?.x || currentBox.position.x),
                        y: Math.round(resizeSession.oldPosition?.y || currentBox.position.y),
                    },
                }
                : currentBox;
            const newBox = (resizeSession.started && resizeSession.newSize)
                ? {
                    size: {
                        width: Math.max(1, Math.round(resizeSession.newSize.width)),
                        height: Math.max(1, Math.round(resizeSession.newSize.height)),
                    },
                    position: {
                        x: Math.round(resizeSession.newPosition?.x || currentBox.position.x),
                        y: Math.round(resizeSession.newPosition?.y || currentBox.position.y),
                    },
                }
                : currentBox;
            this.eventBus.emit(Events.Object.ContentChange, {
                objectId,
                oldContent: initialContent,
                newContent: value,
                oldSize: oldBox.size,
                oldPosition: oldBox.position,
                newSize: newBox.size,
                newPosition: newBox.position,
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
        _listeners: editorListeners,
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
