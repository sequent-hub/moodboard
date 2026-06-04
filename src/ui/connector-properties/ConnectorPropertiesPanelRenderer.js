import {
    STROKE_COLOR_PRESETS,
    WIDTH_PRESETS,
    ROUTE_OPTIONS,
    HEAD_OPTIONS,
    pixiColorToHex,
} from './ConnectorPropertiesPanelMapper.js';

// ── Создание панели ──────────────────────────────────────────────────────────

export function createConnectorPropertiesPanelDom(inst) {
    const panel = document.createElement('div');
    panel.className = 'connector-properties-panel';
    panel.id = 'connector-properties-panel';
    Object.assign(panel.style, {
        position:        'absolute',
        display:         'none',
        flexDirection:   'column',
        alignItems:      'stretch',
        backgroundColor: 'white',
        border:          '1px solid #e0e0e0',
        borderRadius:    '12px',
        boxShadow:       '0 6px 24px rgba(0,0,0,0.16)',
        fontSize:        '12px',
        fontFamily:      'Arial, sans-serif',
        zIndex:          '10000',
        whiteSpace:      'nowrap',
        userSelect:      'none',
        minWidth:        '0',
    });

    // Основной ряд (все существующие контролы)
    const mainRow = document.createElement('div');
    Object.assign(mainRow.style, {
        display:       'flex',
        flexDirection: 'row',
        alignItems:    'center',
        gap:           '4px',
        padding:       '6px 16px',
        height:        '40px',
    });

    _appendSep(mainRow);
    _createStrokeControl(inst, mainRow);
    _appendSep(mainRow);
    _createWidthControl(inst, mainRow);
    _appendSep(mainRow);
    _createRouteControl(inst, mainRow);
    _appendSep(mainRow);
    _createDashControl(inst, mainRow);
    _appendSep(mainRow);
    _createHeadControl(inst, mainRow);
    _appendSep(mainRow);
    _createActionButtons(inst, mainRow);
    panel.appendChild(mainRow);
    inst._mainRow = mainRow;

    // Второй ряд — контролы текстовой метки (скрыт по умолчанию)
    const labelRow = _createLabelRow(inst);
    labelRow.style.display = 'none';
    inst._labelRow = labelRow;
    panel.appendChild(labelRow);

    inst.panel = panel;
    return panel;
}

// ── Обновление контролов из данных объекта ───────────────────────────────────

export function updateConnectorPanelControls(inst, style) {
    // Цвет линии
    if (inst.strokeColorButton) {
        const hex = pixiColorToHex(style.stroke);
        inst.strokeColorButton.style.backgroundColor = hex;
        if (inst.strokeColorInput) inst.strokeColorInput.value = hex;
    }

    // Ширина
    inst.widthButtons.forEach(btn => {
        const active = btn.dataset.width === String(style.width);
        btn.style.fontWeight = active ? 'bold' : 'normal';
        btn.style.backgroundColor = active ? '#EFF6FF' : '';
        btn.style.borderColor = active ? '#2563EB' : '#ddd';
    });

    // Маршрут
    if (inst.routeSelect) inst.routeSelect.value = style.route;

    // Пунктир
    if (inst.dashButton) {
        inst.dashButton.style.fontWeight = style.dash ? 'bold' : 'normal';
        inst.dashButton.style.backgroundColor = style.dash ? '#EFF6FF' : '';
        inst.dashButton.style.borderColor = style.dash ? '#2563EB' : '#ddd';
    }

    // Наконечники
    if (inst.headEndSelect)   inst.headEndSelect.value   = style.head?.end   ?? 'arrow';
    if (inst.headStartSelect) inst.headStartSelect.value = style.head?.start ?? 'none';
}

/**
 * Обновляет видимость и значения второго ряда (label controls).
 * Вызывается из _updateControlsFromObject.
 */
export function updateLabelRow(inst, connector) {
    const label = connector?.properties?.style?.label;
    if (!inst._labelRow) return;
    if (!label) {
        inst._labelRow.style.display = 'none';
        return;
    }
    inst._labelRow.style.display = 'flex';
    if (inst._labelColorBtn) {
        inst._labelColorBtn.style.backgroundColor = pixiColorToHex(label.color ?? 0x212121);
    }
    if (inst._labelSizeDisplay) {
        inst._labelSizeDisplay.textContent = String(label.fontSize ?? 14);
    }
}

// ── Dropdown цвета: показать / скрыть ────────────────────────────────────────

export function showStrokeDropdown(inst) {
    if (inst.strokeColorDropdown) inst.strokeColorDropdown.style.display = 'block';
}

export function hideStrokeDropdown(inst) {
    if (inst.strokeColorDropdown) inst.strokeColorDropdown.style.display = 'none';
}

export function showLabelColorDropdown(inst) {
    if (inst._labelColorDropdown) inst._labelColorDropdown.style.display = 'block';
}

export function hideLabelColorDropdown(inst) {
    if (inst._labelColorDropdown) inst._labelColorDropdown.style.display = 'none';
}

