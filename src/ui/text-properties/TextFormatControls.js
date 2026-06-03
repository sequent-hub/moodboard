import {
    LINE_HEIGHT_DEFAULT,
    LINE_HEIGHT_MAX,
    LINE_HEIGHT_MIN,
    LINE_HEIGHT_STEP,
} from './TextPropertiesPanelMapper.js';

// Статичные SVG-строки (lucide-style). innerHTML допустим — это доверенные константы, не пользовательский ввод.
const SVG_BOLD = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>';
const SVG_ITALIC = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>';
const SVG_UNDERLINE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>';
const SVG_STRIKE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>';

function makeSep() {
    const d = document.createElement('div');
    d.style.cssText = 'width:1px;height:18px;background:#e0e0e0;margin:0 6px;flex-shrink:0;';
    return d;
}

function makeToggleBtn(svgStr, title, prop) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = title;
    btn.className = 'tpp-format-btn';
    btn.dataset.formatProp = prop;
    btn.innerHTML = svgStr;
    return btn;
}

function makeSelect(className, options) {
    const sel = document.createElement('select');
    sel.className = className;
    options.forEach(({ value, label }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        sel.appendChild(opt);
    });
    return sel;
}

export function createTextFormatControls(panelInstance, panel) {
    panel.appendChild(makeSep());

    panelInstance.boldBtn = makeToggleBtn(SVG_BOLD, 'Жирный', 'bold');
    panelInstance.italicBtn = makeToggleBtn(SVG_ITALIC, 'Курсив', 'italic');
    panelInstance.underlineBtn = makeToggleBtn(SVG_UNDERLINE, 'Подчёркнутый', 'underline');
    panelInstance.strikethroughBtn = makeToggleBtn(SVG_STRIKE, 'Зачёркнутый', 'strikethrough');

    [panelInstance.boldBtn, panelInstance.italicBtn, panelInstance.underlineBtn, panelInstance.strikethroughBtn].forEach(
        (btn) => panel.appendChild(btn),
    );

    panel.appendChild(makeSep());

    panelInstance.alignControl = makeSelect('tpp-align-select', [
        { value: 'left', label: '≡ Лево' },
        { value: 'center', label: '≡ Центр' },
        { value: 'right', label: '≡ Право' },
        { value: 'justify', label: '≡ По ширине' },
    ]);
    panel.appendChild(panelInstance.alignControl);

    panelInstance.listControl = makeSelect('tpp-list-select', [
        { value: 'none', label: 'Список: нет' },
        { value: 'bullet', label: '• Маркер' },
        { value: 'numbered', label: '1. Нумерация' },
        { value: 'checkbox', label: '☐ Флажки' },
    ]);
    panel.appendChild(panelInstance.listControl);

    panel.appendChild(makeSep());

    const lhLabel = document.createElement('span');
    lhLabel.className = 'tpp-label';
    lhLabel.title = 'Межстрочный интервал';
    lhLabel.textContent = '↕';
    panel.appendChild(lhLabel);

    panelInstance.lineHeightSlider = document.createElement('input');
    panelInstance.lineHeightSlider.type = 'range';
    panelInstance.lineHeightSlider.className = 'tpp-lh-slider';
    panelInstance.lineHeightSlider.min = String(LINE_HEIGHT_MIN);
    panelInstance.lineHeightSlider.max = String(LINE_HEIGHT_MAX);
    panelInstance.lineHeightSlider.step = String(LINE_HEIGHT_STEP);
    panelInstance.lineHeightSlider.value = String(LINE_HEIGHT_DEFAULT);
    panel.appendChild(panelInstance.lineHeightSlider);
}
