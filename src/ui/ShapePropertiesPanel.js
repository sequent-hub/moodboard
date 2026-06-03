import { Events } from '../core/events/Events.js';
import {
    sep,
    buildShapeGroup,
    buildFillGroup,
    buildBorderGroup,
    buildRadiusGroup,
    buildTextGroup,
} from './shape-properties/ShapePropertiesPanelDom.js';
import {
    updateControlsFromObject,
    updateBorderStyleBtns,
    setAlign,
    syncSwatches,
    pixiToHex,
} from './shape-properties/ShapePropertiesPanelSync.js';
import './styles/shape-properties-panel.css';

/**
 * ShapePropertiesPanel — плавающая панель свойств выделенной фигуры.
 * Показывается только при одиночном выделении объекта типа 'shape'.
 * Все изменения эмитятся через Events.Object.StateChanged.
 * Undo/redo обеспечивает UpdateShapeStyleCommand (фаза 2).
 */
export class ShapePropertiesPanel {
    constructor(eventBus, container, core = null) {
        this.eventBus  = eventBus;
        this.container = container;
        this.core      = core;
        this.panel     = null;
        this.currentId = null;

        // Единственный открытый поповер (только один одновременно)
        this._openPopoverEl = null;
        this._boundDocClick = this._onDocumentClick.bind(this);

        this._attachEvents();
        this._createPanel();
    }

    // ── Публичное API ──────────────────────────────────────────────────────────

    updateFromSelection() {
        const ids = this.core?.selectTool
            ? Array.from(this.core.selectTool.selectedObjects || [])
            : [];

        if (!ids || ids.length !== 1) { this.hide(); return; }

        const id = ids[0];
        if (this.currentId === id && this.panel && this.panel.style.display !== 'none') return;

        const pixi    = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        const isShape = !!(pixi && pixi._mb && pixi._mb.type === 'shape');

        if (isShape) { this.showFor(id); } else { this.hide(); }
    }

    showFor(objectId) {
        this.currentId = objectId;
        if (this.panel) {
            this.panel.style.display = 'flex';
            this.reposition();
            this._updateControlsFromObject();
        }
    }

    hide() {
        this.currentId = null;
        if (this.panel) this.panel.style.display = 'none';
        this._closePopover();
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') return;

        const ids = this.core?.selectTool
            ? Array.from(this.core.selectTool.selectedObjects || [])
            : [];
        if (!ids.includes(this.currentId)) { this.hide(); return; }

        const posData  = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (!posData.position || !sizeData.size) return;

        const worldLayer  = this.core?.pixi?.worldLayer;
        const scale       = worldLayer?.scale?.x || 1;
        const worldX      = worldLayer?.x || 0;
        const worldY      = worldLayer?.y || 0;

        const screenX      = posData.position.x * scale + worldX;
        const screenY      = posData.position.y * scale + worldY;
        const objectWidth  = sizeData.size.width  * scale;
        const objectHeight = sizeData.size.height * scale;

        const panelW = this.panel.offsetWidth  || 480;
        const panelH = this.panel.offsetHeight || 80;
        let panelX = screenX + (objectWidth  / 2) - (panelW / 2);
        let panelY = screenY - panelH - 16;

        if (panelY < 0) panelY = screenY + objectHeight + 16;

        const cw = this.container.offsetWidth || window.innerWidth;
        panelX = Math.max(8, Math.min(panelX, cw - panelW - 8));
        panelY = Math.max(8, panelY);

        this.panel.style.left = `${Math.round(panelX)}px`;
        this.panel.style.top  = `${Math.round(panelY)}px`;
    }

