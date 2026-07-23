import { Events } from '../core/events/Events.js';
import { getObjectGeometry } from './text-properties/TextPropertiesPanelMapper.js';
import { MINDMAP_BRANCH_COLOR_PALETTE } from '../mindmap/MindmapCompoundContract.js';
import { applyMindmapOrientation } from './mindmap/MindmapOrientationLayout.js';
import colorpickerSvg from '../assets/icons/colorpicker.svg?raw';
import './styles/shape-properties-panel.css';
import './styles/mindmap-properties-panel.css';
import {
    ICON_SHAPE, ICON_SHAPE_TRIGGERS, ICON_DIRECTION, ICON_DIRECTION_TRIGGERS,
    ICON_FRAME_STYLE, ICON_LINE, ICON_TEXT_STYLE, ICON_TEXT, ICON_ALIGN,
    frameFillIcon,
} from './mindmap/MindmapPropertiesPanelIcons.js';

const DEFAULT_FILL_PIXI = 0x193042;

const FRAME_BORDER_COLORS = [
    0xab4aba, 0x72dbf8, 0x7fe1cc, 0xb0e64c,
    0xf9da10, 0xffba1a, 0x46a758, 0x12a594,
    0x05a2c2, 0x05a2c2, 0x3e63dd, 0x8e4ec6,
    0xd6409f, 0xe93d82, 0xe54d2e, 0x8d8d8d,
];

function pixiToHex(pixi) {
    if (!Number.isFinite(pixi)) {
        return null;
    }
    return `#${(pixi >>> 0).toString(16).padStart(6, '0')}`;
}

// Осветляет цвет, подмешивая белый (amount 0..1 — доля белого). Используется,
// чтобы фон рамки был светлее её линии при выборе цвета в mpp-frame-border-colors.
function lightenPixi(pixi, amount = 0.8) {
    if (!Number.isFinite(pixi)) {
        return pixi;
    }
    const r = (pixi >> 16) & 0xff;
    const g = (pixi >> 8) & 0xff;
    const b = pixi & 0xff;
    const mix = (c) => Math.round(c + (255 - c) * amount);
    return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

// Иконка «многоточие» — три точки, идентична кнопке «Ещё» панели Текста.
const ICON_MORE = `<svg width="24" height="24" viewBox="0 0 22 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16.2246 12.375C16.984 12.375 17.5996 11.7594 17.5996 11C17.5996 10.2406 16.984 9.625 16.2246 9.625C15.4652 9.625 14.8496 10.2406 14.8496 11C14.8496 11.7594 15.4652 12.375 16.2246 12.375Z"></path><path d="M11 12.375C11.7594 12.375 12.375 11.7594 12.375 11C12.375 10.2406 11.7594 9.625 11 9.625C10.2406 9.625 9.625 10.2406 9.625 11C9.625 11.7594 10.2406 12.375 11 12.375Z"></path><path d="M5.77539 12.375C6.53478 12.375 7.15039 11.7594 7.15039 11C7.15039 10.2406 6.53478 9.625 5.77539 9.625C5.016 9.625 4.40039 10.2406 4.40039 11C4.40039 11.7594 5.016 12.375 5.77539 12.375Z"></path></svg>`;
const ICON_COMMENT = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
}

function hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const f = (n) => Math.max(0, Math.min(255, Math.round((n + m) * 255))).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
}

function hexToHsv(hex) {
    let m = hex.replace('#', '').trim();
    if (m.length === 3) {
        m = m.split('').map(c => c + c).join('');
    }
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return rgbToHsv(r, g, b);
}

/**
 * MindmapPropertiesPanel — всплывающая панель инструментов над выделенной капсулой
 * майндмапа. Визуально идентична панели Текста (тот же класс `text-properties-panel`).
 * Содержит шесть блоков-заготовок: пять кнопок 1–5 (функционал будет добавлен позже)
 * и кнопку «многоточие» с модальным меню, содержимое которого перенесено из Текста.
 */
export class MindmapPropertiesPanel {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;

        this.layer = null;
        this.panel = null;
        this.currentId = null;
        this._docMouseDownAttached = false;
        this._eventBridgeAttached = false;
        this._moreLockLabel = null;
        this._openPopoverEl = null;
        this._directionWrap = null;
        this._wholeBranch = false;
        
        this._sessionCustomColors = [];
        this._colorSwatches = [];
        
        this._boundPickerMouseMove = this._pickerMouseMove.bind(this);
        this._boundPickerMouseUp = this._pickerMouseUp.bind(this);
        this._pickerDragging = false;
        this._pickerHue = 0;
        this._pickerSat = 0;
        this._pickerVal = 1;

