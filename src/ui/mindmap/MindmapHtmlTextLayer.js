import { Events } from '../../core/events/Events.js';
import * as PIXI from 'pixi.js';
import { MindmapTextOverlayAdapter } from './MindmapTextOverlayAdapter.js';

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
        this.overlayAdapter = new MindmapTextOverlayAdapter();
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
            const el = this.idToEl.get(objectId);
            if (el && typeof content === 'string') {
                el.textContent = content;
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
        });

        this.eventBus.on(Events.UI.ZoomPercent, () => this.updateAll());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.updateAll());
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

        this.rebuildFromState();
        this.updateAll();
    }

    destroy() {
        if (this.layer) this.layer.remove();
        this.layer = null;
        this.idToEl.clear();
        this.idToCleanup.clear();
    }

    rebuildFromState() {
        if (!this.core?.state) return;
        const objects = this.core.state.state.objects || [];
        objects.forEach((objectData) => {
            if (!this.overlayAdapter.supportsObject(objectData)) return;
            this._ensureTextEl(objectData.id, objectData);
        });
        this.updateAll();
    }

    _ensureTextEl(objectId, objectData) {
        if (!this.layer || !objectId) return;
        if (this.idToEl.has(objectId)) return;

        const el = document.createElement('div');
        el.className = 'mb-text';
        el.dataset.id = objectId;

        const fontFamily = this.overlayAdapter.getDefaultFontFamily(objectData);
        const color = objectData.color || objectData.properties?.color || objectData.properties?.textColor || '#000000';
        const baseFontSize = objectData.fontSize || objectData.properties?.fontSize || 20;
        const baseLineHeight = Math.round(baseFontSize * 1.24);

        el.style.color = color;
        el.style.fontFamily = fontFamily;
        el.style.lineHeight = `${baseLineHeight}px`;
        el.style.whiteSpace = 'pre-wrap';
        el.style.wordBreak = 'break-word';
        el.style.overflow = 'hidden';
        el.style.letterSpacing = '0px';
        el.style.fontKerning = 'normal';
        el.style.textRendering = 'optimizeLegibility';
        el.style.padding = '0';

        this.overlayAdapter.applyElementStyles(el);

        el.textContent = objectData.content || objectData.properties?.content || '';
        el.dataset.baseFontSize = String(baseFontSize);
        el.dataset.baseW = String(Math.max(1, objectData.width || objectData.properties?.width || 220));
        el.dataset.baseH = String(Math.max(1, objectData.height || objectData.properties?.height || 140));

        const cleanup = this.overlayAdapter.attachEditOnClick({
            el,
            objectId,
            objectData,
            eventBus: this.eventBus,
        });
        this.idToCleanup.set(objectId, cleanup);

        this.layer.appendChild(el);
        this.idToEl.set(objectId, el);
    }

    _removeTextEl(objectId) {
        const el = this.idToEl.get(objectId);
        const cleanup = this.idToCleanup.get(objectId);
        if (typeof cleanup === 'function') cleanup();
        if (el) el.remove();
        this.idToEl.delete(objectId);
        this.idToCleanup.delete(objectId);
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

        const baseFS = parseFloat(el.dataset.baseFontSize || '20') || 20;
        const baseW = parseFloat(el.dataset.baseW || '220') || 220;
        const baseH = parseFloat(el.dataset.baseH || '140') || 140;
        const scaleX = w && baseW ? (w / baseW) : 1;
        const scaleY = h && baseH ? (h / baseH) : 1;
        const worldScale = world?.scale?.x || 1;
        const sCss = worldScale / res;
        const fontSizePx = Math.max(1, baseFS * Math.min(scaleX, scaleY) * sCss);
        el.style.fontSize = `${fontSizePx}px`;
        el.style.lineHeight = `${Math.round(fontSizePx * 1.24)}px`;

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
            el.textContent = content;
        }

        el.style.transformOrigin = 'center center';
        el.style.transform = angle ? `rotate(${angle}deg)` : '';
    }
}