    destroy() {
        this._closePopover();
        this._cancelRaf();

        if (this._handlers && this.eventBus?.off) {
            const H = this._handlers;
            this.eventBus.off(Events.Tool.SelectionAdd,       H.onSelectionAdd);
            this.eventBus.off(Events.Tool.SelectionRemove,    H.onSelectionRemove);
            this.eventBus.off(Events.Tool.SelectionClear,     H.onSelectionClear);
            this.eventBus.off(Events.Object.Deleted,          H.onDeleted);
            this.eventBus.off(Events.Tool.DragStart,          H.onDragStart);
            this.eventBus.off(Events.Tool.DragUpdate,         H.onDragUpdate);
            this.eventBus.off(Events.Tool.DragEnd,            H.onDragEnd);
            this.eventBus.off(Events.Tool.GroupDragStart,     H.onGroupDragStart);
            this.eventBus.off(Events.Tool.GroupDragUpdate,    H.onGroupDragUpdate);
            this.eventBus.off(Events.Tool.GroupDragEnd,       H.onGroupDragEnd);
            this.eventBus.off(Events.Tool.ResizeUpdate,       H.onResizeUpdate);
            this.eventBus.off(Events.Tool.RotateUpdate,       H.onRotateUpdate);
            this.eventBus.off(Events.UI.ZoomPercent,          H.onZoom);
            this.eventBus.off(Events.Tool.PanUpdate,          H.onPan);
            this.eventBus.off(Events.Tool.Activated,          H.onActivated);
            this.eventBus.off(Events.Object.StateChanged,     H.onStateChanged);
            this.eventBus.off(Events.History.Changed,         H.onHistoryChanged);
            this.eventBus.off(Events.Object.TransformUpdated, H.onTransformUpdated);
            this._handlers = null;
        }
        document.removeEventListener('click', this._boundDocClick);

        if (this.panel?.parentNode) this.panel.parentNode.removeChild(this.panel);
        this.panel     = null;
        this.currentId = null;
    }

    // ── Делегаты для подмодуля Sync ────────────────────────────────────────────

    _updateControlsFromObject() { updateControlsFromObject(this); }
    _updateBorderStyleBtns(v)   { updateBorderStyleBtns(this, v); }
    _setAlign(v)                 { setAlign(this, v); }
    _syncSwatches(key, hex)      { syncSwatches(this[key], hex); }
    _pixiToHex(pixi)             { return pixiToHex(pixi); }

    // ── Подписки ───────────────────────────────────────────────────────────────

    _attachEvents() {
        const H = this._handlers = {};

        H.onSelectionAdd    = () => this.updateFromSelection();
        H.onSelectionRemove = () => this.updateFromSelection();
        H.onSelectionClear  = () => this.hide();
        H.onDeleted         = (objectId) => {
            if (this.currentId && objectId === this.currentId) this.hide();
        };
        H.onDragStart       = () => this.hide();
        H.onDragUpdate      = () => this._repositionThrottled();
        H.onDragEnd         = () => this.updateFromSelection();
        H.onGroupDragStart  = () => this.hide();
        H.onGroupDragUpdate = () => this._repositionThrottled();
        H.onGroupDragEnd    = () => this.updateFromSelection();
        H.onResizeUpdate    = () => this._repositionThrottled();
        H.onRotateUpdate    = () => this._repositionThrottled();
        H.onZoom            = () => { if (this.currentId) this._repositionThrottled(); };
        H.onPan             = () => { if (this.currentId) this._repositionThrottled(); };
        H.onActivated       = ({ tool }) => { if (tool !== 'select') this.hide(); };
        H.onStateChanged    = ({ objectId }) => {
            if (this.currentId && objectId === this.currentId &&
                this.panel?.style.display !== 'none') {
                this._updateControlsFromObject();
            }
        };
        H.onHistoryChanged  = () => {
            if (this.currentId && this.panel?.style.display !== 'none') {
                this._updateControlsFromObject();
            }
        };
        H.onTransformUpdated = ({ objectId }) => {
            if (this.currentId && objectId === this.currentId &&
                this.panel?.style.display !== 'none') {
                this._repositionThrottled();
            }
        };

        this.eventBus.on(Events.Tool.SelectionAdd,       H.onSelectionAdd);
        this.eventBus.on(Events.Tool.SelectionRemove,    H.onSelectionRemove);
        this.eventBus.on(Events.Tool.SelectionClear,     H.onSelectionClear);
        this.eventBus.on(Events.Object.Deleted,          H.onDeleted);
        this.eventBus.on(Events.Tool.DragStart,          H.onDragStart);
        this.eventBus.on(Events.Tool.DragUpdate,         H.onDragUpdate);
        this.eventBus.on(Events.Tool.DragEnd,            H.onDragEnd);
        this.eventBus.on(Events.Tool.GroupDragStart,     H.onGroupDragStart);
        this.eventBus.on(Events.Tool.GroupDragUpdate,    H.onGroupDragUpdate);
        this.eventBus.on(Events.Tool.GroupDragEnd,       H.onGroupDragEnd);
        this.eventBus.on(Events.Tool.ResizeUpdate,       H.onResizeUpdate);
        this.eventBus.on(Events.Tool.RotateUpdate,       H.onRotateUpdate);
        this.eventBus.on(Events.UI.ZoomPercent,          H.onZoom);
        this.eventBus.on(Events.Tool.PanUpdate,          H.onPan);
        this.eventBus.on(Events.Tool.Activated,          H.onActivated);
        this.eventBus.on(Events.Object.StateChanged,     H.onStateChanged);
        this.eventBus.on(Events.History.Changed,         H.onHistoryChanged);
        this.eventBus.on(Events.Object.TransformUpdated, H.onTransformUpdated);
    }

