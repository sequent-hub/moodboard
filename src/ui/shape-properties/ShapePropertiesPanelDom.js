import {
    FONT_OPTIONS,
    FONT_SIZE_OPTIONS,
    TEXT_COLOR_PRESETS,
} from '../text-properties/TextPropertiesPanelMapper.js';
import transparentIconSvg from '../../assets/icons/transparent.svg?raw';
import plusIconSvg from '../../assets/icons/plus.svg?raw';
import { createColorPicker } from './ColorPickerPopover.js';

const CUSTOM_COLOR_KEYS = {
    fill:   'mb:shapeFill:customColor',
    border: 'mb:shapeBorder:customColor',
    text:   'mb:shapeText:customColor',
};

function loadCustomColor(storageKey) {
    try {
        const v = localStorage.getItem(storageKey);
        return v && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : null;
    } catch {
        return null;
    }
}

function saveCustomColor(storageKey, hex) {
    try {
        localStorage.setItem(storageKey, hex.toUpperCase());
    } catch {
        /* localStorage недоступен — сохранение пропускаем */
    }
}

/**
 * Добавляет в цветовой грид кнопку кастомного цвета (плюс) с отдельным
 * поповером-палитрой и один кликабельный кружок выбранного цвета.
 *
 * @param {object} inst  Панель свойств.
 * @param {object} cfg
 * @param {HTMLElement}   cfg.grid       Грид, куда добавить кружок и плюс.
 * @param {HTMLElement[]} cfg.swatches   Массив свотчей блока (для active-состояния).
 * @param {string}        cfg.storageKey Ключ localStorage.
 * @param {() => string}  cfg.getFallbackHex  Текущий цвет объекта для инициализации палитры.
 * @param {(hex: string) => void} cfg.applyColor  Применение цвета (emit + индикатор).
 * @param {boolean}       [cfg.closeParentOnCircleClick=true]
 */
function attachCustomColorControl(inst, cfg) {
    const {
        grid, swatches, storageKey, getFallbackHex, applyColor,
        closeParentOnCircleClick = true,
    } = cfg;

    const customSwatch = document.createElement('button');
    customSwatch.type = 'button';
    customSwatch.className = 'spp-color-swatch spp-color-swatch--custom';
    customSwatch.title = 'Кастомный цвет';
    customSwatch.style.display = 'none';
    const tick = document.createElement('span');
    tick.className = 'spp-tick';
    customSwatch.appendChild(tick);
    customSwatch.addEventListener('click', () => {
        const hex = customSwatch.dataset.colorHex;
        if (!hex) return;
        swatches.forEach(s => s.classList.remove('spp-color-swatch--active'));
        customSwatch.classList.add('spp-color-swatch--active');
        applyColor(hex);
        if (closeParentOnCircleClick) inst._closePopover();
    });
    grid.appendChild(customSwatch);
    swatches.push(customSwatch);

    const saved = loadCustomColor(storageKey);
    if (saved) {
        customSwatch.style.display = '';
        customSwatch.style.backgroundColor = saved;
        customSwatch.dataset.colorHex = saved;
    }

    const anchor = document.createElement('div');
    anchor.className = 'spp-cp-anchor';

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.className = 'spp-color-swatch spp-color-custom-btn';
    plusBtn.title = 'Выбрать цвет';
    plusBtn.innerHTML = plusIconSvg;
    anchor.appendChild(plusBtn);

    const pickerPopover = document.createElement('div');
    pickerPopover.className = 'spp-popover spp-cp-popover';
    pickerPopover.style.display = 'none';
    const picker = createColorPicker(saved || '#FFFFFF');
    pickerPopover.appendChild(picker.el);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'spp-cp-confirm';
    confirmBtn.textContent = 'Готово';
    confirmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hex = picker.getHex().toUpperCase();
        customSwatch.style.display = '';
        customSwatch.style.backgroundColor = hex;
        customSwatch.dataset.colorHex = hex;
        saveCustomColor(storageKey, hex);
        swatches.forEach(s => s.classList.remove('spp-color-swatch--active'));
        customSwatch.classList.add('spp-color-swatch--active');
        applyColor(hex);
        pickerPopover.style.display = 'none';
    });
    picker.el.appendChild(confirmBtn);
    anchor.appendChild(pickerPopover);
    grid.appendChild(anchor);

    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = pickerPopover.style.display === 'none';
        if (inst._openCustomPickerPopover && inst._openCustomPickerPopover !== pickerPopover) {
            inst._openCustomPickerPopover.style.display = 'none';
        }
        pickerPopover.style.display = show ? 'block' : 'none';
        inst._openCustomPickerPopover = show ? pickerPopover : null;
        if (show) picker.setHex(customSwatch.dataset.colorHex || getFallbackHex() || '#FFFFFF');
    });

    return { customSwatch, plusBtn, picker, pickerPopover };
}

