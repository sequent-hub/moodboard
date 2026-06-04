import { Events } from '../core/events/Events.js';

/**
 * DrawingPropertiesPanel — плавающая панель свойств выделённой линии (рисунка).
 * Появляется при одиночном выделении объекта типа 'drawing'.
 * Позволяет менять толщину и цвет. Изменения эмитятся через Events.Object.StateChanged
 * (применяются в ObjectLifecycleFlow: instance.setStyle + обновление state.properties).
 *
 * Дублирует часть палитры рисования (см. ToolbarPopupsController.createDrawPopup),
 * поэтому переиспользует те же CSS-классы moodboard-draw__*.
 */

const PALETTE = [
    '#111827', '#374151', '#9ca3af', '#d1d5db', '#ffffff',
    '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6',
    '#fca5a5', '#fdba74', '#fde68a', '#86efac', '#93c5fd',
    '#f9a8d4', '#e9d5ff', '#c4b5fd', '#a5f3fc', '#bfdbfe',
];

const MIN_WIDTH = 1;
const MAX_WIDTH = 24;

export class DrawingPropertiesPanel {
    constructor(eventBus, container, core = null) {
        this.eventBus  = eventBus;
        this.container = container;
        this.core      = core;
        this.panel     = null;
        this.currentId = null;

        this._slider      = null;
        this._widthValue  = null;
        this._colorGrid   = null;
        this._customBtn   = null;
        this._colorInput  = null;

        this._attachEvents();
        this._createPanel();
    }

    // ── Публичное API ──────────────────────────────────────────────────────────

    updateFromSelection() {
        const ids = this.core?.selectTool
            ? Array.from(this.core.selectTool.selectedObjects || [])
            : [];

        if (!ids || ids.length !== 1) { this.hide(); return; }

        const id    = ids[0];
        const pixi  = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        const isDrawing = !!(pixi && pixi._mb && pixi._mb.type === 'drawing');

        if (!isDrawing) { this.hide(); return; }

        this.currentId = id;
        if (this.panel) {
            this.panel.style.display = 'flex';
            this._updateControlsFromObject();
            this.reposition();
        }
    }

    hide() {
        this.currentId = null;
        if (this.panel) this.panel.style.display = 'none';
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

        const worldLayer = this.core?.pixi?.worldLayer;
        const scale  = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        const screenX      = posData.position.x * scale + worldX;
        const screenY      = posData.position.y * scale + worldY;
        const objectWidth  = sizeData.size.width  * scale;
        const objectHeight = sizeData.size.height * scale;

        const panelW = this.panel.offsetWidth  || 200;
        const panelH = this.panel.offsetHeight || 120;
        let panelX = screenX + (objectWidth / 2) - (panelW / 2);
        let panelY = screenY - panelH - 16;

        if (panelY < 0) panelY = screenY + objectHeight + 16;

        const cw = this.container.offsetWidth || window.innerWidth;
        panelX = Math.max(8, Math.min(panelX, cw - panelW - 8));
        panelY = Math.max(8, panelY);

        this.panel.style.left = `${Math.round(panelX)}px`;
        this.panel.style.top  = `${Math.round(panelY)}px`;
    }

    destroy() {
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
            this.eventBus.off(Events.Viewport.Changed,        H.onViewportChanged);
            this.eventBus.off(Events.Tool.Activated,          H.onActivated);
            this.eventBus.off(Events.Object.TransformUpdated, H.onTransformUpdated);
            this._handlers = null;
        }