    // ── Построение DOM ─────────────────────────────────────────────────────────

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'shape-properties-panel';
        panel.id = 'shape-properties-panel';

        // Строка 1: форма, заливка, рамка, фаска
        const row1 = document.createElement('div');
        row1.className = 'spp-row';
        row1.appendChild(buildShapeGroup(this));
        row1.appendChild(sep());
        const [fillLabel, fillWrap] = buildFillGroup(this);
        row1.appendChild(fillLabel);
        row1.appendChild(fillWrap);
        row1.appendChild(sep());
        row1.appendChild(buildBorderGroup(this));
        row1.appendChild(sep());
        const [rLabel, rGroup] = buildRadiusGroup(this);
        row1.appendChild(rLabel);
        row1.appendChild(rGroup);
        panel.appendChild(row1);

        // Строка 2: текстовые свойства
        const row2 = document.createElement('div');
        row2.className = 'spp-row';
        buildTextGroup(this).forEach(n => row2.appendChild(n));
        panel.appendChild(row2);

        this.panel = panel;
        this.container.appendChild(panel);
    }

    // ── Поповеры ───────────────────────────────────────────────────────────────

    _togglePopover(popoverEl) {
        if (this._openPopoverEl === popoverEl) {
            this._closePopover();
        } else {
            this._closePopover();
            popoverEl.style.display = 'block';
            this._openPopoverEl = popoverEl;
            setTimeout(() => document.addEventListener('click', this._boundDocClick), 0);
        }
    }

    _closePopover() {
        if (this._openPopoverEl) {
            this._openPopoverEl.style.display = 'none';
            this._openPopoverEl = null;
        }
        document.removeEventListener('click', this._boundDocClick);
    }

    _onDocumentClick(e) {
        if (!this._openPopoverEl || !e.target) return;
        if (!this._openPopoverEl.contains(e.target) && !this.panel.contains(e.target)) {
            this._closePopover();
        }
    }

    // ── Emit helper ────────────────────────────────────────────────────────────

    _emit(payload) {
        if (!this.currentId) return;
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            ...payload,
        });
    }

    // ── RAF-позиционирование ───────────────────────────────────────────────────

    _repositionThrottled() {
        if (this._repositionScheduled) return;
        this._repositionScheduled = true;
        this._repositionRafId = requestAnimationFrame(() => {
            this._repositionScheduled = false;
            this._repositionRafId = null;
            if (this.panel) this.reposition();
        });
    }

    _cancelRaf() {
        if (this._repositionRafId != null) {
            cancelAnimationFrame(this._repositionRafId);
            this._repositionRafId = null;
        }
        this._repositionScheduled = false;
    }
}