// ── Константы ─────────────────────────────────────────────────────────────────

export const FILL_COLORS = [
    { name: 'Серый',       hex: '#D4D4D4', pixi: 0xD4D4D4 },
    { name: 'Темно-серый', hex: '#737373', pixi: 0x737373 },
    { name: 'Черный',      hex: '#1A1A1A', pixi: 0x1A1A1A },
    { name: 'Синий',       hex: '#2563EB', pixi: 0x2563EB },
    { name: 'Красный',     hex: '#EF4444', pixi: 0xEF4444 },
    { name: 'Зеленый',     hex: '#22C55E', pixi: 0x22C55E },
    { name: 'Желтый',      hex: '#EAB308', pixi: 0xEAB308 },
    { name: 'Фиолетовый',  hex: '#A855F7', pixi: 0xA855F7 },
    { name: 'Белый',       hex: '#FFFFFF', pixi: 0xFFFFFF },
    { name: 'Прозрачный',  hex: '#E5E7EB', pixi: 0xE5E7EB },
    { name: 'Оранжевый',   hex: '#F97316', pixi: 0xF97316 },
    { name: 'Розовый',     hex: '#EC4899', pixi: 0xEC4899 },
    { name: 'Светло-серый', hex: '#999999', pixi: 0x999999 },
    { name: 'Малиновый',   hex: '#FF2D55', pixi: 0xFF2D55 },
    { name: 'Пурпурный',   hex: '#CB30E0', pixi: 0xCB30E0 },
    { name: 'Индиго',      hex: '#6155F5', pixi: 0x6155F5 },
    { name: 'Голубой',     hex: '#00C0E8', pixi: 0x00C0E8 },
    { name: 'Золотой',     hex: '#FFCC00', pixi: 0xFFCC00 },
];

export const BORDER_COLORS = [
    { name: 'Серый',       hex: '#D4D4D4', pixi: 0xD4D4D4 },
    { name: 'Темно-серый', hex: '#737373', pixi: 0x737373 },
    { name: 'Черный',      hex: '#1A1A1A', pixi: 0x1A1A1A },
    { name: 'Синий',       hex: '#2563EB', pixi: 0x2563EB },
    { name: 'Красный',     hex: '#EF4444', pixi: 0xEF4444 },
    { name: 'Зеленый',     hex: '#22C55E', pixi: 0x22C55E },
    { name: 'Желтый',      hex: '#EAB308', pixi: 0xEAB308 },
    { name: 'Фиолетовый',  hex: '#A855F7', pixi: 0xA855F7 },
    { name: 'Белый',       hex: '#FFFFFF', pixi: 0xFFFFFF },
    { name: 'Прозрачный',  hex: '#E5E7EB', pixi: 0xE5E7EB },
    { name: 'Оранжевый',   hex: '#F97316', pixi: 0xF97316 },
    { name: 'Розовый',     hex: '#EC4899', pixi: 0xEC4899 },
    { name: 'Светло-серый', hex: '#999999', pixi: 0x999999 },
    { name: 'Малиновый',   hex: '#FF2D55', pixi: 0xFF2D55 },
    { name: 'Пурпурный',   hex: '#CB30E0', pixi: 0xCB30E0 },
    { name: 'Индиго',      hex: '#6155F5', pixi: 0x6155F5 },
    { name: 'Голубой',     hex: '#00C0E8', pixi: 0x00C0E8 },
    { name: 'Золотой',     hex: '#FFCC00', pixi: 0xFFCC00 },
];

