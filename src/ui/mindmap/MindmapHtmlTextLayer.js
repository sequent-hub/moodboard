import { Events } from '../../core/events/Events.js';
import gsap from 'gsap';
import * as PIXI from 'pixi.js';
import { MindmapTextOverlayAdapter } from './MindmapTextOverlayAdapter.js';
import { MINDMAP_LAYOUT, MINDMAP_AUTOFIT } from './MindmapLayoutConfig.js';

const MINDMAP_PLACEHOLDER = 'Напишите что-нибудь';
const MINDMAP_MAX_LINE_CHARS = MINDMAP_LAYOUT.maxLineChars;

// Hover-lift канон «маленькие» — идентичен HtmlTextLayer.js
const MM_HOVER_TY  = -2;
const MM_HOVER_SC  = 1.06;
const MM_HOVER_DUR = 0.22;
const MM_BACK_DUR  = 0.18;
const mmPrefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function normalizeMindmapLineLength(value, maxLineChars = MINDMAP_MAX_LINE_CHARS) {
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

/**
 * Отдельный HTML-слой только для текста mindmap-объектов.
 * Изолирован от общего HtmlTextLayer (text/simple-text).
 */
export class MindmapHtmlTextLayer {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.idToEl = new Map();
        this.idToCleanup = new Map();
        this.idToContentEl = new Map();
        this.overlayAdapter = new MindmapTextOverlayAdapter();
        // hover-lift state: objectId → { ty: 0, sc: 1 }
        this._hoverStates = new Map();
        this._hoveredId = null;
        this._selectedIds = new Set();
        this._pixiHoverHandlers = new Map();
        this._transformActive = false;
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'moodboard-html-layer moodboard-html-layer--mindmap';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 10,
        });
        this.container.appendChild(this.layer);

        this.eventBus.on(Events.Object.Created, ({ objectId, objectData }) => {
            if (!this.overlayAdapter.supportsObject(objectData)) return;
            this._ensureTextEl(objectId, objectData);
            this.updateOne(objectId);
            this._scheduleAutoFit(objectId);
        });

        this.eventBus.on(Events.Object.Deleted, ({ objectId }) => {
            this._removeTextEl(objectId);
        });

        this.eventBus.on(Events.Object.TransformUpdated, ({ objectId }) => {
            this.updateOne(objectId);
        });

        this.eventBus.on(Events.Tool.HideObjectText, ({ objectId }) => {
            const el = this.idToEl.get(objectId);
            if (el) el.style.visibility = 'hidden';
        });
        this.eventBus.on(Events.Tool.ShowObjectText, ({ objectId }) => {
            const el = this.idToEl.get(objectId);
            if (el) el.style.visibility = '';
        });

        this.eventBus.on(Events.Tool.UpdateObjectContent, ({ objectId, content }) => {
            const contentEl = this.idToContentEl.get(objectId);
            const containerEl = this.idToEl.get(objectId);
            if (contentEl && containerEl && typeof content === 'string') {
                this._applyContentValue(containerEl, contentEl, content);
                this._autoFitNodeWidth(objectId);
            }
        });

        this.eventBus.on(Events.Object.StateChanged, ({ objectId, updates }) => {
            const el = this.idToEl.get(objectId);
            if (!el || !updates) return;
            const nextFont = updates.fontFamily || updates.properties?.fontFamily;
            if (nextFont) {
                el.style.fontFamily = nextFont;
            }
            if (updates.fontSize) {
                el.dataset.baseFontSize = String(updates.fontSize);
            }
            if (updates.color || updates.properties?.textColor) {
                el.style.color = updates.color || updates.properties?.textColor;
            }
            this.updateOne(objectId);
            this._autoFitNodeWidth(objectId);
        });

        this.eventBus.on(Events.UI.ZoomPercent, () => this.updateAll());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.updateAll());
        this.eventBus.on(Events.UI.TextEditEnd, ({ objectId }) => {
            if (objectId && this.idToEl.has(objectId)) this._scheduleAutoFit(objectId);
        });
        this.eventBus.on(Events.Tool.DragUpdate, ({ object }) => this.updateOne(object));
        this.eventBus.on(Events.Tool.ResizeUpdate, ({ object }) => this.updateOne(object));
        this.eventBus.on(Events.Tool.RotateUpdate, ({ object }) => this.updateOne(object));
        this.eventBus.on(Events.Tool.GroupDragUpdate, ({ objects }) => {
            (Array.isArray(objects) ? objects : []).forEach((id) => this.updateOne(id));
        });
        this.eventBus.on(Events.Tool.GroupResizeUpdate, ({ objects }) => {
            (Array.isArray(objects) ? objects : []).forEach((id) => this.updateOne(id));
        });
        this.eventBus.on(Events.Tool.GroupRotateUpdate, ({ objects }) => {
            (Array.isArray(objects) ? objects : []).forEach((id) => this.updateOne(id));
        });

        // Блокировка hover во время drag/resize/rotate (канон HtmlTextLayer)
        this._onTransformStart = () => {
            this._transformActive = true;
            if (this._hoveredId) {
                const id = this._hoveredId;
                this._hoveredId = null;
                this._animHoverOut(id);
            }
        };
        this._onTransformEnd = () => { this._transformActive = false; };
        this.eventBus.on(Events.Tool.DragStart,        this._onTransformStart);
        this.eventBus.on(Events.Tool.GroupDragStart,   this._onTransformStart);
        this.eventBus.on(Events.Tool.DragEnd,          this._onTransformEnd);
        this.eventBus.on(Events.Tool.GroupDragEnd,     this._onTransformEnd);
        this.eventBus.on(Events.Tool.ResizeStart,      this._onTransformStart);
        this.eventBus.on(Events.Tool.GroupResizeStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.ResizeEnd,        this._onTransformEnd);
        this.eventBus.on(Events.Tool.GroupResizeEnd,   this._onTransformEnd);
        this.eventBus.on(Events.Tool.RotateStart,      this._onTransformStart);
        this.eventBus.on(Events.Tool.GroupRotateStart, this._onTransformStart);
        this.eventBus.on(Events.Tool.RotateEnd,        this._onTransformEnd);
        this.eventBus.on(Events.Tool.GroupRotateEnd,   this._onTransformEnd);

        // Выделение: не показываем hover у выделенных узлов
        this._onSelectionAdd = (data) => {
            const id = data?.object ?? data?.objectId ?? data?.id ?? data;
            if (id) {
                this._selectedIds.add(String(id));
                if (this._hoveredId === String(id)) {
                    this._hoveredId = null;
                    this._animHoverOut(String(id));
                }
            }
        };
        this._onSelectionRemove = (data) => {
            const id = data?.object ?? data?.objectId ?? data?.id ?? data;
            if (id) this._selectedIds.delete(String(id));
        };
        this._onSelectionClear = () => { this._selectedIds.clear(); };
        this.eventBus.on(Events.Tool.SelectionAdd,    this._onSelectionAdd);
        this.eventBus.on(Events.Tool.SelectionRemove, this._onSelectionRemove);
        this.eventBus.on(Events.Tool.SelectionClear,  this._onSelectionClear);

        this.rebuildFromState();
        this.updateAll();
    }

    destroy() {
        for (const [id, state] of this._hoverStates) {
            gsap.killTweensOf(state);
            this._detachPixiHover(id);
        }
        this._hoverStates.clear();
        this._pixiHoverHandlers.clear();
        this._selectedIds.clear();
        if (this.layer) this.layer.remove();
        this.layer = null;
        this.idToEl.clear();
        this.idToCleanup.clear();
        this.idToContentEl.clear();
    }

    rebuildFromState() {
        if (!this.core?.state) return;
        const objects = this.core.state.state.objects || [];
        objects.forEach((objectData) => {
            if (!this.overlayAdapter.supportsObject(objectData)) return;
            this._ensureTextEl(objectData.id, objectData);
        });
        this.updateAll();
        this._scheduleAutoFitAll();
    }

    _ensureTextEl(objectId, objectData) {
        if (!this.layer || !objectId) return;
        if (this.idToEl.has(objectId)) return;

        const el = document.createElement('div');
        el.className = 'mb-text';
        el.dataset.id = objectId;
        const contentEl = document.createElement('span');
        contentEl.className = 'mb-text--mindmap-content';

        const fontFamily = this.overlayAdapter.getDefaultFontFamily(objectData);
        const color = objectData.color || objectData.properties?.color || objectData.properties?.textColor || '#212121';
        const baseFontSize = objectData.fontSize || objectData.properties?.fontSize || MINDMAP_LAYOUT.fontSize;
        const baseLineHeight = Math.round(baseFontSize * 1.24);
        const paddingX = Math.max(0, Math.round(objectData.properties?.paddingX ?? MINDMAP_LAYOUT.paddingX));
        const paddingY = Math.max(0, Math.round(objectData.properties?.paddingY ?? MINDMAP_LAYOUT.paddingY));
        const maxLineChars = Math.max(1, Math.round(objectData.properties?.maxLineChars || MINDMAP_LAYOUT.maxLineChars));

        el.style.color = color;
        el.style.fontFamily = fontFamily;
        el.style.lineHeight = `${baseLineHeight}px`;
        el.style.paddingTop = `${paddingY}px`;
        el.style.paddingBottom = `${paddingY}px`;
        el.style.paddingLeft = `${paddingX}px`;
        el.style.paddingRight = `${paddingX}px`;
        el.style.whiteSpace = 'pre';
        el.style.wordBreak = 'normal';
        el.style.overflowWrap = 'normal';
        el.style.overflow = 'hidden';
        el.style.letterSpacing = '0px';
        el.style.fontKerning = 'normal';
        el.style.textRendering = 'optimizeLegibility';

        this.overlayAdapter.applyElementStyles(el);

        const initialContent = objectData.content || objectData.properties?.content || '';
        this._applyContentValue(el, contentEl, initialContent);
        el.dataset.baseFontSize = String(baseFontSize);
        el.dataset.baseW = String(Math.max(1, objectData.width || objectData.properties?.width || MINDMAP_LAYOUT.width));
        el.dataset.baseH = String(Math.max(1, objectData.height || objectData.properties?.height || MINDMAP_LAYOUT.height));
        el.dataset.basePaddingX = String(paddingX);
        el.dataset.basePaddingY = String(paddingY);
        el.dataset.maxLineChars = String(maxLineChars);

        const cleanup = this.overlayAdapter.attachEditOnClick({
            el,
            targetEl: contentEl,
            objectId,
            objectData,
            eventBus: this.eventBus,
        });
        this.idToCleanup.set(objectId, cleanup);

        this._hoverStates.set(objectId, { ty: 0, sc: 1 });
        el.appendChild(contentEl);
        this.layer.appendChild(el);
        this.idToEl.set(objectId, el);
        this.idToContentEl.set(objectId, contentEl);
    }

    _removeTextEl(objectId) {
        const el = this.idToEl.get(objectId);
        const cleanup = this.idToCleanup.get(objectId);
        if (typeof cleanup === 'function') cleanup();
        if (el) el.remove();
        this._detachPixiHover(objectId);
        const state = this._hoverStates.get(objectId);
        if (state) gsap.killTweensOf(state);
        this._hoverStates.delete(objectId);
        this.idToEl.delete(objectId);
        this.idToCleanup.delete(objectId);
        this.idToContentEl.delete(objectId);
    }

    updateAll() {
        if (!this.core?.pixi) return;
        for (const id of this.idToEl.keys()) this.updateOne(id);
    }

    updateOne(objectId) {
        const el = this.idToEl.get(objectId);
        if (!el || !this.core) return;

        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const res = (this.core?.pixi?.app?.renderer?.resolution) || 1;
        const objectData = (this.core.state.state.objects || []).find((o) => o.id === objectId);
        if (!objectData || objectData.type !== 'mindmap') return;

        const x = objectData.position?.x || 0;
        const y = objectData.position?.y || 0;
        const w = objectData.width || 0;
        const h = objectData.height || 0;

        const pixiObject = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(objectId) : null;
        const angle = (pixiObject && typeof pixiObject.rotation === 'number')
            ? (pixiObject.rotation * 180 / Math.PI)
            : (objectData.rotation || objectData.transform?.rotation || 0);

        const baseFS = parseFloat(el.dataset.baseFontSize || `${MINDMAP_LAYOUT.fontSize}`) || MINDMAP_LAYOUT.fontSize;
        const worldScale = world?.scale?.x || 1;
        const sCss = worldScale / res;
        const fontSizePx = Math.max(1, baseFS * sCss);
        el.style.fontSize = `${fontSizePx}px`;
        el.style.lineHeight = `${Math.round(fontSizePx * 1.24)}px`;
        const basePaddingX = Math.max(
            0,
            Math.round(objectData.properties?.paddingX ?? parseFloat(el.dataset.basePaddingX || `${MINDMAP_LAYOUT.paddingX}`))
        );
        const basePaddingY = Math.max(
            0,
            Math.round(objectData.properties?.paddingY ?? parseFloat(el.dataset.basePaddingY || `${MINDMAP_LAYOUT.paddingY}`))
        );
        const paddingXCss = Math.max(0, Math.round(basePaddingX * sCss));
        const paddingYCss = Math.max(0, Math.round(basePaddingY * sCss));
        el.style.paddingTop = `${paddingYCss}px`;
        el.style.paddingBottom = `${paddingYCss}px`;
        el.style.paddingLeft = `${paddingXCss}px`;
        el.style.paddingRight = `${paddingXCss}px`;

        const worldLayer = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const view = this.core.pixi.app.view;
        if (worldLayer && view && view.parentElement) {
            const containerRect = view.parentElement.getBoundingClientRect();
            const viewRect = view.getBoundingClientRect();
            const offsetLeft = viewRect.left - containerRect.left;
            const offsetTop = viewRect.top - containerRect.top;
            const tl = worldLayer.toGlobal(new PIXI.Point(x, y));
            const br = worldLayer.toGlobal(new PIXI.Point(x + w, y + h));
            el.style.left = `${offsetLeft + tl.x}px`;
            el.style.top = `${offsetTop + tl.y}px`;
            el.style.width = `${Math.max(1, br.x - tl.x)}px`;
            el.style.height = `${Math.max(1, br.y - tl.y)}px`;
        }

        const content = objectData.content || objectData.properties?.content;
        if (typeof content === 'string') {
            const contentEl = this.idToContentEl.get(objectId);
            if (contentEl) {
                this._applyContentValue(el, contentEl, content);
            }
        }

        el.style.transformOrigin = 'center center';
        const hover = this._hoverStates.get(objectId);
        const hoverTy = hover?.ty ?? 0;
        const hoverSc = hover?.sc ?? 1;
        const hoverPart = (Math.abs(hoverTy) > 0.001 || Math.abs(hoverSc - 1) > 0.001)
            ? `translate3d(0, ${hoverTy}px, 0) scale(${hoverSc})`
            : '';
        const rotatePart = angle ? `rotate(${angle}deg)` : '';
        el.style.transform = [hoverPart, rotatePart].filter(Boolean).join(' ');
        this._ensurePixiHover(objectId);
    }

    /** Лениво вешает pointerover/pointerout на PIXI-капсулу узла */
    _ensurePixiHover(objectId) {
        if (this._pixiHoverHandlers.has(objectId)) return;
        const cap = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(objectId) : null;
        if (!cap || typeof cap.on !== 'function') return;
        const onOver = () => this._onPointerOver(objectId);
        const onOut  = () => this._onPointerOut(objectId);
        cap.on('pointerover', onOver);
        cap.on('pointerout',  onOut);
        this._pixiHoverHandlers.set(objectId, { cap, onOver, onOut });
    }

    _detachPixiHover(objectId) {
        const h = this._pixiHoverHandlers.get(objectId);
        if (!h) return;
        try { h.cap.off('pointerover', h.onOver); } catch (_) {}
        try { h.cap.off('pointerout',  h.onOut);  } catch (_) {}
        this._pixiHoverHandlers.delete(objectId);
    }

    _onPointerOver(objectId) {
        if (mmPrefersReducedMotion) return;
        if (this._transformActive) return;
        if (this._selectedIds.has(objectId) || this._selectedIds.has(String(objectId))) return;
        if (this._hoveredId === objectId) return;
        this._hoveredId = objectId;
        this._animHoverIn(objectId);
    }

    _onPointerOut(objectId) {
        if (this._hoveredId === objectId) this._hoveredId = null;
        this._animHoverOut(objectId);
    }

    _animHoverIn(objectId) {
        if (mmPrefersReducedMotion) return;
        const state = this._hoverStates.get(objectId);
        if (!state) return;
        gsap.killTweensOf(state);
        gsap.to(state, {
            ty: MM_HOVER_TY,
            sc: MM_HOVER_SC,
            duration: MM_HOVER_DUR,
            ease: 'hoverLiftSpring',
            onUpdate:  () => this.updateOne(objectId),
            onComplete: () => this.updateOne(objectId),
        });
    }

    _animHoverOut(objectId) {
        const state = this._hoverStates.get(objectId);
        if (!state) return;
        gsap.killTweensOf(state);
        gsap.to(state, {
            ty: 0,
            sc: 1,
            duration: MM_BACK_DUR,
            ease: 'power2.out',
            onUpdate:  () => this.updateOne(objectId),
            onComplete: () => this.updateOne(objectId),
        });
    }

    _applyContentValue(containerEl, contentEl, rawContent) {
        const maxLineChars = Math.max(
            1,
            parseInt(containerEl?.dataset?.maxLineChars || `${MINDMAP_LAYOUT.maxLineChars}`, 10) || MINDMAP_LAYOUT.maxLineChars
        );
        const actual = normalizeMindmapLineLength((typeof rawContent === 'string') ? rawContent : '', maxLineChars);
        const isPlaceholder = actual.trim().length === 0;
        containerEl.dataset.mbContent = actual;
        contentEl.textContent = isPlaceholder ? MINDMAP_PLACEHOLDER : actual;
        contentEl.classList.toggle('is-placeholder', isPlaceholder);
    }

    _scheduleAutoFit(objectId) {
        const doFit = () => this._autoFitNodeWidth(objectId);
        if (typeof document !== 'undefined' && document.fonts?.ready) {
            document.fonts.ready.then(doFit);
        } else {
            doFit();
        }
    }

    _scheduleAutoFitAll() {
        const doFit = () => { for (const id of this.idToEl.keys()) this._autoFitNodeWidth(id); };
        if (typeof document !== 'undefined' && document.fonts?.ready) {
            document.fonts.ready.then(doFit);
        } else {
            doFit();
        }
    }

    _autoFitNodeWidth(objectId) {
        const el = this.idToEl.get(objectId);
        const contentEl = this.idToContentEl.get(objectId);
        if (!el || !contentEl || !this.core) return;
        // Skip while the static element is hidden during inline editing.
        if (el.style.visibility === 'hidden') return;
        try {
            const objectData = (this.core.state.state.objects || []).find(o => o.id === objectId);
            if (!objectData || !objectData.position) return;

            const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
            const res = (this.core?.pixi?.app?.renderer?.resolution) || 1;
            const worldScale = world?.scale?.x || 1;

            // Measure rendered text width via scrollWidth of the <span> (forces layout reflow).
            const scrollWidthCss = contentEl.scrollWidth;
            if (scrollWidthCss <= 0) return;

            const paddingX = Math.max(0, Math.round(
                objectData.properties?.paddingX ?? MINDMAP_LAYOUT.paddingX
            ));
            // css → world: same formula as _autoFitTextHeight in HtmlTextLayer.js
            const contentWorldW = (scrollWidthCss * res) / worldScale;
            const rawWorldW = contentWorldW + 2 * paddingX;

            const level = objectData.properties?.mindmap?.level ?? 0;
            const isRoot = level === 0;
            const minW = isRoot ? MINDMAP_AUTOFIT.ROOT_MIN_WIDTH : MINDMAP_AUTOFIT.CHILD_MIN_WIDTH;
            const maxW = isRoot ? MINDMAP_AUTOFIT.ROOT_MAX_WIDTH : MINDMAP_AUTOFIT.CHILD_MAX_WIDTH;
            const newWorldW = Math.max(minW, Math.min(maxW, Math.round(rawWorldW)));

            // Measure natural height at the fitted width to handle multi-line wrapping.
            const cssFitW = Math.max(1, Math.round(newWorldW * worldScale / res));
            const prevW = el.style.width;
            const prevH = el.style.height;
            el.style.width = `${cssFitW}px`;
            el.style.height = 'auto';
            const scrollHeightCss = Math.max(1, Math.round(el.scrollHeight));
            el.style.width = prevW;
            el.style.height = prevH;
            const newWorldH = Math.max(1, Math.round((scrollHeightCss * res) / worldScale));

            const currentW = Math.round(objectData.width || objectData.properties?.width || MINDMAP_LAYOUT.width);
            const currentH = Math.round(objectData.height || objectData.properties?.height || MINDMAP_LAYOUT.height);
            if (newWorldW === currentW && newWorldH === currentH) return;

            this.core.eventBus.emit(Events.Tool.ResizeUpdate, {
                object: objectId,
                size: { width: newWorldW, height: newWorldH },
                position: objectData.position,
            });
        } catch (_) {}
    }
}