        this._onDocMouseDown = this._onDocMouseDown.bind(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'mindmap-properties-layer';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            zIndex: 10050,
        });
        this.container.appendChild(this.layer);

        this._attachEventBridge();
    }

    destroy() {
        this.hide();
        this._detachEventBridge();

        if (this.layer) {
            this.layer.remove();
        }
        this.layer = null;
        this.panel = null;
        this.currentId = null;
    }

    _getSelectedMindmapId() {
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids || ids.length !== 1) {
            return null;
        }

        const id = ids[0];
        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        const mb = pixi?._mb || {};

        if (mb.type !== 'mindmap') {
            return null;
        }

        return id;
    }

    updateFromSelection() {
        const id = this._getSelectedMindmapId();
        if (!id) {
            this.hide();
            return;
        }

        this.currentId = id;
        this.showFor(id);
    }

    showFor(id) {
        if (!this.layer) {
            return;
        }

        if (!this.panel) {
            this.panel = this._createPanel();
            this.layer.appendChild(this.panel);
        }
        if (!this._docMouseDownAttached) {
            document.addEventListener('mousedown', this._onDocMouseDown, true);
            this._docMouseDownAttached = true;
        }

        this.panel.style.display = 'flex';
        this.reposition();
        this._syncControls();
    }

    hide() {
        this.currentId = null;

        if (this.panel) {
            this.panel.style.display = 'none';
            this.panel.querySelectorAll('.tpp-more-dropdown.is-open').forEach((el) => el.classList.remove('is-open'));
            this.panel.querySelectorAll('.ipp-btn.is-active').forEach((el) => el.classList.remove('is-active'));
        }
        this._closePopover();
        this._closeColorPicker();

        if (this._docMouseDownAttached) {
            document.removeEventListener('mousedown', this._onDocMouseDown, true);
            this._docMouseDownAttached = false;
        }
    }

    _createPanel() {
        const panel = document.createElement('div');
        panel.id = 'mindmap-properties-panel';
        panel.className = 'text-properties-panel mindmap-properties-panel';
        // Панель Текста задаёт min-width: 320px под свой богатый набор контролов.
        // Сжимаем по контенту → отступы симметричны слева и справа.
        panel.style.minWidth = '0';
        panel.style.gap = '2px';

        panel.appendChild(this._buildShapeControl());        // 1
        this._directionWrap = this._buildDirectionControl();  // 2 (виден только для корня)
        panel.appendChild(this._directionWrap);
        panel.appendChild(this._buildFrameStyleControl());    // 3
        panel.appendChild(this._buildTextStyleControl());     // 4
        panel.appendChild(this._buildAlignControl());         // 5

        const divider = document.createElement('div');
        divider.className = 'ipp-divider';
        panel.appendChild(divider);

        panel.appendChild(this._makeMoreWrapper());
        
        const pickerModal = this._buildColorPickerModal();
        this._colorPickerModal = pickerModal;
        panel.appendChild(pickerModal);

        return panel;
    }

    // ── Инфраструктура контролов ────────────────────────────────────────────

    _makeControl(iconHtml, title, idBase) {
        const wrap = document.createElement('div');
        wrap.style.position = 'relative';
        wrap.style.display = 'inline-flex';
        if (idBase) {
            wrap.id = `${idBase}-wrap`;
        }

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'spp-trigger';
        trigger.title = title;
        trigger.innerHTML = iconHtml;
        if (idBase) {
            trigger.id = idBase;
        }

        const popover = document.createElement('div');
        popover.className = 'spp-popover';
        popover.style.display = 'none';
        if (idBase) {
            popover.id = `${idBase}-popover`;
        }
        // Панель стоит НАД капсулой майндмапа, поэтому однострочные поповеры
        // раскрываем вверх (над панелью) — иначе они перекрывают карту снизу.
        Object.assign(popover.style, { bottom: '100%', left: '0', marginBottom: '6px' });

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this._togglePopover(popover);
        });

        wrap.appendChild(trigger);
        wrap.appendChild(popover);
        return { wrap, trigger, popover };
    }

    _togglePopover(popoverEl) {
        if (this._openPopoverEl === popoverEl) {
            this._closePopover();
            return;
        }
        this._closePopover();
        popoverEl.style.display = 'block';
        this._openPopoverEl = popoverEl;
        this._closeColorPicker();
    }

    _closePopover() {
        if (this._openPopoverEl) {
            this._openPopoverEl.style.display = 'none';
            this._openPopoverEl = null;
            this._closeColorPicker();
        }
    }

    _sliderRow(labelText, min, max, step, defVal, suffix = '') {
        const row = document.createElement('div');
        row.className = 'spp-border-row spp-border-row--slider';
        const controls = document.createElement('div');
        controls.className = 'spp-slider-controls';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.value = String(defVal);
        slider.className = 'spp-slider-full';
        const valLabel = document.createElement('span');
        valLabel.className = 'spp-slider-value';
        valLabel.textContent = `${defVal}${suffix}`;
        controls.appendChild(slider);
        controls.appendChild(valLabel);
        const lbl = document.createElement('span');
        lbl.className = 'spp-border-label';
        lbl.textContent = labelText;
        row.appendChild(controls);
        row.appendChild(lbl);
        return [row, slider, valLabel];
    }

    _buildColorGrid(onPick, idPrefix, palette = MINDMAP_BRANCH_COLOR_PALETTE) {
        const grid = document.createElement('div');
        grid.className = 'spp-color-grid';
        if (idPrefix) {
            grid.id = idPrefix;
        }
        
        // Reset swatches if building main border color grid
        if (idPrefix === 'mpp-frame-border-colors') {
            // Already reset in _buildFrameStyleControl
        }
        
        palette.forEach((pixi, i) => {
            const hex = typeof pixi === 'number' ? `#${(pixi >>> 0).toString(16).padStart(6, '0')}` : pixi;
            const pixiVal = typeof pixi === 'number' ? pixi : parseInt(pixi.replace('#', ''), 16);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'spp-color-swatch';
            btn.style.backgroundColor = hex;
            btn.dataset.colorPixi = String(pixiVal);
            if (idPrefix) {
                btn.id = `${idPrefix}-${i}`;
            }
            const tick = document.createElement('span');
            tick.className = 'spp-tick';
            btn.appendChild(tick);
            btn.addEventListener('click', () => onPick(pixiVal));
            grid.appendChild(btn);
            if (idPrefix === 'mpp-frame-border-colors') {
                this._colorSwatches.push(btn);
            }
        });
        return grid;
    }

    _buildToggleRow(labelText, onChange) {
        const row = document.createElement('label');
        row.className = 'spp-border-row';
        row.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;justify-content:space-between;';
        const lbl = document.createElement('span');
        lbl.className = 'spp-border-label';
        lbl.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'spp-switch-input';

        const sw = document.createElement('span');
        sw.className = 'spp-switch';
        const thumb = document.createElement('span');
        thumb.className = 'spp-switch-thumb';
        sw.appendChild(thumb);

        input.addEventListener('change', () => {
            sw.classList.toggle('is-on', input.checked);
            onChange(input.checked);
        });

        row.appendChild(lbl);
        row.appendChild(input);
        row.appendChild(sw);
        return { row, input };
    }

    // ── 1. Форма рамки + border-radius ──────────────────────────────────────

    _buildShapeControl() {
        const { wrap, trigger, popover } = this._makeControl(ICON_SHAPE.rounded, 'Форма рамки', 'mpp-shape');
        this._shapeTrigger = trigger;

        const grid = document.createElement('div');
        grid.className = 'spp-kind-grid';
        this._shapeButtons = {};
        [['none', 'Без рамки'], ['pill', 'Пилюля'], ['rounded', 'Скруглённый'], ['rect', 'Прямоугольник']]
            .forEach(([shape, label]) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'spp-kind-btn';
                b.id = `mpp-shape-${shape}`;
                b.title = label;
                b.dataset.shape = shape;
                b.innerHTML = ICON_SHAPE[shape];
                b.addEventListener('click', () => {
                    this._emit({ shape });
                    if (this._shapeTrigger) this._shapeTrigger.innerHTML = ICON_SHAPE[shape];
                    this._syncControls();
                    this._closePopover();
                });
                grid.appendChild(b);
                this._shapeButtons[shape] = b;
            });
        popover.appendChild(grid);

        return wrap;
    }

    // ── 2. Направление ветвления (только корень) ────────────────────────────

    _buildDirectionControl() {
        const { wrap, trigger, popover } = this._makeControl(ICON_DIRECTION.horizontal, 'Направление ветвления', 'mpp-direction');
        this._directionTrigger = trigger;

        const grid = document.createElement('div');
        grid.className = 'spp-kind-grid';
        this._directionButtons = {};
        [['horizontal', 'Горизонтальное'], ['vertical', 'Вертикальное']].forEach(([dir, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'spp-kind-btn';
            b.id = `mpp-direction-${dir}`;
            b.title = label;
            b.dataset.dir = dir;
            b.innerHTML = ICON_DIRECTION[dir];
            b.addEventListener('click', () => {
                this._applyDirection(dir);
                if (this._directionTrigger) this._directionTrigger.innerHTML = ICON_DIRECTION[dir];
                this._syncControls();
                this._closePopover();
            });
            grid.appendChild(b);
            this._directionButtons[dir] = b;
        });
        popover.appendChild(grid);

        return wrap;
    }

    // ── 3. Стиль рамки: тип линии, прозрачность, цвета, вся ветвь ────────────

    _buildColorPickerModal() {
        const modal = document.createElement('div');
        modal.className = 'mpp-color-picker is-mpp-picker';
        modal.id = 'mpp-color-picker-modal';

        // SV Canvas
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'mpp-color-picker__canvas-wrap';

        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 138;
        canvas.className = 'mpp-color-picker__canvas';
        canvas.id = 'mpp-hsv-canvas';
        this._hsvCanvas = canvas;

        const cursor = document.createElement('div');
        cursor.className = 'mpp-color-picker__cursor';
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

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'mpp-color-picker__controls';

        // Sliders row (Eyedropper + Hue + Alpha)
        const slidersRow = document.createElement('div');
        slidersRow.className = 'mpp-color-picker__sliders-row';

        const eyedropper = document.createElement('button');
        eyedropper.className = 'mpp-color-picker__eyedropper';
        eyedropper.id = 'mpp-eyedropper-btn';
        eyedropper.title = 'Пипетка';
        eyedropper.innerHTML = colorpickerSvg;
        eyedropper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof EyeDropper !== 'undefined') {
                new EyeDropper().open().then(({ sRGBHex }) => {
                    this._setPickerFromHex(sRGBHex);
                    this._syncPickerHex();
                    this._applyCurrentPickerColor();
                }).catch(() => {});
            }
        });
        slidersRow.appendChild(eyedropper);

        const slidersCol = document.createElement('div');
        slidersCol.className = 'mpp-color-picker__sliders-col';

        const hueSlider = document.createElement('input');
        hueSlider.type = 'range';
        hueSlider.min = '0';
        hueSlider.max = '360';
        hueSlider.value = '0';
        hueSlider.className = 'mpp-color-picker__hue-slider';
        hueSlider.id = 'mpp-hue-slider';
        this._hueSlider = hueSlider;

        hueSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this._pickerHue = parseInt(e.target.value);
            this._drawHsvCanvas();
            this._syncPickerHex();
            this._syncAlphaSliderBackground();
            this._applyCurrentPickerColor();
        });
        slidersCol.appendChild(hueSlider);

        const alphaSlider = document.createElement('input');
        alphaSlider.type = 'range';
        alphaSlider.min = '0';
        alphaSlider.max = '100';
        alphaSlider.value = '100';
        alphaSlider.className = 'mpp-color-picker__alpha-slider';
        alphaSlider.id = 'mpp-alpha-slider';
        this._pickerAlphaSlider = alphaSlider;
        this._pickerAlpha = 1;

        alphaSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this._pickerAlpha = parseInt(e.target.value) / 100;
            this._applyCurrentPickerColor();
            if (this._opacitySlider) {
                this._opacitySlider.value = String(Math.round(this._pickerAlpha * 100));
                if (this._opacityVal) this._opacityVal.textContent = `${Math.round(this._pickerAlpha * 100)}%`;
            }
        });
        slidersCol.appendChild(alphaSlider);
        
        slidersRow.appendChild(slidersCol);
        controlsDiv.appendChild(slidersRow);

        // Hex input
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.className = 'mpp-color-picker__hex-input';
        hexInput.id = 'mpp-hex-input';
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
                    this._setPickerFromHex(hex);
                    this._applyCurrentPickerColor();
                }
            }
        });
        hexInput.addEventListener('change', (e) => {
            e.stopPropagation();
            const hex = hexInput.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                this._setPickerFromHex(hex);
                this._applyCurrentPickerColor();
            }
        });

        controlsDiv.appendChild(hexInput);
        modal.appendChild(controlsDiv);

        return modal;
    }

    _applyCurrentPickerColor() {
        const hex = hsvToHex(this._pickerHue, this._pickerSat, this._pickerVal);
        const pixi = parseInt(hex.replace('#', ''), 16);
        this._applyBorderColor(pixi, true, this._pickerAlpha);
    }

    _syncAlphaSliderBackground() {
        if (!this._pickerAlphaSlider) return;
        const hex = hsvToHex(this._pickerHue, this._pickerSat, this._pickerVal);
        this._pickerAlphaSlider.style.setProperty('--mpp-alpha-color', hex);
    }

    _buildFrameStyleControl() {
        const { wrap, trigger, popover } = this._makeControl(frameFillIcon(), 'Стиль рамки', 'mpp-frame');
        this._frameTrigger = trigger;

        // Высокий поповер «Стиль рамки» открываем слева от кнопки-триггера,
        // чтобы он не перекрывал майндмап и умещался по вертикали.
        Object.assign(popover.style, {
            bottom: 'auto', top: '0', left: 'auto', right: '100%',
            marginBottom: '0', marginRight: '6px',
        });

        const group = document.createElement('div');
        group.className = 'spp-border-group';
        
        // Ensure arrays are reset so we don't duplicate on rebuild
        this._colorSwatches = [];
        this._customColorBtn = null;

        const styleBtns = document.createElement('div');
        styleBtns.className = 'spp-style-btns';
        this._lineButtons = {};
        [['solid', 'Сплошная'], ['dashed', 'Пунктир'], ['dotted', 'Точки']].forEach(([v, label]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'spp-btn';
            b.id = `mpp-frame-line-${v}`;
            b.title = label;
            b.dataset.line = v;
            b.innerHTML = ICON_LINE[v];
            b.addEventListener('click', () => {
                this._emit({ lineType: v });
                this._syncLineButtons(v);
            });
            styleBtns.appendChild(b);
            this._lineButtons[v] = b;
        });
        group.appendChild(styleBtns);

        const [opRow, opSlider, opVal] = this._sliderRow('Прозрачность', 0, 100, 1, 25, '%');
        opSlider.id = 'mpp-frame-opacity';
        this._opacitySlider = opSlider;
        this._opacityVal = opVal;
        opSlider.addEventListener('input', () => {
            const pct = parseInt(opSlider.value, 10);
            opVal.textContent = `${pct}%`;
            this._emit({ fillAlpha: pct / 100 });
        });
        group.appendChild(opRow);

        const randomRow = document.createElement('div');
        randomRow.className = 'spp-border-row';
        randomRow.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:8px;';

        const randomLbl = document.createElement('span');
        randomLbl.className = 'spp-border-label';
        randomLbl.textContent = 'Случайный цвет';

        const randomBtn = document.createElement('button');
        randomBtn.type = 'button';
        randomBtn.title = 'Случайный цвет';
        randomBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;background:transparent;border:none;padding:0;color:currentColor;flex:0 0 auto;';
        randomBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shuffle-icon lucide-shuffle"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/></svg>`;

        randomBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const randomPixi = FRAME_BORDER_COLORS[Math.floor(Math.random() * FRAME_BORDER_COLORS.length)];
            this._applyBorderColor(randomPixi);
        });

        randomRow.appendChild(randomLbl);
        randomRow.appendChild(randomBtn);
        group.appendChild(randomRow);

        const toggle = this._buildToggleRow('Закрасить всю ветвь', (on) => { this._wholeBranch = on; });
        toggle.input.id = 'mpp-frame-whole-branch';
        this._wholeBranchInput = toggle.input;
        group.appendChild(toggle.row);

        const borderLbl = document.createElement('div');
        borderLbl.className = 'spp-border-label';
        borderLbl.textContent = 'Цвет рамки';
        borderLbl.style.margin = '6px 0 2px';
        group.appendChild(borderLbl);
        
        this._borderColorGrid = this._buildColorGrid((pixi) => this._applyBorderColor(pixi), 'mpp-frame-border-colors', FRAME_BORDER_COLORS);
        this._borderColorGrid.style.marginBottom = '6px';
        group.appendChild(this._borderColorGrid);

        // Custom colours section
        const customSection = document.createElement('div');
        customSection.className = 'fpp-section fpp-section--custom';
        customSection.style.padding = '0';
        customSection.style.borderTop = 'none';
        customSection.style.marginTop = '4px';
        this._customSection = customSection;

        const customLabel = document.createElement('div');
        customLabel.className = 'spp-border-label';
        customLabel.textContent = 'Свои цвета';
        customLabel.style.margin = '8px 0 2px';

        const customRow = document.createElement('div');
        customRow.className = 'fpp-custom-row';
        this._customColorRow = customRow;

        const addBtn = document.createElement('button');
        addBtn.className = 'fpp-add-color-btn';
        addBtn.id = 'mpp-add-color-btn';
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
        // Избегаем дублирования при пересоздании _buildFrameStyleControl
        this._sessionCustomColors.forEach((hex) => {
            this._setCustomSwatch(hex);
        });

        group.appendChild(customSection);

        popover.appendChild(group);
        return wrap;
    }

    // ── 4. Стиль текста B/I/U/S ─────────────────────────────────────────────

    _buildTextStyleControl() {
        const { wrap, popover } = this._makeControl(ICON_TEXT, 'Стиль текста', 'mpp-text-style');
        const row = document.createElement('div');
        row.className = 'spp-style-btns';
        this._textStyleButtons = {};
        [['bold', 'Жирный'], ['italic', 'Курсив'], ['underline', 'Подчёркнутый'], ['strike', 'Зачёркнутый']]
            .forEach(([key, label]) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'spp-btn';
                b.id = `mpp-text-style-${key}`;
                b.title = label;
                b.dataset.textStyle = key;
                b.innerHTML = ICON_TEXT_STYLE[key];
                b.addEventListener('click', () => this._toggleTextStyle(key));
                row.appendChild(b);
                this._textStyleButtons[key] = b;
            });
        popover.appendChild(row);
        return wrap;
    }

    // ── 5. Выравнивание текста ──────────────────────────────────────────────

    _buildAlignControl() {
        const { wrap, trigger, popover } = this._makeControl(ICON_ALIGN.left, 'Выравнивание текста', 'mpp-align');
        this._alignTrigger = trigger;
        const row = document.createElement('div');
        row.className = 'spp-style-btns';
        this._alignButtons = {};
        [['left', 'По левому краю'], ['center', 'По центру'], ['right', 'По правому краю']]
            .forEach(([align, label]) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'spp-btn';
                b.id = `mpp-align-${align}`;
                b.title = label;
                b.dataset.align = align;
                b.innerHTML = ICON_ALIGN[align];
                b.addEventListener('click', () => {
                    this._emit({ textAlign: align });
                    if (this._alignTrigger) this._alignTrigger.innerHTML = ICON_ALIGN[align];
                    this._syncAlign(align);
                    this._closePopover();
                });
                row.appendChild(b);
                this._alignButtons[align] = b;
            });
        popover.appendChild(row);
        return wrap;
    }

    // ── Применение изменений ────────────────────────────────────────────────

    _emit(properties) {
        if (!this.currentId || !properties) return;
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties },
        });
    }

    _getNodeData(id = this.currentId) {
        if (!id) return null;
        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : (this.core?.state?.state?.objects || []);
        return objects.find((o) => o && o.id === id) || null;
    }

    _toggleTextStyle(key) {
        const node = this._getNodeData();
        const cur = { ...(node?.properties?.textStyle || {}) };
        cur[key] = !cur[key];
        this._emit({ textStyle: cur });
        if (this._textStyleButtons?.[key]) {
            this._textStyleButtons[key].classList.toggle('spp-btn--active', !!cur[key]);
        }
    }

    _updateFrameIcon(pixi) {
        if (!this._frameTrigger) {
            return;
        }
        const hex = pixiToHex(pixi) || pixiToHex(DEFAULT_FILL_PIXI);
        this._frameTrigger.innerHTML = frameFillIcon(hex, 0.8);
    }

    _applyBorderColor(pixi, keepPickerOpen = false, alpha = null) {
        const root = this._getNodeData();
        if (!root) return;
        this._setNodeBorderColor(root, pixi, alpha);

        if (this._wholeBranch) {
            const compoundId = root.properties?.mindmap?.compoundId;
            const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : (this.core?.state?.state?.objects || []);
            objects.forEach((node) => {
                if (!node || node.type !== 'mindmap' || node.id === root.id) return;
                if (node.properties?.mindmap?.compoundId !== compoundId) return;
                this._setNodeBorderColor(node, pixi, alpha);
            });
        }
        this._updateFrameIcon(lightenPixi(pixi));
        this._syncBorderColorGrid(pixi);
        // Не закрываем попап стилей при выборе цвета — только палитру, если открыта (и если не попросили оставить открытой)
        if (!keepPickerOpen) {
            this._closeColorPicker();
        }
    }

    _syncBorderColorGrid(pixi) {
        if (!this._borderColorGrid) return;
        this._colorSwatches.forEach((btn) => btn.classList.remove('spp-color-swatch--active'));
        
        if (pixi === null || !Number.isFinite(pixi)) return;
        
        let colorMatch = this._colorSwatches.find((btn) => Number(btn.dataset.colorPixi) === Number(pixi) && btn !== this._customColorBtn);
        
        if (!colorMatch) {
            const hex = pixiToHex(pixi);
            if (hex) {
                this._setCustomSwatch(hex.toUpperCase());
                colorMatch = this._customColorBtn;
            }
        }
        
        if (colorMatch) {
            colorMatch.classList.add('spp-color-swatch--active');
        }
    }

    _setNodeBorderColor(node, pixi, alpha = null) {
        const meta = { ...(node.properties?.mindmap || {}) };
        if (Object.keys(meta).length > 0) {
            meta.branchColor = pixi;
        }
        const properties = { strokeColor: pixi, fillColor: lightenPixi(pixi) };
        if (alpha !== null) {
            properties.fillAlpha = alpha;
        } else {
            // Keep default behavior: reset alpha to 1 when choosing a preset color
            properties.fillAlpha = 1;
        }
        if (Object.keys(meta).length > 0) {
            properties.mindmap = meta;
        }
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: node.id,
            updates: { properties },
        });
    }

    /**
     * Переключает ориентацию корневой карты между horizontal (дети слева/справа)
     * и vertical (дети под родителем). Переставляет side узлов ветви и вызывает
     * рекурсивную раскладку MindmapOrientationLayout. Прежние left/right стороны
     * сохраняются в meta.hSide, чтобы возврат к горизонтали восстанавливал разбивку.
     */
    _applyDirection(orientation) {
        const root = this._getNodeData();
        if (!root || root.properties?.mindmap?.role !== 'root') return;
        const current = root.properties?.mindmap?.direction || 'horizontal';
        if (current === orientation) return;

        const compoundId = root.properties?.mindmap?.compoundId;
        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : (this.core?.state?.state?.objects || []);
        objects.forEach((node) => {
            if (!node || node.type !== 'mindmap' || node.id === root.id) return;
            if (node.properties?.mindmap?.compoundId !== compoundId) return;

            const meta = { ...(node.properties?.mindmap || {}) };
            if (orientation === 'vertical') {
                if (meta.side === 'left' || meta.side === 'right') {
                    meta.hSide = meta.side;
                }
                meta.side = 'bottom';
            } else {
                meta.side = (meta.hSide === 'left' || meta.hSide === 'right')
                    ? meta.hSide
                    : (meta.side === 'left' || meta.side === 'right' ? meta.side : 'right');
            }
            node.properties.mindmap = meta;
        });

        const rootMeta = { ...(root.properties?.mindmap || {}), direction: orientation };
        root.properties.mindmap = rootMeta;

        applyMindmapOrientation({
            core: this.core,
            eventBus: this.eventBus,
            rootId: root.id,
            orientation,
        });

        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: root.id,
            updates: { properties: { mindmap: rootMeta } },
        });
        this.core?.state?.markDirty?.();
        this.reposition();
    }

    // ── Синхронизация контролов с состоянием узла ───────────────────────────

    _syncShapeButtons(shape) {
        if (!this._shapeButtons) return;
        Object.entries(this._shapeButtons).forEach(([s, b]) => {
            b.classList.toggle('spp-kind-btn--active', s === shape);
        });
    }

    _syncLineButtons(line) {
        if (!this._lineButtons) return;
        Object.entries(this._lineButtons).forEach(([v, b]) => {
            b.classList.toggle('spp-btn--active', v === line);
        });
    }

    _syncAlign(align) {
        if (!this._alignButtons) return;
        Object.entries(this._alignButtons).forEach(([a, b]) => {
            b.classList.toggle('spp-btn--active', a === align);
        });
    }

    _openColorPicker() {
        if (!this._colorPickerModal || !this._openPopoverEl || !this._addColorBtn) { return; }

        this._colorPickerModal.classList.add('is-open');

        const popupRect = this._openPopoverEl.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();
        const pickerW = this._colorPickerModal.offsetWidth || 240;

        // Поповер «Стиль рамки» открыт слева от панели → палитру ставим слева от него.
        // Если ушли бы за левый край окна — ставим справа от поповера.
        let leftPx = popupRect.left - panelRect.left - pickerW - 6;
        if (panelRect.left + leftPx < 8) {
            leftPx = popupRect.right - panelRect.left + 6;
        }
        this._colorPickerModal.style.left = leftPx + 'px';
        this._colorPickerModal.style.top = (popupRect.top - panelRect.top) + 'px';

        const node = this._getNodeData();
        const stroke = node?.properties?.strokeColor;
        let hex = '#ffffff';
        if (Number.isFinite(stroke)) {
            hex = pixiToHex(stroke);
            this._setPickerFromHex(hex);
        } else {
            this._pickerHue = 0;
            this._pickerSat = 0;
            this._pickerVal = 1;
            if (this._hueSlider) { this._hueSlider.value = '0'; }
            this._drawHsvCanvas();
        }

        const alpha = Number.isFinite(node?.properties?.fillAlpha) ? node.properties.fillAlpha : 0.25;
        this._pickerAlpha = alpha;
        if (this._pickerAlphaSlider) {
            this._pickerAlphaSlider.value = String(Math.round(alpha * 100));
        }

        this._syncPickerHex();
        this._syncAlphaSliderBackground();
    }

    _closeColorPicker() {
        if (this._colorPickerModal) { this._colorPickerModal.classList.remove('is-open'); }
        document.removeEventListener('mousemove', this._boundPickerMouseMove);
        document.removeEventListener('mouseup', this._boundPickerMouseUp);
        
        if (this._pickerDragging) {
             this._pickerDragging = false;
        }
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
        this._syncAlphaSliderBackground();
        this._applyCurrentPickerColor();
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


    _setCustomSwatch(hex) {
        if (!this._customColorRow || !this._addColorBtn) return;
        
        const pixiVal = parseInt(hex.replace('#', ''), 16);
        this._sessionCustomColors = [hex];
        
        if (!this._customColorBtn) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'spp-color-swatch spp-color-swatch--custom';
            
            const tick = document.createElement('span');
            tick.className = 'spp-tick';
            btn.appendChild(tick);
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._customColorBtn) {
                    this._applyBorderColor(Number(this._customColorBtn.dataset.colorPixi));
                }
            });

            this._customColorRow.insertBefore(btn, this._addColorBtn);
            this._colorSwatches.push(btn);
            this._customColorBtn = btn;
        }
        
        this._customColorBtn.title = hex;
        this._customColorBtn.dataset.colorPixi = String(pixiVal);
        this._customColorBtn.style.backgroundColor = hex;
        // Make sure it's visible
        this._customColorBtn.style.display = 'block';
    }

    _syncControls() {
        const node = this._getNodeData();
        if (!node) return;
        const props = node.properties || {};

        const shape = (props.shape === 'none' || props.shape === 'pill' || props.shape === 'rect') ? props.shape : 'rounded';
        this._syncShapeButtons(shape);
        if (this._shapeTrigger && ICON_SHAPE[shape]) this._shapeTrigger.innerHTML = ICON_SHAPE[shape];

        const line = (props.lineType === 'dashed' || props.lineType === 'dotted') ? props.lineType : 'solid';
        this._syncLineButtons(line);

        const alpha = Number.isFinite(props.fillAlpha) ? props.fillAlpha : 0.25;
        const pct = Math.round(alpha * 100);
        if (this._opacitySlider) this._opacitySlider.value = String(pct);
        if (this._opacityVal) this._opacityVal.textContent = `${pct}%`;
        
        if (this._pickerAlphaSlider) {
            this._pickerAlphaSlider.value = String(pct);
            this._pickerAlpha = alpha;
        }

        this._updateFrameIcon(Number.isFinite(props.fillColor) ? props.fillColor : DEFAULT_FILL_PIXI);
        this._syncBorderColorGrid(Number.isFinite(props.strokeColor) ? props.strokeColor : null);

        const style = props.textStyle || {};
        if (this._textStyleButtons) {
            Object.entries(this._textStyleButtons).forEach(([k, b]) => {
                b.classList.toggle('spp-btn--active', !!style[k]);
            });
        }

        const align = (props.textAlign === 'center' || props.textAlign === 'right') ? props.textAlign : 'left';
        this._syncAlign(align);
        if (this._alignTrigger && ICON_ALIGN[align]) this._alignTrigger.innerHTML = ICON_ALIGN[align];

        const isRoot = props.mindmap?.role === 'root';
        if (this._directionWrap) {
            this._directionWrap.style.display = isRoot ? 'inline-flex' : 'none';
        }
        if (isRoot && this._directionTrigger) {
            const dir = props.mindmap?.direction === 'vertical' ? 'vertical' : 'horizontal';
            this._directionTrigger.innerHTML = ICON_DIRECTION[dir];
            if (this._directionButtons) {
                Object.entries(this._directionButtons).forEach(([d, b]) => {
                    b.classList.toggle('spp-kind-btn--active', d === dir);
                });
            }
        }
    }

    _makeMoreWrapper() {
        const wrapper = document.createElement('div');
        wrapper.className = 'tpp-btn-wrapper';
        wrapper.dataset.id = 'mpp-btn-wrapper';
        wrapper.style.cssText = 'position:relative;display:inline-flex;';

        const mainBtn = document.createElement('button');
        mainBtn.className = 'ipp-btn';
        mainBtn.title = 'Ещё';
        mainBtn.id = 'mpp-btn-more';
        mainBtn.dataset.id = 'mpp-btn-more';
        mainBtn.innerHTML = ICON_MORE;

        const dropdown = document.createElement('div');
        dropdown.className = 'tpp-more-dropdown';

        const items = [
            { id: 'copy', label: 'Копировать', shortcut: 'Ctrl+C' },
            { id: 'copy-link', label: 'Копировать ссылку на объект' },
            { divider: true },
            { id: 'bring-front', label: 'На передний план', shortcut: ']' },
            { id: 'bring-forward', label: 'Переместить вперёд', shortcut: 'Ctrl+]' },
            { id: 'send-backward', label: 'Переместить назад', shortcut: 'Ctrl+[' },
            { id: 'send-back', label: 'На задний план', shortcut: '[' },
            { divider: true },
            { id: 'lock', label: 'Заблокировать', shortcut: 'Ctrl+Shift+L' },
            { id: 'duplicate', label: 'Дублировать', shortcut: 'Ctrl+D' },
            { divider: true },
            { id: 'add-comment', label: 'Добавить комментарий', icon: ICON_COMMENT },
            { divider: true },
            { id: 'delete', label: 'Удалить', shortcut: 'Delete' },
        ];

        items.forEach((item) => {
            if (item.divider) {
                const div = document.createElement('div');
                div.className = 'tpp-dropdown-divider';
                dropdown.appendChild(div);
                return;
            }

            const btn = document.createElement('button');
            btn.className = 'tpp-dropdown-item';
            if (item.id) {
                btn.id = `mpp-more-${item.id}`;
                btn.dataset.id = `mpp-more-${item.id}`;
            }

            if (item.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'tpp-dropdown-icon';
                iconSpan.innerHTML = item.icon;
                btn.appendChild(iconSpan);
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;
            btn.appendChild(labelSpan);

            if (item.shortcut) {
                const shortcutSpan = document.createElement('span');
                shortcutSpan.className = 'tpp-dropdown-item-shortcut';
                shortcutSpan.textContent = item.shortcut;
                btn.appendChild(shortcutSpan);
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const { eventBus, currentId } = this;

                if (item.id === 'copy') {
                    eventBus.emit(Events.Keyboard.Copy);
                } else if (item.id === 'bring-front') {
                    if (currentId) eventBus.emit(Events.UI.LayerBringToFront, { objectId: currentId });
                } else if (item.id === 'bring-forward') {
                    if (currentId) eventBus.emit(Events.UI.LayerBringForward, { objectId: currentId });
                } else if (item.id === 'send-backward') {
                    if (currentId) eventBus.emit(Events.UI.LayerSendBackward, { objectId: currentId });
                } else if (item.id === 'send-back') {
                    if (currentId) eventBus.emit(Events.UI.LayerSendToBack, { objectId: currentId });
                } else if (item.id === 'lock') {
                    this._toggleLocked();
                } else if (item.id === 'duplicate') {
                    this._duplicateObject();
                } else if (item.id === 'add-comment') {
                    if (currentId) eventBus.emit(Events.Comment.OpenImageDraft, { objectId: currentId });
                } else if (item.id === 'delete') {
                    if (currentId) eventBus.emit(Events.Tool.ObjectsDelete, { objects: [currentId] });
                }

                dropdown.classList.remove('is-open');
                mainBtn.classList.remove('is-active');
            });

            if (item.id === 'lock') {
                this._moreLockLabel = labelSpan;
            }

            dropdown.appendChild(btn);
        });

        mainBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('is-open');

            document.querySelectorAll('.tpp-more-dropdown.is-open').forEach((el) => el.classList.remove('is-open'));
            document.querySelectorAll('.ipp-btn.is-active').forEach((el) => el.classList.remove('is-active'));

            if (!isOpen) {
                if (this._moreLockLabel) {
                    this._moreLockLabel.textContent = this._isLocked() ? 'Разблокировать' : 'Заблокировать';
                }
                const rect = mainBtn.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + 6) + 'px';
                dropdown.style.left = (rect.right - 220) + 'px';
                dropdown.classList.add('is-open');
                requestAnimationFrame(() => {
                    const left = Math.max(4, rect.right - dropdown.offsetWidth);
                    dropdown.style.left = left + 'px';
                });
                mainBtn.classList.add('is-active');
            }
        });

        wrapper.appendChild(mainBtn);
        wrapper.appendChild(dropdown);
        return wrapper;
    }

    _isLocked() {
        if (!this.currentId) return false;
        const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
        const obj = objects.find((o) => o.id === this.currentId);
        return !!(obj?.properties?.locked);
    }

    _toggleLocked() {
        if (!this.currentId) return;
        const newLocked = !this._isLocked();
        this.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.currentId,
            updates: { properties: { locked: newLocked } },
        });
        if (this._moreLockLabel) {
            this._moreLockLabel.textContent = newLocked ? 'Разблокировать' : 'Заблокировать';
        }
        this.reposition();
    }

    _duplicateObject() {
        if (!this.currentId) return;

        const posData = { objectId: this.currentId, position: null };
        const sizeData = { objectId: this.currentId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) return;

        let w = sizeData.size.width;
        if (typeof w !== 'number' || isNaN(w)) {
            const pixiObj = this.core?.pixi?.objects?.get(this.currentId);
            w = pixiObj ? pixiObj.width : 160;
        }

        const originalId = this.currentId;
        const newPos = {
            x: posData.position.x + (w || 160) + 14,
            y: posData.position.y,
        };

        const onReady = (data) => {
            if (!data || data.originalId !== originalId) return;
            this.eventBus.off(Events.Tool.DuplicateReady, onReady);
            this._selectObject(data.newId);
        };
        this.eventBus.on(Events.Tool.DuplicateReady, onReady);

        this.eventBus.emit(Events.Tool.DuplicateRequest, { originalId, position: newPos });
    }

    _selectObject(objectId) {
        if (!objectId) return;
        const selectTool = this.core?.selectTool;
        if (!selectTool || typeof selectTool.setSelection !== 'function') return;
        selectTool.setSelection([objectId]);
        if (typeof selectTool.updateResizeHandles === 'function') {
            selectTool.updateResizeHandles();
        }
    }

    reposition() {
        if (!this.panel || !this.currentId || this.panel.style.display === 'none') {
            return;
        }

        const geometry = getObjectGeometry(this.eventBus, this.currentId);
        if (!geometry.position || !geometry.size) {
            return;
        }

        const worldLayer = this.core?.pixi?.worldLayer;
        const scale = worldLayer?.scale?.x || 1;
        const worldX = worldLayer?.x || 0;
        const worldY = worldLayer?.y || 0;

        const screenX = geometry.position.x * scale + worldX;
        const screenY = geometry.position.y * scale + worldY;
        const objectWidth = geometry.size.width * scale;

        const panelX = screenX + (objectWidth / 2) - (this.panel.offsetWidth / 2);
        const panelY = screenY - this.panel.offsetHeight - 20;

        const containerRect = this.container.getBoundingClientRect();
        const toolbarEl = document.querySelector('.moodboard-toolbar');
        const toolbarRight = toolbarEl
            ? toolbarEl.getBoundingClientRect().right - containerRect.left + 10
            : 10;
        const finalX = Math.max(toolbarRight, Math.min(panelX, containerRect.width - this.panel.offsetWidth - 10));
        const finalY = Math.max(10, panelY);

        this.panel.style.left = `${Math.round(finalX)}px`;
        this.panel.style.top = `${Math.round(finalY)}px`;
    }

    _onDocMouseDown(event) {
        if (!this.panel || !event.target) {
            return;
        }

        if (this._colorPickerModal && this._colorPickerModal.contains(event.target)) {
            return;
        }

        // Закрываем открытый попап при клике мимо него. Клик по другому триггеру
        // пропускаем — его собственный обработчик переключит нужный попап.
        if (this._openPopoverEl && !this._openPopoverEl.contains(event.target)) {
            const onTrigger = typeof event.target.closest === 'function' && event.target.closest('.spp-trigger');
            if (!onTrigger) {
                this._closePopover();
            }
        }

        if (this.panel.contains(event.target)) {
            return;
        }

        // Клики внутри canvas-контейнера управляются через EventBus (SelectionClear).
        if (this.container.contains(event.target)) {
            return;
        }

        this.hide();
    }

    _attachEventBridge() {
        if (this._eventBridgeAttached) {
            return;
        }

        this._eventBridgeHandlers = {
            onSelectionAdd: () => this.updateFromSelection(),
            onSelectionRemove: () => this.updateFromSelection(),
            onSelectionClear: () => this.hide(),
            onDragUpdate: () => this.reposition(),
            onGroupDragUpdate: () => this.reposition(),
            onResizeUpdate: () => this.reposition(),
            onRotateUpdate: () => this.reposition(),
            onZoomPercent: () => this.reposition(),
            onPanUpdate: () => this.reposition(),
            onViewportChanged: () => this.reposition(),
            onDeleted: ({ objectId }) => {
                if (this.currentId && objectId === this.currentId) {
                    this.hide();
                }
            },
        };

        const h = this._eventBridgeHandlers;
        this.eventBus.on(Events.Tool.SelectionAdd, h.onSelectionAdd);
        this.eventBus.on(Events.Tool.SelectionRemove, h.onSelectionRemove);
        this.eventBus.on(Events.Tool.SelectionClear, h.onSelectionClear);
        this.eventBus.on(Events.Tool.DragUpdate, h.onDragUpdate);
        this.eventBus.on(Events.Tool.GroupDragUpdate, h.onGroupDragUpdate);
        this.eventBus.on(Events.Tool.ResizeUpdate, h.onResizeUpdate);
        this.eventBus.on(Events.Tool.RotateUpdate, h.onRotateUpdate);
        this.eventBus.on(Events.UI.ZoomPercent, h.onZoomPercent);
        this.eventBus.on(Events.Tool.PanUpdate, h.onPanUpdate);
        this.eventBus.on(Events.Viewport.Changed, h.onViewportChanged);
        this.eventBus.on(Events.Object.Deleted, h.onDeleted);

        this._eventBridgeAttached = true;
    }

    _detachEventBridge() {
        if (!this._eventBridgeAttached || !this._eventBridgeHandlers || !this.eventBus?.off) {
            this._eventBridgeAttached = false;
            return;
        }

        const h = this._eventBridgeHandlers;
        this.eventBus.off(Events.Tool.SelectionAdd, h.onSelectionAdd);
        this.eventBus.off(Events.Tool.SelectionRemove, h.onSelectionRemove);
        this.eventBus.off(Events.Tool.SelectionClear, h.onSelectionClear);
        this.eventBus.off(Events.Tool.DragUpdate, h.onDragUpdate);
        this.eventBus.off(Events.Tool.GroupDragUpdate, h.onGroupDragUpdate);
        this.eventBus.off(Events.Tool.ResizeUpdate, h.onResizeUpdate);
        this.eventBus.off(Events.Tool.RotateUpdate, h.onRotateUpdate);
        this.eventBus.off(Events.UI.ZoomPercent, h.onZoomPercent);
        this.eventBus.off(Events.Tool.PanUpdate, h.onPanUpdate);
        this.eventBus.off(Events.Viewport.Changed, h.onViewportChanged);
        this.eventBus.off(Events.Object.Deleted, h.onDeleted);

        this._eventBridgeHandlers = null;
        this._eventBridgeAttached = false;
    }
}