export const SHAPE_KINDS = [
    { kind: 'square',        label: 'Прямоугольник' },
    { kind: 'rounded',       label: 'Скруглённый' },
    { kind: 'circle',        label: 'Эллипс' },
    { kind: 'triangle',      label: 'Треугольник' },
    { kind: 'diamond',       label: 'Ромб' },
    { kind: 'parallelogram', label: 'Параллелограмм' },
    { kind: 'arrow',         label: 'Стрелка' },
];

export const SHAPE_ICONS = {
    square:        '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="0" stroke="currentColor" stroke-width="1.5"/></svg>',
    rounded:       '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.5"/></svg>',
    circle:        '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><ellipse cx="11" cy="11" rx="9" ry="9" stroke="currentColor" stroke-width="1.5"/></svg>',
    triangle:      '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><polygon points="11,2 21,20 1,20" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    diamond:       '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><polygon points="11,2 21,11 11,20 1,11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    parallelogram: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><polygon points="5,18 19,18 17,4 3,4" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    arrow:         '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><polygon points="2,8 2,14 13,14 13,18 21,11 13,4 13,8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
};

export const ALIGN_ICONS = {
    left: '<svg width="16" height="14" viewBox="0 0 16 14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>',
    center: '<svg width="16" height="14" viewBox="0 0 16 14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>',
    right: '<svg width="16" height="14" viewBox="0 0 16 14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>',
};

// ── Строители секций ──────────────────────────────────────────────────────────

export function sep() {
    const s = document.createElement('div');
    s.className = 'spp-sep';
    return s;
}

export function buildColorGrid(container, colors, onPick, swatchesOut) {
    const grid = document.createElement('div');
    grid.className = 'spp-color-grid';
    colors.forEach((color) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'spp-color-swatch' +
            (color.hex.toUpperCase() === '#FFFFFF' ? ' spp-color-swatch--white' : '');
        btn.style.backgroundColor = color.hex;
        btn.title = color.name;
        btn.dataset.colorHex = color.hex.toUpperCase();
        const tick = document.createElement('span');
        tick.className = 'spp-tick';
        btn.appendChild(tick);
        btn.addEventListener('click', () => {
            swatchesOut.forEach(s => s.classList.remove('spp-color-swatch--active'));
            btn.classList.add('spp-color-swatch--active');
            onPick(color);
        });
        grid.appendChild(btn);
        swatchesOut.push(btn);
    });
    container.appendChild(grid);
    return grid;
}

export function buildShapeGroup(inst) {
    const trigger = document.createElement('button');
    trigger.className = 'spp-trigger';
    trigger.title = 'Форма';
    trigger.innerHTML = SHAPE_ICONS['square'];
    inst._kindTrigger = trigger;

    const popover = document.createElement('div');
    popover.className = 'spp-popover';
    Object.assign(popover.style, { top: '100%', left: '0', marginTop: '4px' });

    const grid = document.createElement('div');
    grid.className = 'spp-kind-grid';

    inst._kindButtons = {};
    SHAPE_KINDS.forEach(({ kind, label }) => {
        const btn = document.createElement('button');
        btn.className = 'spp-kind-btn';
        btn.title = label;
        btn.dataset.kind = kind;
        btn.innerHTML = SHAPE_ICONS[kind] || '';
        btn.addEventListener('click', () => {
            inst._emit({ updates: { properties: { kind } } });
            inst._closePopover();
        });
        grid.appendChild(btn);
        inst._kindButtons[kind] = btn;
    });

    popover.appendChild(grid);
    inst._kindPopover = popover;

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.appendChild(trigger);
    wrap.appendChild(popover);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        inst._togglePopover(popover);
    });

    return wrap;
}

