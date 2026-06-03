import {
    FONT_OPTIONS,
    FONT_SIZE_OPTIONS,
    TEXT_COLOR_PRESETS,
} from '../text-properties/TextPropertiesPanelMapper.js';

// ── Константы ─────────────────────────────────────────────────────────────────

export const FILL_COLORS = [
    { name: 'Белый',       hex: '#FFFFFF', pixi: 0xFFFFFF },
    { name: 'Светлый серый', hex: '#F5F5F5', pixi: 0xF5F5F5 },
    { name: 'Голубой',     hex: '#DBEAFE', pixi: 0xDBEAFE },
    { name: 'Зеленый',     hex: '#DCFCE7', pixi: 0xDCFCE7 },
    { name: 'Желтый',      hex: '#FEF9C3', pixi: 0xFEF9C3 },
    { name: 'Розовый',     hex: '#FCE7F3', pixi: 0xFCE7F3 },
    { name: 'Синий',       hex: '#BFDBFE', pixi: 0xBFDBFE },
    { name: 'Оранжевый',   hex: '#FED7AA', pixi: 0xFED7AA },
    { name: 'Красный',     hex: '#FECACA', pixi: 0xFECACA },
    { name: 'Черный',      hex: '#1A1A1A', pixi: 0x1A1A1A },
    { name: 'Темно-серый', hex: '#404040', pixi: 0x404040 },
    { name: 'Темно-синий', hex: '#1E3A5F', pixi: 0x1E3A5F },
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

const CARET_SVG = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="#888" stroke-width="1.5" stroke-linecap="round"/></svg>';

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
}

export function buildShapeGroup(inst) {
    const trigger = document.createElement('button');
    trigger.className = 'spp-trigger';
    trigger.title = 'Форма';
    trigger.innerHTML = SHAPE_ICONS['square'] + CARET_SVG;
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
        btn.innerHTML = (SHAPE_ICONS[kind] || '') +
            `<span>${label.length > 8 ? label.slice(0, 7) + '\u2026' : label}</span>`;
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
    const label = document.createElement('span');
    label.className = 'spp-label';
    label.textContent = 'Заливка:';

    const btn = document.createElement('button');
    btn.className = 'spp-color-btn';
    btn.style.backgroundColor = '#FFFFFF';
    btn.title = 'Цвет заливки';
    inst._fillColorBtn = btn;
    inst._fillSwatches = [];

    const popover = document.createElement('div');
    popover.className = 'spp-popover';
    Object.assign(popover.style, { top: '100%', left: '0', marginTop: '4px' });
    buildColorGrid(popover, FILL_COLORS, (color) => {
        inst._fillColorBtn.style.backgroundColor = color.hex;
        inst._emit({ updates: { color: color.pixi } });
        inst._closePopover();
    }, inst._fillSwatches);
    inst._fillPopover = popover;

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.appendChild(btn);
    wrap.appendChild(popover);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        inst._togglePopover(popover);
    });

    return [label, wrap];
}