// ── Внутренние строители ─────────────────────────────────────────────────────

function _appendSep(parent) {
    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;height:18px;background:#e8e8e8;margin:0 2px;flex-shrink:0;';
    parent.appendChild(sep);
}

function _btn(label, title, extra = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    Object.assign(b.style, {
        border:       '1px solid #ddd',
        borderRadius: '4px',
        padding:      '2px 6px',
        cursor:       'pointer',
        fontSize:     '11px',
        background:   '',
        lineHeight:   '16px',
        flexShrink:   '0',
        ...extra,
    });
    return b;
}

function _createStrokeControl(inst, panel) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-flex;align-items:center;gap:4px;';
    inst._strokeSelectorContainer = wrap;

    const label = document.createElement('span');
    label.textContent = 'Цвет';
    label.style.cssText = 'font-size:10px;color:#999;';
    wrap.appendChild(label);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Цвет линии';
    Object.assign(btn.style, {
        width:        '22px',
        height:       '22px',
        borderRadius: '50%',
        border:       '1px solid #ddd',
        cursor:       'pointer',
        backgroundColor: '#2563EB',
        flexShrink:   '0',
        padding:      '0',
    });
    inst.strokeColorButton = btn;
    wrap.appendChild(btn);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.style.cssText = [
        'position:absolute;top:calc(100% + 6px);left:0;',
        'background:white;border:1px solid #ddd;border-radius:6px;',
        'box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:8px;display:none;',
        'z-index:10001;min-width:200px;',
    ].join('');
    inst.strokeColorDropdown = dropdown;

    // Сетка пресетов
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,28px);gap:6px;margin-bottom:8px;';
    inst._strokePresetButtons = [];

    STROKE_COLOR_PRESETS.forEach(preset => {
        const cb = document.createElement('button');
        cb.type = 'button';
        cb.title = preset.name;
        cb.dataset.colorValue = preset.color;
        cb.dataset.pixiValue = String(preset.value);
        cb.style.cssText = [
            `width:28px;height:28px;border-radius:50%;`,
            `background-color:${preset.color};`,
            `border:1px solid ${preset.color === '#FFFFFF' ? '#ccc' : 'transparent'};`,
            'cursor:pointer;padding:0;box-sizing:border-box;',
        ].join('');
        grid.appendChild(cb);
        inst._strokePresetButtons.push(cb);
    });
    dropdown.appendChild(grid);

    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#eee;margin:4px 0 8px;';
    dropdown.appendChild(sep);

    const customRow = document.createElement('div');
    customRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const cl = document.createElement('span');
    cl.textContent = 'Свой:';
    cl.style.cssText = 'font-size:11px;color:#666;';

    const ci = document.createElement('input');
    ci.type = 'color';
    ci.style.cssText = 'width:32px;height:24px;border:1px solid #ddd;border-radius:3px;cursor:pointer;padding:0;';
    inst.strokeColorInput = ci;

    customRow.appendChild(cl);
    customRow.appendChild(ci);
    dropdown.appendChild(customRow);

    wrap.appendChild(dropdown);
    panel.appendChild(wrap);
}

function _createWidthControl(inst, panel) {
    const label = document.createElement('span');
    label.textContent = 'Вес';
    label.style.cssText = 'font-size:10px;color:#999;';
    panel.appendChild(label);

    inst.widthButtons = WIDTH_PRESETS.map(w => {
        const b = _btn(String(w), `Толщина ${w}px`);
        b.dataset.width = String(w);
        panel.appendChild(b);
        return b;
    });
}

function _createRouteControl(inst, panel) {
    const label = document.createElement('span');
    label.textContent = 'Тип';
    label.style.cssText = 'font-size:10px;color:#999;';
    panel.appendChild(label);

    const sel = document.createElement('select');
    sel.style.cssText = [
        'border:1px solid #ddd;border-radius:4px;padding:2px 4px;',
        'font-size:11px;cursor:pointer;background:white;height:24px;',
    ].join('');
    ROUTE_OPTIONS.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        sel.appendChild(o);
    });
    inst.routeSelect = sel;
    panel.appendChild(sel);
}

function _createDashControl(inst, panel) {
    const b = _btn('- - -', 'Пунктир / сплошная');
    inst.dashButton = b;
    panel.appendChild(b);
}

function _createHeadControl(inst, panel) {
    const label = document.createElement('span');
    label.textContent = 'Конец';
    label.style.cssText = 'font-size:10px;color:#999;';
    panel.appendChild(label);

    const selEnd = _headSelect();
    inst.headEndSelect = selEnd;
    panel.appendChild(selEnd);

    const labelS = document.createElement('span');
    labelS.textContent = 'Начало';
    labelS.style.cssText = 'font-size:10px;color:#999;margin-left:4px;';
    panel.appendChild(labelS);

    const selStart = _headSelect();
    inst.headStartSelect = selStart;
    panel.appendChild(selStart);
}