export function buildFillGroup(inst) {
    const btn = document.createElement('button');
    btn.className = 'spp-color-btn';
    btn.style.backgroundColor = '#FFFFFF';
    btn.title = 'Цвет заливки';
    inst._fillColorBtn = btn;
    inst._fillSwatches = [];

    const popover = document.createElement('div');
    popover.className = 'spp-popover';
    Object.assign(popover.style, { top: '100%', left: '0', marginTop: '4px' });
    const grid = buildColorGrid(popover, FILL_COLORS, (color) => {
        inst._fillColorBtn.classList.remove('spp-color-btn--transparent');
        inst._fillColorBtn.style.backgroundColor = color.hex;
        inst._emit({ updates: { color: color.pixi, properties: { fillOpacity: 1 } } });
        inst._closePopover();
    }, inst._fillSwatches);

    const transparentBtn = document.createElement('button');
    transparentBtn.type = 'button';
    transparentBtn.className = 'spp-color-swatch spp-color-swatch--transparent';
    transparentBtn.title = 'Без заливки';
    transparentBtn.innerHTML = transparentIconSvg;
    const transparentTick = document.createElement('span');
    transparentTick.className = 'spp-tick';
    transparentBtn.appendChild(transparentTick);
    transparentBtn.addEventListener('click', () => {
        const data = inst.core?.getObjectData?.(inst.currentId);
        const currentFillOpacity = data?.properties?.fillOpacity ?? 1;
        if (currentFillOpacity === 0) return;
        inst._fillSwatches.forEach(s => s.classList.remove('spp-color-swatch--active'));
        transparentBtn.classList.add('spp-color-swatch--active');
        inst._fillColorBtn.classList.add('spp-color-btn--transparent');
        inst._emit({ updates: { properties: { fillOpacity: 0 } } });
        inst._closePopover();
    });
    grid.appendChild(transparentBtn);
    inst._fillSwatches.push(transparentBtn);
    inst._fillTransparentBtn = transparentBtn;

    // Кастомный цвет заливки: кружок + плюс с поповером-палитрой
    const fillCustom = attachCustomColorControl(inst, {
        grid,
        swatches: inst._fillSwatches,
        storageKey: CUSTOM_COLOR_KEYS.fill,
        getFallbackHex: () => {
            const data = inst.core?.getObjectData?.(inst.currentId);
            return data?.color != null
                ? `#${(data.color >>> 0).toString(16).padStart(6, '0')}`
                : '#FFFFFF';
        },
        applyColor: (hex) => {
            const pixi = parseInt(hex.replace('#', ''), 16);
            inst._fillColorBtn.classList.remove('spp-color-btn--transparent');
            inst._fillColorBtn.style.backgroundColor = hex;
            inst._emit({ updates: { color: pixi, properties: { fillOpacity: 1 } } });
        },
        closeParentOnCircleClick: true,
    });
    inst._fillCustomSwatch = fillCustom.customSwatch;
    inst._fillCustomBtn = fillCustom.plusBtn;

    inst._fillPopover = popover;

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.appendChild(btn);
    wrap.appendChild(popover);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        inst._togglePopover(popover);
    });

    return wrap;
}