        if (this.panel?.parentNode) this.panel.parentNode.removeChild(this.panel);
        this.panel     = null;
        this.currentId = null;
    }

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
        H.onViewportChanged = () => { if (this.currentId) this._repositionThrottled(); };
        H.onActivated       = ({ tool }) => { if (tool !== 'select') this.hide(); };
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
        this.eventBus.on(Events.Viewport.Changed,        H.onViewportChanged);
        this.eventBus.on(Events.Tool.Activated,          H.onActivated);
        this.eventBus.on(Events.Object.TransformUpdated, H.onTransformUpdated);
    }

    // ── Построение DOM ─────────────────────────────────────────────────────────

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--draw drawing-properties-panel';
        panel.id = 'drawing-properties-panel';
        panel.style.display = 'none';
        // Панель позиционируется абсолютно внутри canvasContainer
        panel.style.left = '0px';
        panel.style.top  = '0px';
        panel.addEventListener('pointerdown', (e) => e.stopPropagation());

        const inner = document.createElement('div');
        inner.className = 'moodboard-draw__panel';

        inner.appendChild(this._buildThicknessSection());
        inner.appendChild(this._buildColorSection());

        panel.appendChild(inner);
        this.panel = panel;
        this.container.appendChild(panel);
    }

    _buildThicknessSection() {
        const section = document.createElement('div');
        section.className = 'moodboard-draw__section moodboard-draw__section--thickness';

        const header = document.createElement('div');
        header.className = 'moodboard-draw__section-header';
        const label = document.createElement('span');
        label.textContent = 'Толщина';
        label.className = 'moodboard-draw__section-label';
        const value = document.createElement('span');
        value.textContent = '2px';
        value.className = 'moodboard-draw__thickness-value';
        header.appendChild(label);
        header.appendChild(value);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(MIN_WIDTH);
        slider.max = String(MAX_WIDTH);
        slider.value = '2';
        slider.className = 'moodboard-draw__slider';
        slider.addEventListener('input', () => {
            const w = parseInt(slider.value, 10);
            value.textContent = `${w}px`;
            this._emit({ strokeWidth: w });
        });

        section.appendChild(header);
        section.appendChild(slider);

        this._slider     = slider;
        this._widthValue = value;
        return section;
    }

    _buildColorSection() {
        const section = document.createElement('div');
        section.className = 'moodboard-draw__section';

        const grid = document.createElement('div');
        grid.className = 'moodboard-draw__color-grid';

        PALETTE.forEach((hex) => {
            const btn = document.createElement('button');
            btn.className = 'moodboard-draw__color-btn';
            btn.title = hex;
            btn.dataset.hex = hex.toLowerCase();
            btn.style.background = hex;
            if (hex === '#ffffff') btn.style.border = '1.5px solid #d1d5db';
            btn.addEventListener('click', () => {
                this._setActiveSwatch(btn);
                this._emit({ strokeColor: parseInt(hex.replace('#', ''), 16) });
            });
            grid.appendChild(btn);
        });

        // Кастомный пикер (радужный кружок)
        const customBtn = document.createElement('button');
        customBtn.className = 'moodboard-draw__color-btn moodboard-draw__color-btn--custom';
        customBtn.title = 'Выбрать цвет';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#000000';
        colorInput.className = 'moodboard-draw__color-input';
        colorInput.addEventListener('input', () => {
            this._setActiveSwatch(customBtn);
            this._emit({ strokeColor: parseInt(colorInput.value.replace('#', ''), 16) });
        });
        customBtn.appendChild(colorInput);
        customBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            colorInput.click();
        });
        grid.appendChild(customBtn);

        section.appendChild(grid);

        this._colorGrid  = grid;
        this._customBtn  = customBtn;
        this._colorInput = colorInput;
        return section;
    }

    // ── Синхронизация контролов с объектом ──────────────────────────────────────

    _updateControlsFromObject() {
        const props = this._getDrawingProps();
        if (!props) return;

        const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(props.strokeWidth ?? 2)));
        if (this._slider) this._slider.value = String(width);
        if (this._widthValue) this._widthValue.textContent = `${width}px`;

        const hex = this._pixiToHex(props.strokeColor ?? 0x111827);
        this._syncActiveSwatchByHex(hex);
        if (this._colorInput) this._colorInput.value = hex;
    }

    _getDrawingProps() {
        const id = this.currentId;
        if (!id) return null;
        const obj = (this.core?.state?.state?.objects ?? this.core?.state?.getObjects?.() ?? [])
            .find(o => o.id === id);
        return obj?.properties ?? null;
    }

    _setActiveSwatch(activeBtn) {
        if (!this._colorGrid) return;
        this._colorGrid.querySelectorAll('.moodboard-draw__color-btn--active')
            .forEach(el => el.classList.remove('moodboard-draw__color-btn--active'));
        if (activeBtn) activeBtn.classList.add('moodboard-draw__color-btn--active');
    }

    _syncActiveSwatchByHex(hex) {
        if (!this._colorGrid) return;
        const match = this._colorGrid.querySelector(`.moodboard-draw__color-btn[data-hex="${hex}"]`);
        this._setActiveSwatch(match || this._customBtn);
    }

    _pixiToHex(pixi) {
        return '#' + (pixi >>> 0).toString(16).padStart(6, '0').slice(-6).toLowerCase();
    }

    // ── Emit ────────────────────────────────────────────────────────────────────

    _emit(propsPatch) {
        if (!this.currentId) return;
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: propsPatch },
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