function _headSelect() {
    const sel = document.createElement('select');
    sel.style.cssText = [
        'border:1px solid #ddd;border-radius:4px;padding:2px 4px;',
        'font-size:11px;cursor:pointer;background:white;height:24px;',
    ].join('');
    HEAD_OPTIONS.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        sel.appendChild(o);
    });
    return sel;
}

function _createActionButtons(inst, panel) {
    // Разворот
    const swapBtn = _btn('⇄', 'Разворот — поменять местами начало и конец');
    inst._swapBtn = swapBtn;
    panel.appendChild(swapBtn);

    // Кнопка добавить текст-метку (активна)
    const textBtn = _btn('T+', 'Добавить / редактировать текст-метку');
    inst._textBtn = textBtn;
    panel.appendChild(textBtn);

    // Замок
    const lockBtn = _btn('🔓', 'Заблокировать объект');
    inst._lockBtn = lockBtn;
    panel.appendChild(lockBtn);

    // Удалить
    const delBtn = _btn('🗑', 'Удалить коннектор');
    delBtn.style.color = '#EF4444';
    inst._delBtn = delBtn;
    panel.appendChild(delBtn);
}

// ── Второй ряд: контролы текстовой метки ─────────────────────────────────────

function _createLabelRow(inst) {
    const row = document.createElement('div');
    Object.assign(row.style, {
        flexDirection: 'row',
        alignItems:    'center',
        gap:           '4px',
        padding:       '4px 16px',
        borderTop:     '1px solid #f0f0f0',
        minHeight:     '34px',
    });

    const titleLbl = document.createElement('span');
    titleLbl.textContent = 'Текст';
    titleLbl.style.cssText = 'font-size:10px;color:#999;flex-shrink:0;';
    row.appendChild(titleLbl);

    _appendSep(row);

    // Кнопка цвета с dropdown пресетов
    const colorWrap = document.createElement('div');
    colorWrap.style.cssText = 'position:relative;display:inline-flex;align-items:center;gap:4px;';

    const colorLbl = document.createElement('span');
    colorLbl.textContent = 'Цвет';
    colorLbl.style.cssText = 'font-size:10px;color:#999;';
    colorWrap.appendChild(colorLbl);

    const colorBtn = document.createElement('button');
    colorBtn.type  = 'button';
    colorBtn.title = 'Цвет текста метки';
    Object.assign(colorBtn.style, {
        width:           '22px',
        height:          '22px',
        borderRadius:    '50%',
        border:          '1px solid #ddd',
        cursor:          'pointer',
        backgroundColor: '#212121',
        flexShrink:      '0',
        padding:         '0',
    });
    inst._labelColorBtn = colorBtn;
    colorWrap.appendChild(colorBtn);

    const colorDropdown = document.createElement('div');
    colorDropdown.style.cssText = [
        'position:absolute;bottom:calc(100% + 6px);left:0;',
        'background:white;border:1px solid #ddd;border-radius:6px;',
        'box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:8px;display:none;',
        'z-index:10002;',
    ].join('');
    inst._labelColorDropdown = colorDropdown;
    inst._labelColorContainer = colorWrap;

    const colorGrid = document.createElement('div');
    colorGrid.style.cssText = 'display:grid;grid-template-columns:repeat(5,28px);gap:6px;';
    inst._labelPresetButtons = [];

    STROKE_COLOR_PRESETS.forEach(preset => {
        const cb = document.createElement('button');
        cb.type  = 'button';
        cb.title = preset.name;
        cb.dataset.colorValue = preset.color;
        cb.dataset.pixiValue  = String(preset.value);
        cb.style.cssText = [
            `width:28px;height:28px;border-radius:50%;`,
            `background-color:${preset.color};`,
            `border:1px solid ${preset.color === '#FFFFFF' ? '#ccc' : 'transparent'};`,
            'cursor:pointer;padding:0;box-sizing:border-box;',
        ].join('');
        colorGrid.appendChild(cb);
        inst._labelPresetButtons.push(cb);
    });
    colorDropdown.appendChild(colorGrid);
    colorWrap.appendChild(colorDropdown);
    row.appendChild(colorWrap);

    _appendSep(row);

    // Степпер размера шрифта
    const sizeLbl = document.createElement('span');
    sizeLbl.textContent = 'Размер';
    sizeLbl.style.cssText = 'font-size:10px;color:#999;flex-shrink:0;';
    row.appendChild(sizeLbl);

    const sizeDown = _btn('−', 'Уменьшить шрифт метки', { padding: '1px 6px', fontSize: '13px' });
    const sizeDisplay = document.createElement('span');
    sizeDisplay.style.cssText = 'font-size:11px;min-width:22px;text-align:center;flex-shrink:0;';
    sizeDisplay.textContent = '14';
    const sizeUp = _btn('+', 'Увеличить шрифт метки', { padding: '1px 6px', fontSize: '13px' });

    inst._labelSizeDown    = sizeDown;
    inst._labelSizeDisplay = sizeDisplay;
    inst._labelSizeUp      = sizeUp;

    row.appendChild(sizeDown);
    row.appendChild(sizeDisplay);
    row.appendChild(sizeUp);

    return row;
}