export function buildBorderGroup(inst) {
    const trigger = document.createElement('button');
    trigger.className = 'spp-btn';
    trigger.title = 'Рамка';
    trigger.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-icon lucide-circle"><circle cx="12" cy="12" r="10"/></svg>';
    inst._borderTrigger = trigger;

    const popover = document.createElement('div');
    popover.className = 'spp-popover';
    Object.assign(popover.style, { top: '100%', left: '0', marginTop: '4px' });

    const group = document.createElement('div');
    group.className = 'spp-border-group';

    // Стиль линии
    const styleRow = document.createElement('div');
    styleRow.className = 'spp-border-row spp-border-row--style';
    const styleBtns = document.createElement('div');
    styleBtns.className = 'spp-style-btns';
    inst._borderStyleBtns = {};
    [
        { value: 'solid',  svg: '<svg width="22" height="14" viewBox="0 0 22 14"><line x1="1" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2"/></svg>' },
        { value: 'dashed', svg: '<svg width="22" height="14" viewBox="0 0 22 14"><line x1="1" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg>' },
        { value: 'dotted', svg: '<svg width="22" height="14" viewBox="0 0 22 14"><line x1="1" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2" stroke-dasharray="2 3" stroke-linecap="round"/></svg>' },
    ].forEach(({ value, svg }) => {
        const b = document.createElement('button');
        b.className = 'spp-btn';
        b.title = value;
        b.innerHTML = svg;
        b.dataset.style = value;
        b.addEventListener('click', () => {
            inst._emit({ updates: { properties: { borderStyle: value } } });
            inst._updateBorderStyleBtns(value);
        });
        styleBtns.appendChild(b);
        inst._borderStyleBtns[value] = b;
    });
    styleRow.appendChild(styleBtns);
    group.appendChild(styleRow);

    // Толщина
    const [widthRow, widthSlider, widthVal] = _sliderRow('Толщина', 0, 10, 0.5, 1);
    inst._borderWidthSlider = widthSlider;
    inst._borderWidthVal = widthVal;
    widthSlider.addEventListener('input', () => {
        const v = parseFloat(widthSlider.value);
        widthVal.textContent = String(v);
        inst._emit({ updates: { properties: { borderWidth: v } } });
    });
    group.appendChild(widthRow);

    // Прозрачность
    const [opacityRow, opacitySlider, opacityVal] = _sliderRow('Прозрачность', 0, 100, 1, 100, '%');
    inst._borderOpacitySlider = opacitySlider;
    inst._borderOpacityVal = opacityVal;
    opacitySlider.addEventListener('input', () => {
        const pct = parseInt(opacitySlider.value, 10);
        opacityVal.textContent = `${pct}%`;
        inst._emit({ updates: { properties: { borderOpacity: pct / 100 } } });
    });
    group.appendChild(opacityRow);

    // Угол
    group.appendChild(buildRadiusGroup(inst));

    // Цвет рамки — грид цветов прямо в попапе рамки
    const colorRow = document.createElement('div');
    colorRow.className = 'spp-border-row spp-border-row--colors';
    const colorLbl = document.createElement('span');
    colorLbl.className = 'spp-border-label';
    colorLbl.textContent = 'Цвет рамки:';
    colorRow.appendChild(colorLbl);

    inst._borderColorBtn = null;
    inst._borderColorPopover = null;
    inst._borderSwatches = [];
    const borderGrid = buildColorGrid(colorRow, BORDER_COLORS, (color) => {
        inst._emit({ updates: { properties: { borderColor: color.pixi } } });
    }, inst._borderSwatches);

    attachCustomColorControl(inst, {
        grid: borderGrid,
        swatches: inst._borderSwatches,
        storageKey: CUSTOM_COLOR_KEYS.border,
        getFallbackHex: () => {
            const data = inst.core?.getObjectData?.(inst.currentId);
            const bc = data?.properties?.borderColor ?? 0xD4D4D4;
            return `#${(bc >>> 0).toString(16).padStart(6, '0')}`;
        },
        applyColor: (hex) => {
            const pixi = parseInt(hex.replace('#', ''), 16);
            if (inst._borderColorBtn) inst._borderColorBtn.style.backgroundColor = hex;
            inst._emit({ updates: { properties: { borderColor: pixi } } });
        },
        closeParentOnCircleClick: false,
    });

    group.appendChild(colorRow);

    popover.appendChild(group);
    inst._borderPopover = popover;

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.appendChild(trigger);
    wrap.appendChild(popover);

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        inst._togglePopover(popover);
    });

    return wrap;
}

export function buildRadiusGroup(inst) {
    const [row, slider, valLabel] = _sliderRow('Угол', 0, 50, 1, 0);
    row.classList.add('spp-radius-group');
    inst._radiusGroup = row;
    slider.title = 'Радиус скругления';
    inst._radiusSlider = slider;
    inst._radiusVal = valLabel;

    slider.addEventListener('input', () => {
        const v = parseInt(slider.value, 10);
        valLabel.textContent = String(v);
        inst._emit({ updates: { properties: { cornerRadius: v } } });
    });

    return row;
}