export function buildBorderGroup(inst) {
    const trigger = document.createElement('button');
    trigger.className = 'spp-trigger';
    trigger.title = 'Рамка';
    trigger.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>' +
        '<span style="font-size:11px;color:#555">Рамка</span>' + CARET_SVG;
    inst._borderTrigger = trigger;

    const popover = document.createElement('div');
    popover.className = 'spp-popover';
    Object.assign(popover.style, { top: '100%', left: '0', marginTop: '4px' });

    const group = document.createElement('div');
    group.className = 'spp-border-group';

    // Стиль линии
    const styleRow = _borderRow('Стиль:');
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
    const [widthRow, widthSlider, widthVal] = _sliderRow('Толщина:', 0, 10, 0.5, 1);
    inst._borderWidthSlider = widthSlider;
    inst._borderWidthVal = widthVal;
    widthSlider.addEventListener('input', () => {
        const v = parseFloat(widthSlider.value);
        widthVal.textContent = String(v);
        inst._emit({ updates: { properties: { borderWidth: v } } });
    });
    group.appendChild(widthRow);

    // Прозрачность
    const [opacityRow, opacitySlider, opacityVal] = _sliderRow('Прозрачность:', 0, 100, 1, 100, '%');
    inst._borderOpacitySlider = opacitySlider;
    inst._borderOpacityVal = opacityVal;
    opacitySlider.addEventListener('input', () => {
        const pct = parseInt(opacitySlider.value, 10);
        opacityVal.textContent = `${pct}%`;
        inst._emit({ updates: { properties: { borderOpacity: pct / 100 } } });
    });
    group.appendChild(opacityRow);

    // Цвет рамки
    const colorRow = _borderRow('Цвет рамки:');
    const colorSwatch = document.createElement('button');
    colorSwatch.className = 'spp-color-btn';
    colorSwatch.style.backgroundColor = '#D4D4D4';
    colorSwatch.title = 'Цвет рамки';
    inst._borderColorBtn = colorSwatch;
    inst._borderSwatches = [];

    const bcPopover = document.createElement('div');
    bcPopover.className = 'spp-popover';
    Object.assign(bcPopover.style, { top: '100%', left: '0', marginTop: '4px', position: 'absolute' });
    buildColorGrid(bcPopover, BORDER_COLORS, (color) => {
        inst._borderColorBtn.style.backgroundColor = color.hex;
        inst._emit({ updates: { properties: { borderColor: color.pixi } } });
        inst._closePopover();
    }, inst._borderSwatches);
    inst._borderColorPopover = bcPopover;

    const cWrap = document.createElement('div');
    cWrap.style.position = 'relative';
    cWrap.appendChild(colorSwatch);
    cWrap.appendChild(bcPopover);
    colorSwatch.addEventListener('click', (e) => {
        e.stopPropagation();
        inst._togglePopover(bcPopover);
    });
    colorRow.appendChild(cWrap);
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
    const label = document.createElement('span');
    label.className = 'spp-label';
    label.textContent = 'Угол:';

    const group = document.createElement('div');
    group.className = 'spp-radius-group';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '50';
    slider.step = '1';
    slider.value = '0';
    slider.className = 'spp-radius-slider';
    slider.title = 'Радиус скругления';
    inst._radiusSlider = slider;

    const valLabel = document.createElement('span');
    valLabel.className = 'spp-label';
    valLabel.textContent = '0';
    valLabel.style.minWidth = '20px';
    inst._radiusVal = valLabel;

    slider.addEventListener('input', () => {
        const v = parseInt(slider.value, 10);
        valLabel.textContent = String(v);
        inst._emit({ updates: { properties: { cornerRadius: v } } });
    });

    group.appendChild(slider);
    group.appendChild(valLabel);
    return [label, group];
}

export function buildTextGroup(inst) {
    const nodes = [];

    // Шрифт
    const fontLabel = document.createElement('span');
    fontLabel.className = 'spp-label';
    fontLabel.textContent = 'Шрифт:';
    nodes.push(fontLabel);

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

    // Размер
    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'spp-label';
    sizeLabel.textContent = 'Р:';
    nodes.push(sizeLabel);

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

    // Цвет текста
    const tcLabel = document.createElement('span');
    tcLabel.className = 'spp-label';
    tcLabel.textContent = 'Цвет:';
    nodes.push(tcLabel);

    const tcBtn = document.createElement('button');
    tcBtn.className = 'spp-color-btn';
    tcBtn.style.backgroundColor = '#111111';
    tcBtn.title = 'Цвет текста';
    inst._textColorBtn = tcBtn;
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
    [
        { value: 'left',   svg: '<svg width="16" height="14" viewBox="0 0 16 14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="11" x2="13" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>', title: 'По левому краю' },
        { value: 'center', svg: '<svg width="16" height="14" viewBox="0 0 16 14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>', title: 'По центру' },
        { value: 'right',  svg: '<svg width="16" height="14" viewBox="0 0 16 14"><line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="11" x2="15" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>', title: 'По правому краю' },
    ].forEach(({ value, svg, title }) => {
        const b = document.createElement('button');
        b.className = 'spp-btn';
        b.title = title;
        b.innerHTML = svg;
        b.dataset.align = value;
        b.addEventListener('click', () => {
            inst._setAlign(value);
            inst._emit({ updates: { properties: { text: { textAlign: value } } } });
        });
        inst._alignBtns[value] = b;
        nodes.push(b);
    });

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

    // Межстрочный интервал
    const lhLabel = document.createElement('span');
    lhLabel.className = 'spp-label';
    lhLabel.textContent = 'Интервал:';
    nodes.push(lhLabel);

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
    const row = _borderRow(labelText);
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
    row.appendChild(slider);
    row.appendChild(valLabel);
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
            inst._textColorBtn.style.backgroundColor = color;
            inst._emit({ updates: { properties: { text: { color } } } });
            inst._closePopover();
        });
        grid.appendChild(btn);
        inst._textColorSwatches.push(btn);
    });
    container.appendChild(grid);
}
