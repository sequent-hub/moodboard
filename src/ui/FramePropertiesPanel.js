import { Events } from '../core/events/Events.js';
import { UpdateFrameTypeCommand } from '../core/commands/UpdateFrameTypeCommand.js';

// --- colour helpers ---

function hexToPixi(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

function pixiToHex(pixi) {
    return '#' + pixi.toString(16).padStart(6, '0').toUpperCase();
}

function hsvToHex(h, s, v) {
    const f = (n) => {
        const k = (n + h / 60) % 6;
        const val = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
        return Math.round(val * 255).toString(16).padStart(2, '0');
    };
    return '#' + f(5) + f(3) + f(1);
}

function hexToHsv(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

// 15 preset colours (none/transparent is separate)
const FRAME_COLORS = [
    { name: 'Белый',            hex: '#FFFFFF' },
    { name: 'Светло-серый',     hex: '#EBEBEB' },
    { name: 'Серый',            hex: '#ABABAB' },
    { name: 'Светло-розовый',   hex: '#FFDDE0' },
    { name: 'Розовый',          hex: '#FFB3BB' },
    { name: 'Персиковый',       hex: '#FFE5CC' },
    { name: 'Оранжевый',        hex: '#FFB066' },
    { name: 'Светло-жёлтый',   hex: '#FFFACC' },
    { name: 'Жёлтый',           hex: '#FFE566' },
    { name: 'Светло-зелёный',   hex: '#D4F5D4' },
    { name: 'Зелёный',          hex: '#88D888' },
    { name: 'Небесный',         hex: '#D4EEFF' },
    { name: 'Голубой',          hex: '#80BFFF' },
    { name: 'Лавандовый',       hex: '#E8D4FF' },
    { name: 'Фиолетовый',       hex: '#C499FF' },
];

const ICONS = {
    rename: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" type="input-field"><path d="M15.75 7.75H17.25C18.3546 7.75 19.25 8.64543 19.25 9.75V14.25C19.25 15.3546 18.3546 16.25 17.25 16.25H15.75M8.25 16.25H6.75C5.64543 16.25 4.75 15.3546 4.75 14.25V9.75C4.75 8.64543 5.64543 7.75 6.75 7.75H8.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M10.75 4.75H13.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M10.75 19.25H13.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 5V19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.8"/><path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2.2 2.9M6.2 6.2A13 13 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 3.5-.6"/></svg>',
    lock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.75 11.75C5.75 11.2 6.2 10.75 6.75 10.75H17.25C17.8 10.75 18.25 11.2 18.25 11.75V17.25C18.25 18.35 17.35 19.25 16.25 19.25H7.75C6.65 19.25 5.75 18.35 5.75 17.25V11.75Z"/><path d="M7.75 10.5V10.34C7.75 8.78 7.66 7.04 8.75 5.92C9.37 5.29 10.37 4.75 12 4.75C13.63 4.75 14.63 5.29 15.25 5.92C16.34 7.04 16.25 8.78 16.25 10.34V10.5"/><path d="M12 14.25V15.75"/></svg>',
    unlock: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.75 11.75C5.75 11.2 6.2 10.75 6.75 10.75H17.25C17.8 10.75 18.25 11.2 18.25 11.75V17.25C18.25 18.35 17.35 19.25 16.25 19.25H7.75C6.65 19.25 5.75 18.35 5.75 17.25V11.75Z"/><path d="M7.75 10.5V9.84C7.75 8.61 7.7 7.3 8.42 6.31C9 5.52 10.06 4.75 12 4.75C14 4.75 15.25 6.25 15.25 6.25"/><path d="M12 14.25V15.75"/></svg>',
    more: '<svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor"><path d="M16.22 12.38a1.38 1.38 0 1 0 0-2.76 1.38 1.38 0 0 0 0 2.76Z"/><path d="M11 12.38a1.38 1.38 0 1 0 0-2.76 1.38 1.38 0 0 0 0 2.76Z"/><path d="M5.78 12.38a1.38 1.38 0 1 0 0-2.76 1.38 1.38 0 0 0 0 2.76Z"/></svg>',
    expand: '<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke-width="1.2" type="chevron-down" size="24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M15.25 10.75L12 14.25L8.75 10.75"></path></svg>',
    rCustom: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    rWide: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="1"/></svg>',
    r43: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/></svg>',
    rSquare: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>',
    rA4: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="1"/></svg>',
    comment: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    bgSolid: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="2.5" fill="#374151"/></svg>',
    bgBordered: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="2.5" fill="#D1D5DB"/><rect x="3" y="3" width="16" height="16" rx="2.5" stroke="#374151" stroke-width="1.5"/></svg>',
    bgOutline: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="2.5" stroke="#374151" stroke-width="1.5"/></svg>',
    eyedropper: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5l4-4"/><path d="M6.5 17.5L17 7a2.5 2.5 0 0 0 0-3.5l-2-2a2.5 2.5 0 0 0-3.5 0L3 10l4 4z"/></svg>',
};

const RATIO_LABELS = {
    custom: 'Произвольное',
    '16x9': '16:9',
    '4x3': '4:3',
    '1x1': '1:1',
    a4: 'A4',
};

const BG_TYPES = [
    { id: 'solid',          title: 'Сплошной фон',    icon: 'bgSolid' },
    { id: 'solid-bordered', title: 'Фон с рамкой',    icon: 'bgBordered' },
    { id: 'outline',        title: 'Только рамка',    icon: 'bgOutline' },
];

/**
 * Тулбар над выделенным фреймом.
 * Состав: Ratio (пропорции), цвет фона, переименование, видимость, блокировка, меню.
 */
export class FramePropertiesPanel {
    constructor(eventBus, container, core = null) {
        this.eventBus = eventBus;
        this.container = container;
        this.core = core;
        this.panel = null;
        this.currentId = null;

        this._sessionCustomColors = [];
        this._colorPopup = null;
        this._colorPickerModal = null;
        this._pickerDragging = false;
        this._pickerHue = 0;
        this._pickerSat = 0;
        this._pickerVal = 1;

        this._attachEvents();
        this._createPanel();
    }

    _attachEvents() {
        this._handlers = {};
        this._handlers.onSelectionAdd = () => this.updateFromSelection();
        this._handlers.onSelectionRemove = () => this.updateFromSelection();
        this._handlers.onSelectionClear = () => this.hide();
        this._handlers.onDeleted = (objectId) => {
            const id = objectId?.objectId || objectId;
            if (this.currentId && id === this.currentId) { this.hide(); }
        };
        this._handlers.onDragStart = () => this.hide();
        this._handlers.onDragUpdate = () => this._repositionThrottled();
        this._handlers.onDragEnd = () => this.updateFromSelection();
        this._handlers.onGroupDragUpdate = () => this._repositionThrottled();
        this._handlers.onGroupDragStart = () => this.hide();
        this._handlers.onGroupDragEnd = () => this.updateFromSelection();
        this._handlers.onResizeStart = () => this.hide();
        this._handlers.onResizeUpdate = () => this._repositionThrottled();
        this._handlers.onResizeEnd = () => this.updateFromSelection();
        this._handlers.onRotateUpdate = () => this._repositionThrottled();
        this._handlers.onZoomPercent = () => { if (this.currentId) { this._repositionThrottled(); } };
        this._handlers.onPanUpdate = () => { if (this.currentId) { this._repositionThrottled(); } };
        this._handlers.onViewportChanged = () => { if (this.currentId) { this._repositionThrottled(); } };
        this._handlers.onActivated = ({ tool }) => { if (tool !== 'select') { this.hide(); } };
        this._handlers.onStateChanged = (data) => {
            const { objectId } = data;
            if (this.currentId && objectId === this.currentId && this.panel && this.panel.style.display !== 'none') {
                this._updateControlsFromObject();
                this._syncTypeFromObject();
            }
        };
        this._handlers.onHistoryChanged = () => {
            if (this.currentId && this.panel && this.panel.style.display !== 'none') {
                this._updateControlsFromObject();
                this._syncTypeFromObject();
            }
        };
        this._handlers.onTransformUpdated = (data) => {
            if (this.currentId && data.objectId === this.currentId && this.panel && this.panel.style.display !== 'none') {
                this._repositionThrottled();
            }
        };

        this.eventBus.on(Events.Tool.SelectionAdd, this._handlers.onSelectionAdd);
        this.eventBus.on(Events.Tool.SelectionRemove, this._handlers.onSelectionRemove);
        this.eventBus.on(Events.Tool.SelectionClear, this._handlers.onSelectionClear);
        this.eventBus.on(Events.Object.Deleted, this._handlers.onDeleted);
        this.eventBus.on(Events.Tool.DragStart, this._handlers.onDragStart);
        this.eventBus.on(Events.Tool.DragUpdate, this._handlers.onDragUpdate);
        this.eventBus.on(Events.Tool.DragEnd, this._handlers.onDragEnd);
        this.eventBus.on(Events.Tool.GroupDragUpdate, this._handlers.onGroupDragUpdate);
        this.eventBus.on(Events.Tool.GroupDragStart, this._handlers.onGroupDragStart);
        this.eventBus.on(Events.Tool.GroupDragEnd, this._handlers.onGroupDragEnd);
        this.eventBus.on(Events.Tool.ResizeStart, this._handlers.onResizeStart);
        this.eventBus.on(Events.Tool.ResizeUpdate, this._handlers.onResizeUpdate);
        this.eventBus.on(Events.Tool.ResizeEnd, this._handlers.onResizeEnd);
        this.eventBus.on(Events.Tool.RotateUpdate, this._handlers.onRotateUpdate);
        this.eventBus.on(Events.UI.ZoomPercent, this._handlers.onZoomPercent);
        this.eventBus.on(Events.Tool.PanUpdate, this._handlers.onPanUpdate);
        this.eventBus.on(Events.Viewport.Changed, this._handlers.onViewportChanged);
        this.eventBus.on(Events.Tool.Activated, this._handlers.onActivated);
        this.eventBus.on(Events.Object.StateChanged, this._handlers.onStateChanged);
        this.eventBus.on(Events.History.Changed, this._handlers.onHistoryChanged);
        this.eventBus.on(Events.Object.TransformUpdated, this._handlers.onTransformUpdated);
    }

    updateFromSelection() {
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids || ids.length !== 1) { this.hide(); return; }

        const id = ids[0];
        if (this.currentId === id && this.panel && this.panel.style.display !== 'none') { return; }

        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        const isFrame = !!(pixi && pixi._mb && pixi._mb.type === 'frame');

        if (isFrame) {
            this.showFor(id);
        } else {
            this.hide();
        }
    }

    showFor(objectId) {
        this.currentId = objectId;
        if (this.panel) {
            this.panel.style.display = 'flex';
            this.reposition();
        }
        this._updateControlsFromObject();
        this._syncTypeFromObject();
        this._updateLockUI();
    }

    hide() {
        this.currentId = null;
        this._closeMenus();
        if (this.panel) { this.panel.style.display = 'none'; }
    }

    _getObjectData() {
        if (!this.currentId || !this.core?.getObjectData) { return null; }
        return this.core.getObjectData(this.currentId);
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.className = 'frame-properties-panel';
        panel.id = 'frame-properties-panel';
        panel.style.position = 'absolute';
        panel.style.display = 'none';
        panel.style.zIndex = '10000';

        this._boundDocumentClickHandler = this._documentClickHandler.bind(this);
        this._boundPickerMouseMove = this._pickerMouseMove.bind(this);
        this._boundPickerMouseUp = this._pickerMouseUp.bind(this);

        const ratio = this._makeRatioControl();
        const color = this._makeColorControl();
        const rename = this._makeButton(ICONS.rename, 'Переименовать', 'rename');
        rename.addEventListener('click', (e) => { e.stopPropagation(); this._openRename(); });
        const eye = this._makeButton(ICONS.eye, 'Скрыть / показать', 'eye');
        eye.addEventListener('click', (e) => { e.stopPropagation(); this._toggleVisibility(eye); });
        this._eyeBtn = eye;

        const divider = this._makeDivider();

        this._btn_lock = this._makeButton(ICONS.unlock, 'Заблокировать', 'lock');
        this._btn_lock.addEventListener('click', (e) => { e.stopPropagation(); this._toggleLocked(); });

        const more = this._makeMoreButton();

        panel.appendChild(ratio);
        panel.appendChild(color);
        panel.appendChild(rename);
        panel.appendChild(eye);
        panel.appendChild(divider);
        panel.appendChild(this._btn_lock);
        panel.appendChild(more);

        this._lockableEls = [ratio, color, rename, eye, divider];
        this._leftEls = [ratio, color, rename];

        const colorPopup = this._makeColorPopup();
        panel.appendChild(colorPopup);

        const colorPicker = this._makeColorPickerModal();
        panel.appendChild(colorPicker);

        this.panel = panel;
        this.container.appendChild(panel);
    }

    _makeButton(iconHtml, title, key) {
        const btn = document.createElement('button');
        btn.className = 'ipp-btn';
        btn.title = title;
        if (key) { btn.dataset.id = 'fpp-btn-' + key; }
        btn.innerHTML = iconHtml;
        return btn;
    }

    _makeDivider() {
        const div = document.createElement('div');
        div.className = 'ipp-divider';
        return div;
    }

    _makeRatioControl() {
        const wrap = document.createElement('div');
        wrap.className = 'fpp-ratio';

        const btn = document.createElement('button');
        btn.className = 'fpp-ratio-btn';
        btn.dataset.id = 'fpp-ratio-btn';

        const textBox = document.createElement('span');
        textBox.className = 'fpp-ratio-text';
        const caption = document.createElement('span');
        caption.className = 'fpp-ratio-caption';
        caption.textContent = 'Соотношение сторон';
        const value = document.createElement('span');
        value.className = 'fpp-ratio-value';
        value.textContent = RATIO_LABELS.custom;
        textBox.appendChild(caption);
        textBox.appendChild(value);
        this._ratioValueEl = value;
        this._ratioBtn = btn;

        const chevron = document.createElement('span');
        chevron.innerHTML = ICONS.expand;

        btn.appendChild(textBox);
        btn.appendChild(chevron);

        const dropdown = document.createElement('div');
        dropdown.className = 'fpp-ratio-dropdown';
        this._ratioDropdown = dropdown;

        const items = [
            { id: 'custom', label: RATIO_LABELS.custom, icon: ICONS.rCustom },
            { id: '16x9', label: '16:9', icon: ICONS.rWide },
            { id: '4x3', label: '4:3', icon: ICONS.r43 },
            { id: '1x1', label: '1:1', icon: ICONS.rSquare },
            { id: 'a4', label: 'A4', icon: ICONS.rA4 },
        ];

        items.forEach((item) => {
            const el = document.createElement('button');
            el.className = 'ipp-dropdown-item';
            const ic = document.createElement('span');
            ic.className = 'ipp-dropdown-icon';
            ic.innerHTML = item.icon;
            const lbl = document.createElement('span');
            lbl.textContent = item.label;
            el.appendChild(ic);
            el.appendChild(lbl);
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this._closeMenus();
                this._applyFrameType(item.id);
            });
            dropdown.appendChild(el);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('is-open');
            this._closeMenus();
            if (!isOpen) {
                dropdown.classList.add('is-open');
                btn.classList.add('is-active');
                this._attachOutside();
            }
        });

        wrap.appendChild(btn);
        wrap.appendChild(dropdown);
        return wrap;
    }

    _makeColorControl() {
        const wrap = document.createElement('div');
        wrap.className = 'fpp-color-wrap';
        wrap.title = 'Цвет фона';

        const colorButton = document.createElement('button');
        colorButton.className = 'fpp-color-button';
        colorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleColorPopup(colorButton);
        });

        this.colorButton = colorButton;
        wrap.appendChild(colorButton);
        return wrap;
    }

    // ─── colour popup ──────────────────────────────────────────────────────────

    _makeColorPopup() {
        const popup = document.createElement('div');
        popup.className = 'fpp-color-popup';
        this._colorPopup = popup;

        // Background type section
        const typeSection = document.createElement('div');
        typeSection.className = 'fpp-section';

        const typeLabel = document.createElement('div');
        typeLabel.className = 'fpp-section-label';
        typeLabel.textContent = 'Background type';

        const typeRow = document.createElement('div');
        typeRow.className = 'fpp-bg-type-row';

        this._bgTypeBtns = [];
        BG_TYPES.forEach(({ id, title, icon }) => {
            const btn = document.createElement('button');
            btn.className = 'fpp-bg-type-btn';
            btn.title = title;
            btn.dataset.bgMode = id;
            btn.innerHTML = ICONS[icon];
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._selectBgMode(id);
            });
            typeRow.appendChild(btn);
            this._bgTypeBtns.push(btn);
        });

        typeSection.appendChild(typeLabel);
        typeSection.appendChild(typeRow);
        popup.appendChild(typeSection);

        // Colour section
        const colorSection = document.createElement('div');
        colorSection.className = 'fpp-section fpp-section--color';
        this._colorSection = colorSection;

        const colorLabel = document.createElement('div');
        colorLabel.className = 'fpp-section-label';
        colorLabel.textContent = 'Color';

        const grid = document.createElement('div');
        grid.className = 'fpp-color-grid';
        this._colorSwatches = [];

        // "None" swatch — transparent
        const noneSwatch = document.createElement('button');
        noneSwatch.className = 'fpp-color-swatch fpp-color-swatch--none';
        noneSwatch.title = 'Прозрачный';
        noneSwatch.dataset.colorHex = 'none';
        noneSwatch.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><line x1="3" y1="17" x2="17" y2="3" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/></svg>';
        noneSwatch.addEventListener('click', (e) => {
            e.stopPropagation();
            this._applyTransparent();
        });
        grid.appendChild(noneSwatch);
        this._noneSwatch = noneSwatch;
        this._colorSwatches.push(noneSwatch);

        // Preset swatches
        FRAME_COLORS.forEach((color) => {
            const btn = document.createElement('button');
            btn.className = 'fpp-color-swatch';
            btn.title = color.name;
            btn.dataset.colorHex = color.hex.toUpperCase();
            btn.style.setProperty('--swatch-color', color.hex);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._selectColor(color.hex);
            });
            grid.appendChild(btn);
            this._colorSwatches.push(btn);
        });

        colorSection.appendChild(colorLabel);
        colorSection.appendChild(grid);
        popup.appendChild(colorSection);

        // Custom colours section
        const customSection = document.createElement('div');
        customSection.className = 'fpp-section fpp-section--custom';
        this._customSection = customSection;

        const customLabel = document.createElement('div');
        customLabel.className = 'fpp-section-label';
        customLabel.textContent = 'Custom colors';

        const customRow = document.createElement('div');
        customRow.className = 'fpp-custom-row';
        this._customColorRow = customRow;

        const addBtn = document.createElement('button');
        addBtn.className = 'fpp-add-color-btn';
        addBtn.title = 'Добавить цвет';
        addBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._openColorPicker();
        });
        this._addColorBtn = addBtn;

        customRow.appendChild(addBtn);
        customSection.appendChild(customLabel);
        customSection.appendChild(customRow);
        popup.appendChild(customSection);

        return popup;
    }

    _toggleColorPopup(button) {
        if (!this._colorPopup) { return; }
        const isOpen = this._colorPopup.classList.contains('is-open');
        if (isOpen) {
            this._hideColorPopup();
        } else {
            this._closeMenus();
            this._showColorPopup(button);
        }
    }

    _showColorPopup(button) {
        if (!this._colorPopup) { return; }
        const buttonRect = button.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();
        this._colorPopup.style.left = (buttonRect.left - panelRect.left) + 'px';
        this._colorPopup.style.top = (buttonRect.bottom - panelRect.top + 6) + 'px';
        this._colorPopup.classList.add('is-open');
        this._syncColorPopupFromObject();
        this._attachOutside();
    }

    _hideColorPopup() {
        if (this._colorPopup) { this._colorPopup.classList.remove('is-open'); }
        this._closeColorPicker();
    }

    _selectBgMode(mode) {
        if (!this.currentId) { return; }

        this._bgTypeBtns.forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.bgMode === mode);
        });

        this._setColorSectionDisabled(false);

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { bgMode: mode } },
        });
    }

    _applyTransparent() {
        if (!this.currentId) { return; }
        this._setColorSectionDisabled(true);
        this._markNoneSelected();

        const outlineBtn = this._bgTypeBtns.find((b) => b.dataset.bgMode === 'outline');
        if (outlineBtn) {
            this._bgTypeBtns.forEach((b) => b.classList.remove('is-active'));
            outlineBtn.classList.add('is-active');
        }

        if (this.colorButton) {
            this.colorButton.style.backgroundColor = 'transparent';
            this.colorButton.classList.add('fpp-color-button--none');
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { bgMode: 'outline' } },
        });
    }

    _selectColor(hex) {
        if (!this.currentId) { return; }
        const pixi = hexToPixi(hex);

        this._setColorSectionDisabled(false);
        this._syncSwatchSelection(hex.toUpperCase());

        if (this.colorButton) {
            this.colorButton.style.backgroundColor = hex;
            this.colorButton.classList.remove('fpp-color-button--none');
        }

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { backgroundColor: pixi },
        });
    }

    _getCurrentBgMode() {
        const obj = this._getObjectData();
        return (obj?.properties?.bgMode) || (obj?.bgMode) || 'solid';
    }

    _setColorSectionDisabled(disabled) {
        if (this._colorSection) {
            this._colorSection.classList.toggle('is-disabled', disabled);
        }
    }

    _markNoneSelected() {
        this._colorSwatches.forEach((s) => s.classList.remove('is-selected'));
        if (this._noneSwatch) { this._noneSwatch.classList.add('is-selected'); }
    }

    _syncSwatchSelection(hexUpper) {
        this._colorSwatches.forEach((s) => {
            s.classList.toggle('is-selected', (s.dataset.colorHex || '').toUpperCase() === hexUpper);
        });
    }

    _syncColorPopupFromObject() {
        const obj = this._getObjectData();
        if (!obj) { return; }

        const bgMode = (obj.properties?.bgMode) || (obj.bgMode) || 'solid';
        const bgColor = obj.backgroundColor ?? (obj.properties?.backgroundColor);
        const isTransparent = bgColor === null || bgColor === undefined || bgMode === 'outline';

        this._bgTypeBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.bgMode === bgMode));

        if (isTransparent) {
            this._setColorSectionDisabled(true);
            this._markNoneSelected();
        } else {
            this._setColorSectionDisabled(false);
            const hex = (typeof bgColor === 'number') ? pixiToHex(bgColor) : '#FFFFFF';
            this._syncSwatchSelection(hex.toUpperCase());

            const customMatch = this._sessionCustomColors.find((c) => c.toUpperCase() === hex.toUpperCase());
            if (!customMatch) {
                const presetMatch = FRAME_COLORS.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
                if (!presetMatch) {
                    this._syncSwatchSelection(''); // custom colour not in list — deselect all presets
                }
            }
        }
    }

    // ─── HSV colour picker ─────────────────────────────────────────────────────

    _makeColorPickerModal() {
        const modal = document.createElement('div');
        modal.className = 'fpp-color-picker';
        this._colorPickerModal = modal;

        // Gradient canvas
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'fpp-color-picker__canvas-wrap';

        const canvas = document.createElement('canvas');
        canvas.width = 212;
        canvas.height = 148;
        canvas.className = 'fpp-color-picker__canvas';
        this._hsvCanvas = canvas;

        const cursor = document.createElement('div');
        cursor.className = 'fpp-color-picker__cursor';
        this._hsvCursor = cursor;

        canvasWrap.appendChild(canvas);
        canvasWrap.appendChild(cursor);
        modal.appendChild(canvasWrap);

        canvas.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this._pickerDragging = true;
            this._updatePickerSV(e);
            document.addEventListener('mousemove', this._boundPickerMouseMove);
            document.addEventListener('mouseup', this._boundPickerMouseUp);
        });

        // Hue slider
        const hueWrap = document.createElement('div');
        hueWrap.className = 'fpp-color-picker__hue-wrap';

        const hueSlider = document.createElement('input');
        hueSlider.type = 'range';
        hueSlider.min = '0';
        hueSlider.max = '360';
        hueSlider.value = '0';
        hueSlider.className = 'fpp-color-picker__hue-slider';
        this._hueSlider = hueSlider;

        hueSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this._pickerHue = parseInt(e.target.value);
            this._drawHsvCanvas();
            this._syncPickerHex();
        });

        hueWrap.appendChild(hueSlider);
        modal.appendChild(hueWrap);

        // Bottom row: eyedropper + hex input
        const bottomRow = document.createElement('div');
        bottomRow.className = 'fpp-color-picker__bottom';

        const eyedropper = document.createElement('button');
        eyedropper.className = 'fpp-color-picker__eyedropper';
        eyedropper.title = 'Пипетка';
        eyedropper.innerHTML = ICONS.eyedropper;
        eyedropper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof EyeDropper !== 'undefined') {
                new EyeDropper().open().then(({ sRGBHex }) => {
                    this._setPickerFromHex(sRGBHex);
                    this._syncPickerHex();
                }).catch(() => {});
            }
        });

        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'fpp-color-picker__hex-input';
        hexInput.value = '#ffffff';
        hexInput.maxLength = 7;
        hexInput.spellcheck = false;
        this._hexInput = hexInput;

        hexInput.addEventListener('click', (e) => e.stopPropagation());
        hexInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                const hex = hexInput.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                    this._confirmCustomColor(hex);
                }
            }
        });
        hexInput.addEventListener('change', (e) => {
            e.stopPropagation();
            const hex = hexInput.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                this._setPickerFromHex(hex);
            }
        });

        bottomRow.appendChild(eyedropper);
        bottomRow.appendChild(hexInput);
        modal.appendChild(bottomRow);

        // Apply button
        const applyBtn = document.createElement('button');
        applyBtn.className = 'fpp-color-picker__apply';
        applyBtn.textContent = 'Добавить';
        applyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const hex = this._hexInput?.value?.trim();
            if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) {
                this._confirmCustomColor(hex);
            }
        });
        modal.appendChild(applyBtn);

        return modal;
    }

    _openColorPicker() {
        if (!this._colorPickerModal || !this._colorPopup || !this._addColorBtn) { return; }

        const popupRect = this._colorPopup.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();

        this._colorPickerModal.style.left = (popupRect.right - panelRect.left + 6) + 'px';
        this._colorPickerModal.style.top = (popupRect.top - panelRect.top) + 'px';
        this._colorPickerModal.classList.add('is-open');

        this._pickerHue = 0;
        this._pickerSat = 0;
        this._pickerVal = 1;
        if (this._hueSlider) { this._hueSlider.value = '0'; }
        this._drawHsvCanvas();
        this._syncPickerHex();
    }

    _closeColorPicker() {
        if (this._colorPickerModal) { this._colorPickerModal.classList.remove('is-open'); }
        document.removeEventListener('mousemove', this._boundPickerMouseMove);
        document.removeEventListener('mouseup', this._boundPickerMouseUp);
        this._pickerDragging = false;
    }

    _drawHsvCanvas() {
        const canvas = this._hsvCanvas;
        if (!canvas) { return; }
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        const hueColor = `hsl(${this._pickerHue}, 100%, 50%)`;

        const satGrad = ctx.createLinearGradient(0, 0, w, 0);
        satGrad.addColorStop(0, '#ffffff');
        satGrad.addColorStop(1, hueColor);
        ctx.fillStyle = satGrad;
        ctx.fillRect(0, 0, w, h);

        const darkGrad = ctx.createLinearGradient(0, 0, 0, h);
        darkGrad.addColorStop(0, 'rgba(0,0,0,0)');
        darkGrad.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = darkGrad;
        ctx.fillRect(0, 0, w, h);

        if (this._hsvCursor) {
            const cx = Math.round(this._pickerSat * w);
            const cy = Math.round((1 - this._pickerVal) * h);
            this._hsvCursor.style.left = cx + 'px';
            this._hsvCursor.style.top = cy + 'px';
        }
    }

    _updatePickerSV(e) {
        const canvas = this._hsvCanvas;
        if (!canvas) { return; }
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        this._pickerSat = x / rect.width;
        this._pickerVal = 1 - y / rect.height;
        this._drawHsvCanvas();
        this._syncPickerHex();
    }

    _pickerMouseMove(e) {
        if (!this._pickerDragging) { return; }
        this._updatePickerSV(e);
    }

    _pickerMouseUp() {
        this._pickerDragging = false;
        document.removeEventListener('mousemove', this._boundPickerMouseMove);
        document.removeEventListener('mouseup', this._boundPickerMouseUp);
    }

    _syncPickerHex() {
        if (!this._hexInput) { return; }
        const hex = hsvToHex(this._pickerHue, this._pickerSat, this._pickerVal);
        this._hexInput.value = hex.toUpperCase();
    }

    _setPickerFromHex(hex) {
        const { h, s, v } = hexToHsv(hex);
        this._pickerHue = h;
        this._pickerSat = s;
        this._pickerVal = v;
        if (this._hueSlider) { this._hueSlider.value = String(h); }
        this._drawHsvCanvas();
    }

    _confirmCustomColor(hex) {
        const normalised = hex.toUpperCase();
        if (!this._sessionCustomColors.includes(normalised)) {
            this._sessionCustomColors.push(normalised);
            this._addCustomSwatch(normalised);
        }
        this._selectColor(normalised);
        this._closeColorPicker();
    }

    _addCustomSwatch(hex) {
        const btn = document.createElement('button');
        btn.className = 'fpp-color-swatch';
        btn.title = hex;
        btn.dataset.colorHex = hex;
        btn.style.setProperty('--swatch-color', hex);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._selectColor(hex);
        });

        if (this._customColorRow && this._addColorBtn) {
            this._customColorRow.insertBefore(btn, this._addColorBtn);
        }
        this._colorSwatches.push(btn);
    }

    // ─── shared helpers ────────────────────────────────────────────────────────

    _makeMoreButton() {
        const wrapper = document.createElement('div');
        wrapper.className = 'ipp-btn-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-flex';

        const mainBtn = document.createElement('button');
        mainBtn.className = 'ipp-btn';
        mainBtn.title = 'Ещё';
        mainBtn.dataset.id = 'fpp-btn-more';
        mainBtn.innerHTML = ICONS.more;

        const dropdown = document.createElement('div');
        dropdown.className = 'ipp-more-dropdown';
        this._moreDropdown = dropdown;

        const infoPopover = document.createElement('div');
        infoPopover.className = 'ipp-info-popover';
        dropdown.appendChild(infoPopover);
        this._infoPopover = infoPopover;

        const items = [
            { id: 'copy', label: 'Копировать', shortcut: 'Ctrl+C' },
            { id: 'export-pdf', label: 'Экспорт в PDF' },
            { divider: true },
            { id: 'copy-link', label: 'Копировать ссылку на объект' },
            { id: 'bring-front', label: 'На передний план', shortcut: ']' },
            { id: 'bring-forward', label: 'Переместить вперёд', shortcut: 'Ctrl+]' },
            { id: 'send-backward', label: 'Переместить назад', shortcut: 'Ctrl+[' },
            { id: 'send-back', label: 'На задний план', shortcut: '[' },
            { id: 'info', label: 'Информация', shortcut: '>' },
            { id: 'lock', label: 'Заблокировать', shortcut: 'Ctrl+Shift+L' },
            { id: 'duplicate', label: 'Дублировать', shortcut: 'Ctrl+D' },
            { divider: true },
            { id: 'add-comment', label: 'Добавить комментарий', icon: ICONS.comment },
            { divider: true },
            { id: 'copy-png', label: 'Копировать как PNG', shortcut: 'Ctrl+Shift+C' },
            { id: 'save-template', label: 'Сохранить как шаблон' },
            { id: 'save-selection', label: 'Сохранить выделение как...' },
            { divider: true },
            { id: 'delete', label: 'Удалить', shortcut: 'Delete' },
        ];

        items.forEach((item) => {
            if (item.divider) {
                const div = document.createElement('div');
                div.className = 'ipp-dropdown-divider';
                dropdown.appendChild(div);
                return;
            }

            const btn = document.createElement('button');
            btn.className = 'ipp-dropdown-item';
            btn.dataset.id = 'fpp-more-' + item.id;

            if (item.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'ipp-dropdown-icon';
                iconSpan.innerHTML = item.icon;
                btn.appendChild(iconSpan);
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;
            btn.appendChild(labelSpan);

            if (item.shortcut) {
                const sc = document.createElement('span');
                sc.className = 'ipp-dropdown-item-shortcut';
                sc.textContent = item.shortcut;
                btn.appendChild(sc);
            }

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.id === 'info') { this._showInfoModal(); return; }
                this._handleMoreAction(item.id);
                this._closeMenus();
            });

            if (item.id === 'lock') { this._moreLockLabel = labelSpan; }
            if (item.id === 'info') { this._infoBtnEl = btn; }

            dropdown.appendChild(btn);
        });

        mainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('is-open');
            this._closeMenus();
            if (!isOpen) {
                dropdown.classList.add('is-open');
                mainBtn.classList.add('is-active');
                this._attachOutside();
            }
        });
        this._moreMainBtn = mainBtn;

        wrapper.appendChild(mainBtn);
        wrapper.appendChild(dropdown);
        return wrapper;
    }

    _handleMoreAction(id) {
        if (!this.currentId) { return; }
        if (id === 'copy') {
            this.eventBus.emit(Events.Keyboard.Copy);
        } else if (id === 'bring-front') {
            this.eventBus.emit(Events.UI.LayerBringToFront, { objectId: this.currentId });
        } else if (id === 'bring-forward') {
            this.eventBus.emit(Events.UI.LayerBringForward, { objectId: this.currentId });
        } else if (id === 'send-backward') {
            this.eventBus.emit(Events.UI.LayerSendBackward, { objectId: this.currentId });
        } else if (id === 'send-back') {
            this.eventBus.emit(Events.UI.LayerSendToBack, { objectId: this.currentId });
        } else if (id === 'lock') {
            this._toggleLocked();
        } else if (id === 'duplicate') {
            this._duplicateFrame();
        } else if (id === 'add-comment') {
            this.eventBus.emit(Events.Comment.OpenImageDraft, { objectId: this.currentId });
        } else if (id === 'delete') {
            this.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [this.currentId] });
        }
    }

    _showInfoModal() {
        if (!this.currentId || !this._infoPopover) { return; }
        if (this._infoPopover.classList.contains('is-open')) {
            this._infoPopover.classList.remove('is-open');
            return;
        }

        const obj = this._getObjectData() || {};
        const props = obj.properties || {};

        const formatDate = (iso) => {
            if (!iso) { return null; }
            try {
                const d = new Date(iso);
                if (isNaN(d.getTime())) { return null; }
                return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            } catch (_) { return null; }
        };

        const makeSection = (label, name, date) => {
            const section = document.createElement('div');
            section.className = 'ipp-info-section';
            const labelEl = document.createElement('div');
            labelEl.className = 'ipp-info-section__label';
            labelEl.textContent = label;
            const nameEl = document.createElement('div');
            nameEl.className = 'ipp-info-section__name';
            nameEl.textContent = name || '—';
            section.appendChild(labelEl);
            section.appendChild(nameEl);
            if (date) {
                const dateEl = document.createElement('div');
                dateEl.className = 'ipp-info-section__date';
                dateEl.textContent = date;
                section.appendChild(dateEl);
            }
            return section;
        };

        this._infoPopover.innerHTML = '';
        this._infoPopover.appendChild(makeSection('Кем создан:', null, formatDate(obj.created || props.createdAt)));
        this._infoPopover.appendChild(makeSection('Последний раз изменён:', null, formatDate(obj.updated || props.updatedAt)));

        if (this._infoBtnEl) { this._infoPopover.style.top = this._infoBtnEl.offsetTop + 'px'; }
        this._infoPopover.classList.add('is-open');
    }

    _attachOutside() {
        setTimeout(() => {
            if (this._boundDocumentClickHandler) {
                document.addEventListener('click', this._boundDocumentClickHandler);
            }
        }, 0);
    }

    _detachOutside() {
        if (this._boundDocumentClickHandler) {
            document.removeEventListener('click', this._boundDocumentClickHandler);
        }
    }

    _closeMenus() {
        this._hideColorPopup();
        if (this._ratioDropdown) { this._ratioDropdown.classList.remove('is-open'); }
        if (this._ratioBtn) { this._ratioBtn.classList.remove('is-active'); }
        if (this._moreDropdown) { this._moreDropdown.classList.remove('is-open'); }
        if (this._moreMainBtn) { this._moreMainBtn.classList.remove('is-active'); }
        if (this._infoPopover) { this._infoPopover.classList.remove('is-open'); }
        this._detachOutside();
    }

    _documentClickHandler(e) {
        const t = e.target;
        if (this.panel && this.panel.contains(t)) { return; }
        this._closeMenus();
    }

    _updateControlsFromObject() {
        if (!this.currentId) { return; }
        const obj = this._getObjectData();
        if (!obj) { return; }

        const bgColor = obj.backgroundColor ?? (obj.properties?.backgroundColor);
        const bgMode = (obj.properties?.bgMode) || (obj.bgMode) || 'solid';
        const isTransparent = bgColor === null || bgColor === undefined || bgMode === 'outline';

        if (this.colorButton) {
            if (isTransparent) {
                this.colorButton.style.backgroundColor = 'transparent';
                this.colorButton.classList.add('fpp-color-button--none');
            } else {
                const hex = (typeof bgColor === 'number') ? pixiToHex(bgColor) : '#FFFFFF';
                this.colorButton.style.backgroundColor = hex;
                this.colorButton.classList.remove('fpp-color-button--none');
                this.colorButton.title = 'Цвет фона: ' + hex;
            }
        }
    }

    _syncTypeFromObject() {
        if (!this._ratioValueEl || !this.currentId) { return; }
        const objectData = this._getObjectData();
        const t = (objectData && objectData.properties && objectData.properties.type) || 'custom';
        this._ratioValueEl.textContent = RATIO_LABELS[t] || RATIO_LABELS.custom;
    }

    _isLocked() {
        const data = this._getObjectData();
        return !!(data && data.properties && data.properties.locked);
    }

    _toggleLocked() {
        if (!this.currentId) { return; }
        const newLocked = !this._isLocked();
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { locked: newLocked } },
        });
        this._updateLockUI();
        this.reposition();
    }

    _updateLockUI() {
        if (!this._btn_lock) { return; }
        const locked = this._isLocked();

        const data = this._getObjectData();
        const hidden = !!(data && data.properties && data.properties.hidden);

        this._btn_lock.innerHTML = locked ? ICONS.lock : ICONS.unlock;
        this._btn_lock.title = locked ? 'Разблокировать' : 'Заблокировать';

        if (this._eyeBtn) {
            this._eyeBtn.dataset.hidden = hidden ? '1' : '0';
            this._eyeBtn.innerHTML = hidden ? ICONS.eyeOff : ICONS.eye;
        }

        if (Array.isArray(this._lockableEls)) {
            this._lockableEls.forEach((el) => {
                if (!el) { return; }
                if (locked) {
                    el.style.display = 'none';
                } else if (hidden && this._leftEls && this._leftEls.includes(el)) {
                    el.style.display = 'none';
                } else {
                    el.style.display = '';
                }
            });
        }
        if (this._moreLockLabel) {
            this._moreLockLabel.textContent = locked ? 'Разблокировать' : 'Заблокировать';
        }
    }

    _toggleVisibility(btn) {
        if (!this.currentId) { return; }
        const objectData = this._getObjectData();
        const currentlyHidden = !!(objectData && objectData.properties && objectData.properties.hidden);
        const newHidden = !currentlyHidden;

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { hidden: newHidden } },
        });

        if (this._eyeBtn) {
            this._eyeBtn.dataset.hidden = newHidden ? '1' : '0';
            this._eyeBtn.innerHTML = newHidden ? ICONS.eyeOff : ICONS.eye;
        }
        this._updateLockUI();
        this.reposition();
    }

    _openRename() {
        if (!this.currentId) { return; }
        this._closeMenus();
        const data = this._getObjectData();
        const selectTool = this.core?.selectTool;
        if (selectTool && typeof selectTool._openFrameTitleEditor === 'function') {
            selectTool._openFrameTitleEditor({ id: this.currentId, properties: data?.properties || {} });
        }
    }

    _duplicateFrame() {
        if (!this.currentId) { return; }
        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (!posData.position || !sizeData.size) { return; }

        const originalId = this.currentId;
        const newPos = { x: posData.position.x + sizeData.size.width + 14, y: posData.position.y };

        const onReady = (data) => {
            if (!data || data.originalId !== originalId) { return; }
            this.eventBus.off(Events.Tool.DuplicateReady, onReady);
            this._selectObject(data.newId);
        };
        this.eventBus.on(Events.Tool.DuplicateReady, onReady);
        this.eventBus.emit(Events.Tool.DuplicateRequest, { originalId, position: newPos });
    }

    _selectObject(objectId) {
        if (!objectId) { return; }
        const selectTool = this.core?.selectTool;
        if (!selectTool || typeof selectTool.setSelection !== 'function') { return; }
        selectTool.setSelection([objectId]);
        if (typeof selectTool.updateResizeHandles === 'function') { selectTool.updateResizeHandles(); }
    }

    _repositionThrottled() {
        if (this._repositionScheduled) { return; }
        this._repositionScheduled = true;
        const rafId = requestAnimationFrame(() => {
            this._repositionScheduled = false;
            this._repositionRafId = null;
            if (!this.panel) { return; }
            this.reposition();
        });
        this._repositionRafId = rafId;
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') { return; }

        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids.includes(this.currentId)) { this.hide(); return; }

        const posData = { objectId: this.currentId, position: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (!posData.position || !sizeData.size) { return; }

        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        const screenX = posData.position.x * scale + worldX;
        const screenY = posData.position.y * scale + worldY;
        const objectWidth = sizeData.size.width * scale;
        const objectHeight = sizeData.size.height * scale;

        const panelW = this.panel.offsetWidth || 300;
        const panelH = this.panel.offsetHeight || 44;
        let panelX = screenX + (objectWidth / 2) - (panelW / 2);
        let panelY = screenY - panelH - 40;
        if (panelY < 0) { panelY = screenY + objectHeight + 40; }

        const containerRect = this.container.getBoundingClientRect();
        const finalX = Math.max(10, Math.min(panelX, containerRect.width - panelW - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = Math.round(finalX) + 'px';
        this.panel.style.top = Math.round(finalY) + 'px';
    }

    _applyFrameType(typeValue) {
        if (!this.currentId || !this.core?.history) { return; }
        const objectData = this._getObjectData();
        const oldType = (objectData?.properties?.type) || 'custom';
        if (oldType === typeValue) { this._syncTypeFromObject(); return; }

        const willLockAfter = typeValue !== 'custom';

        if (!willLockAfter) {
            const command = new UpdateFrameTypeCommand(this.core, this.currentId, oldType, typeValue, null, null, null, null);
            command.setEventBus(this.core.eventBus);
            this.core.history.executeCommand(command);
        } else {
            const aspectMap = { a4: 210 / 297, '1x1': 1, '4x3': 4 / 3, '16x9': 16 / 9 };
            const aspect = aspectMap[typeValue] || 1;

            const posData = { objectId: this.currentId, position: null };
            const sizeData = { objectId: this.currentId, size: null };
            this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
            this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
            if (!posData.position || !sizeData.size) { return; }

            const oldX = posData.position.x;
            const oldY = posData.position.y;
            const oldW = Math.max(1, sizeData.size.width);
            const oldH = Math.max(1, sizeData.size.height);
            const cx = oldX + oldW / 2;
            const cy = oldY + oldH / 2;

            const area = oldW * oldH;
            const newW = Math.max(1, Math.round(Math.sqrt(area * aspect)));
            const newH = Math.max(1, Math.round(newW / aspect));
            const newX = Math.round(cx - newW / 2);
            const newY = Math.round(cy - newH / 2);

            const command = new UpdateFrameTypeCommand(
                this.core, this.currentId, oldType, typeValue,
                { width: oldW, height: oldH }, { width: newW, height: newH },
                { x: oldX, y: oldY }, { x: newX, y: newY }
            );
            command.setEventBus(this.core.eventBus);
            this.core.history.executeCommand(command);
        }

        this._syncTypeFromObject();
    }

    destroy() {
        this._closeColorPicker();
        this._detachOutside();

        if (this._repositionRafId != null) {
            cancelAnimationFrame(this._repositionRafId);
            this._repositionRafId = null;
        }
        if (this._handlers && this.eventBus?.off) {
            this.eventBus.off(Events.Tool.SelectionAdd, this._handlers.onSelectionAdd);
            this.eventBus.off(Events.Tool.SelectionRemove, this._handlers.onSelectionRemove);
            this.eventBus.off(Events.Tool.SelectionClear, this._handlers.onSelectionClear);
            this.eventBus.off(Events.Object.Deleted, this._handlers.onDeleted);
            this.eventBus.off(Events.Tool.DragStart, this._handlers.onDragStart);
            this.eventBus.off(Events.Tool.DragUpdate, this._handlers.onDragUpdate);
            this.eventBus.off(Events.Tool.DragEnd, this._handlers.onDragEnd);
            this.eventBus.off(Events.Tool.GroupDragUpdate, this._handlers.onGroupDragUpdate);
            this.eventBus.off(Events.Tool.GroupDragStart, this._handlers.onGroupDragStart);
            this.eventBus.off(Events.Tool.GroupDragEnd, this._handlers.onGroupDragEnd);
            this.eventBus.off(Events.Tool.ResizeStart, this._handlers.onResizeStart);
            this.eventBus.off(Events.Tool.ResizeUpdate, this._handlers.onResizeUpdate);
            this.eventBus.off(Events.Tool.ResizeEnd, this._handlers.onResizeEnd);
            this.eventBus.off(Events.Tool.RotateUpdate, this._handlers.onRotateUpdate);
            this.eventBus.off(Events.UI.ZoomPercent, this._handlers.onZoomPercent);
            this.eventBus.off(Events.Tool.PanUpdate, this._handlers.onPanUpdate);
            this.eventBus.off(Events.Viewport.Changed, this._handlers.onViewportChanged);
            this.eventBus.off(Events.Tool.Activated, this._handlers.onActivated);
            this.eventBus.off(Events.Object.StateChanged, this._handlers.onStateChanged);
            this.eventBus.off(Events.History.Changed, this._handlers.onHistoryChanged);
            this.eventBus.off(Events.Object.TransformUpdated, this._handlers.onTransformUpdated);
            this._handlers = null;
        }
        if (this._boundDocumentClickHandler) {
            document.removeEventListener('click', this._boundDocumentClickHandler);
            this._boundDocumentClickHandler = null;
        }
        if (this._boundPickerMouseMove) {
            document.removeEventListener('mousemove', this._boundPickerMouseMove);
        }
        if (this._boundPickerMouseUp) {
            document.removeEventListener('mouseup', this._boundPickerMouseUp);
        }
        if (this.panel && this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        this.panel = null;
        this._colorPopup = null;
        this._colorPickerModal = null;
        this.colorButton = null;
        this.currentId = null;
    }
}