export function buildTextGroup(inst) {
    const nodes = [];

    const fontSelect = document.createElement('select');
    fontSelect.className = 'spp-select spp-select--font';
    FONT_OPTIONS.forEach(({ value, name }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = name;
        opt.style.fontFamily = value;
        fontSelect.appendChild(opt);
    });
    fontSelect.addEventListener('change', () => {
        inst._emit({ updates: { properties: { text: { fontFamily: fontSelect.value } } } });
    });
    inst._fontSelect = fontSelect;
    nodes.push(fontSelect);

    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'spp-select spp-select--size';
    FONT_SIZE_OPTIONS.forEach((sz) => {
        const opt = document.createElement('option');
        opt.value = sz;
        opt.textContent = String(sz);
        sizeSelect.appendChild(opt);
    });
    sizeSelect.value = '16';
    sizeSelect.addEventListener('change', () => {
        inst._emit({ updates: { properties: { text: { fontSize: parseInt(sizeSelect.value, 10) } } } });
    });
    inst._sizeSelect = sizeSelect;
    nodes.push(sizeSelect);

    nodes.push(sep());

    const tcBtn = document.createElement('button');
    tcBtn.type = 'button';
    tcBtn.className = 'current-color-button spp-text-color-btn';
    tcBtn.style.background = 'transparent';
    tcBtn.title = 'Цвет текста';

    const colorIcon = document.createElement('span');
    colorIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5636 13.9875L12 5L15.4364 13.9875"></path><path d="M9.88525 10.8155H14.1147"></path></svg>';
    colorIcon.style.cssText = 'width: 24px; height: 24px; pointer-events: none; display: flex; align-items: center; justify-content: center;';

    const colorIndicator = document.createElement('div');
    colorIndicator.style.cssText = `
        width: 18px;
        height: 5px;
        position: absolute;
        bottom: 2px;
        background: #111111;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset;
        border-radius: 2px;
    `;

    tcBtn.appendChild(colorIcon);
    tcBtn.appendChild(colorIndicator);

    inst._textColorBtn = tcBtn;
    inst._textColorIndicator = colorIndicator;
    inst._textColorSwatches = [];
    inst._textColorSwatches = [];

    const tcPopover = document.createElement('div');
    tcPopover.className = 'spp-popover';
    Object.assign(tcPopover.style, { top: '100%', left: '0', marginTop: '4px' });
    _buildTextColorGrid(tcPopover, inst);
    inst._textColorPopover = tcPopover;

    const tcWrap = document.createElement('div');
    tcWrap.style.position = 'relative';
    tcWrap.appendChild(tcBtn);
    tcWrap.appendChild(tcPopover);
    tcBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        inst._togglePopover(tcPopover);
    });
    nodes.push(tcWrap);

    nodes.push(sep());

    // Bold
    const boldBtn = document.createElement('button');
    boldBtn.className = 'spp-btn';
    boldBtn.title = 'Жирный';
    boldBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><text x="2" y="12" font-family="Arial" font-size="13" font-weight="bold" fill="currentColor">B</text></svg>';
    boldBtn.addEventListener('click', () => {
        const cur = boldBtn.classList.contains('spp-btn--active');
        boldBtn.classList.toggle('spp-btn--active', !cur);
        inst._emit({ updates: { properties: { text: { bold: !cur } } } });
    });
    inst._boldBtn = boldBtn;
    nodes.push(boldBtn);

    nodes.push(sep());

    // Выравнивание
    inst._alignBtns = {};

    const alignTrigger = document.createElement('button');
    alignTrigger.className = 'spp-trigger spp-btn';
    alignTrigger.title = 'Выравнивание';
    alignTrigger.innerHTML = ALIGN_ICONS['left'];
    inst._alignTrigger = alignTrigger;

    const alignPopover = document.createElement('div');
    alignPopover.className = 'spp-popover';
    Object.assign(alignPopover.style, { top: '100%', left: '0', marginTop: '4px', display: 'none', padding: '4px' });
    inst._alignPopover = alignPopover;

    const alignGrid = document.createElement('div');
    alignGrid.style.display = 'flex';
    alignGrid.style.gap = '2px';

    [
        { value: 'left',   title: 'По левому краю' },
        { value: 'center', title: 'По центру' },
        { value: 'right',  title: 'По правому краю' },
    ].forEach(({ value, title }) => {
        const b = document.createElement('button');
        b.className = 'spp-btn';
        b.title = title;
        b.innerHTML = ALIGN_ICONS[value];
        b.dataset.align = value;
        b.addEventListener('click', () => {
            inst._setAlign(value);
            inst._emit({ updates: { properties: { text: { textAlign: value } } } });
            inst._closePopover();
        });
        inst._alignBtns[value] = b;
        alignGrid.appendChild(b);
    });

    alignPopover.appendChild(alignGrid);

    const alignWrap = document.createElement('div');
    alignWrap.style.position = 'relative';
    alignWrap.appendChild(alignTrigger);
    alignWrap.appendChild(alignPopover);
    alignTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        inst._togglePopover(alignPopover);
    });
    nodes.push(alignWrap);

    nodes.push(sep());

    // Список
    const listBtn = document.createElement('button');
    listBtn.className = 'spp-btn';
    listBtn.title = 'Маркированный список';
    listBtn.innerHTML =
        '<svg width="16" height="14" viewBox="0 0 16 14">' +
        '<circle cx="2" cy="3" r="1.5" fill="currentColor"/><line x1="5" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/>' +
        '<circle cx="2" cy="7" r="1.5" fill="currentColor"/><line x1="5" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.5"/>' +
        '<circle cx="2" cy="11" r="1.5" fill="currentColor"/><line x1="5" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/>' +
        '</svg>';
    listBtn.addEventListener('click', () => {
        const cur = listBtn.classList.contains('spp-btn--active');
        listBtn.classList.toggle('spp-btn--active', !cur);
        inst._emit({ updates: { properties: { text: { list: cur ? 'none' : 'bullet' } } } });
    });
    inst._listBtn = listBtn;
    nodes.push(listBtn);

    nodes.push(sep());

    const lhSelect = document.createElement('select');
    lhSelect.className = 'spp-select';
    lhSelect.style.minWidth = '60px';
    [1.0, 1.2, 1.4, 1.6, 2.0].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = String(v);
        opt.textContent = String(v);
        if (v === 1.4) opt.selected = true;
        lhSelect.appendChild(opt);
    });
    lhSelect.addEventListener('change', () => {
        inst._emit({ updates: { properties: { text: { lineHeight: parseFloat(lhSelect.value) } } } });
    });
    inst._lhSelect = lhSelect;
    nodes.push(lhSelect);

    return nodes;
}

// ── Внутренние утилиты ────────────────────────────────────────────────────────

function _borderRow(labelText) {
    const row = document.createElement('div');
    row.className = 'spp-border-row';
    const lbl = document.createElement('span');
    lbl.className = 'spp-border-label';
    lbl.textContent = labelText;
    row.appendChild(lbl);
    return row;
}

function _sliderRow(labelText, min, max, step, defVal, suffix = '') {
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

function _buildTextColorGrid(container, inst) {
    const grid = document.createElement('div');
    grid.className = 'spp-color-grid';
    TEXT_COLOR_PRESETS.forEach(({ color, name }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'spp-color-swatch' +
            (color === '#ffffff' ? ' spp-color-swatch--white' : '');
        btn.style.backgroundColor = color;
        btn.title = name;
        btn.dataset.colorHex = color.toUpperCase();
        const tick = document.createElement('span');
        tick.className = 'spp-tick';
        btn.appendChild(tick);
        btn.addEventListener('click', () => {
            inst._textColorSwatches.forEach(s => s.classList.remove('spp-color-swatch--active'));
            btn.classList.add('spp-color-swatch--active');
            inst._textColorIndicator.style.backgroundColor = color;
            inst._emit({ updates: { properties: { text: { color } } } });
            inst._closePopover();
        });
        grid.appendChild(btn);
        inst._textColorSwatches.push(btn);
    });

    attachCustomColorControl(inst, {
        grid,
        swatches: inst._textColorSwatches,
        storageKey: CUSTOM_COLOR_KEYS.text,
        getFallbackHex: () => {
            const data = inst.core?.getObjectData?.(inst.currentId);
            return data?.properties?.text?.color || '#111111';
        },
        applyColor: (hex) => {
            if (inst._textColorIndicator) inst._textColorIndicator.style.backgroundColor = hex;
            inst._emit({ updates: { properties: { text: { color: hex } } } });
        },
        closeParentOnCircleClick: true,
    });

    container.appendChild(grid);
}
