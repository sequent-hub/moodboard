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

const SVG_ALIGN_LEFT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M4.75 18.2637H13.25"/><path d="M4.75 14.0879H19.25"/><path d="M4.75 9.91211L13.25 9.91211"/></svg>';
const SVG_ALIGN_CENTER = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M7.75 18.2637H16.25"/><path d="M4.75 14.0879H19.25"/><path d="M7.75 9.91211L16.25 9.91211"/></svg>';
const SVG_ALIGN_RIGHT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M10.75 18.2637H19.25"/><path d="M4.75 14.0879H19.25"/><path d="M10.75 9.91211L19.25 9.91211"/></svg>';
const SVG_ALIGN_JUSTIFY = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M4.75 9.91211H19.25"/><path d="M4.75 14.0879H19.25"/><path d="M4.75 18.2637H19.25"/></svg>';

const SVG_LIST_BULLET = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.28516 5.49609H19.2852M8.28516 11H19.2852M8.28516 16.4961H19.2852M4.21484 17.25C4.62906 17.25 4.96484 16.9142 4.96484 16.5C4.96484 16.0858 4.62906 15.75 4.21484 15.75C3.80063 15.75 3.46484 16.0858 3.46484 16.5C3.46484 16.9142 3.80063 17.25 4.21484 17.25ZM4.21484 11.75C4.62906 11.75 4.96484 11.4142 4.96484 11C4.96484 10.5858 4.62906 10.25 4.21484 10.25C3.80063 10.25 3.46484 10.5858 3.46484 11C3.46484 11.4142 3.80063 11.75 4.21484 11.75ZM4.21484 6.24609C4.62906 6.24609 4.96484 5.91031 4.96484 5.49609C4.96484 5.08188 4.62906 4.74609 4.21484 4.74609C3.80063 4.74609 3.46484 5.08188 3.46484 5.49609C3.46484 5.91031 3.80063 6.24609 4.21484 6.24609Z"/></svg>';
const SVG_LIST_NUMBERED = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.28516 5.49505H19.2852M8.28516 10.999H19.2852M8.28516 16.4951H19.2852M3.30078 5.32812L4.67578 4.64062V9.45312M3.39531 13.2839C3.45867 13.1269 3.55438 12.9853 3.67622 12.8678C3.79808 12.7505 3.9433 12.6602 4.10242 12.6027C4.26156 12.5453 4.43101 12.5221 4.59972 12.5345C4.76844 12.547 4.93262 12.595 5.08156 12.6752C5.23049 12.7555 5.36082 12.8662 5.46407 13.0002C5.56729 13.1343 5.6411 13.2885 5.68067 13.453C5.72022 13.6175 5.72466 13.7885 5.69366 13.9549C5.66266 14.1211 5.59693 14.279 5.50078 14.4182L3.30078 17.3573H5.70703"/></svg>';
const SVG_LIST_CHECK = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.28516 5.49609H19.2852M8.28516 11H19.2852M8.28516 16.4961H19.2852M2.9 5.2L3.9 6.2L5.7 4.2M2.9 10.7L3.9 11.7L5.7 9.7M2.9 16.2L3.9 17.2L5.7 15.2"/></svg>';

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

function makeListButtons() {
    const container = document.createElement('div');
    container.className = 'tpp-list-btns';

    const listOptions = [
        { value: 'bullet', title: 'Маркированный список', svg: SVG_LIST_BULLET },
        { value: 'numbered', title: 'Нумерованный список', svg: SVG_LIST_NUMBERED },
        { value: 'checkbox', title: 'Список с флажками', svg: SVG_LIST_CHECK },
    ];

    let currentValue = 'none';
    const changeListeners = [];

    // Кнопка-триггер: всегда показывает иконку bullet-list и открывает модальное окно
    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.title = 'Список';
    triggerBtn.className = 'tpp-format-btn tpp-list-trigger';
    triggerBtn.innerHTML = SVG_LIST_BULLET;

    const modal = document.createElement('div');
    modal.className = 'tpp-list-modal';
    modal.style.display = 'none';

    listOptions.forEach(({ value, title, svg }) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.title = title;
        optBtn.className = 'tpp-list-modal-option';
        optBtn.dataset.listValue = value;
        optBtn.innerHTML = svg;
        optBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Клик по выбранному элементу снимает форматирование (none).
            currentValue = currentValue === value ? 'none' : value;
            closeModal();
            updateActive();
            changeListeners.forEach((cb) => cb({ target: proxy }));
        });
        modal.appendChild(optBtn);
    });

    container.appendChild(triggerBtn);
    container.appendChild(modal);

    function openModal() {
        modal.style.display = 'flex';
        updateModalActive();
        setTimeout(() => {
            document.addEventListener('click', closeOnOutside);
        }, 0);
    }

    function closeModal() {
        modal.style.display = 'none';
        document.removeEventListener('click', closeOnOutside);
    }

    function closeOnOutside(e) {
        if (!container.contains(e.target)) {
            closeModal();
        }
    }

    function updateActive() {
        triggerBtn.classList.toggle('is-active', currentValue !== 'none');
        updateModalActive();
    }

    function updateModalActive() {
        modal.querySelectorAll('.tpp-list-modal-option').forEach((btn) => {
            const isActive = btn.dataset.listValue === currentValue;
            btn.style.color = isActive ? 'rgb(53, 56, 205)' : '';
        });
    }

    triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modal.style.display === 'none') {
            openModal();
        } else {
            closeModal();
        }
    });

    const proxy = {
        get value() {
            return currentValue;
        },
        set value(v) {
            currentValue = v || 'none';
            updateActive();
        },
        addEventListener(event, cb) {
            if (event === 'change') changeListeners.push(cb);
        },
        _container: container,
    };

    updateActive();
    return proxy;
}

function makeAlignButtons() {
    const container = document.createElement('div');
    container.className = 'tpp-align-btns';

    const alignOptions = [
        { value: 'left', title: 'По левому краю', svg: SVG_ALIGN_LEFT },
        { value: 'center', title: 'По центру', svg: SVG_ALIGN_CENTER },
        { value: 'right', title: 'По правому краю', svg: SVG_ALIGN_RIGHT },
        { value: 'justify', title: 'По ширине', svg: SVG_ALIGN_JUSTIFY },
    ];

    let currentValue = 'left';
    const changeListeners = [];

    // Единственная кнопка — отображает текущее выравнивание и открывает модальное окно
    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'tpp-format-btn tpp-align-btn tpp-align-trigger';
    triggerBtn.dataset.alignValue = 'left';

    // Модальный попап
    const modal = document.createElement('div');
    modal.className = 'tpp-align-modal';
    modal.style.display = 'none';

    alignOptions.forEach(({ value, title, svg }) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.title = title;
        optBtn.className = 'tpp-align-modal-option';
        optBtn.dataset.alignValue = value;
        optBtn.innerHTML = svg;
        optBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentValue = value;
            closeModal();
            updateActive();
            changeListeners.forEach((cb) => cb({ target: proxy }));
        });
        modal.appendChild(optBtn);
    });

    container.appendChild(triggerBtn);
    container.appendChild(modal);

    function openModal() {
        modal.style.display = 'flex';
        updateModalActive();
        // Закрытие по клику вне
        setTimeout(() => {
            document.addEventListener('click', closeOnOutside);
        }, 0);
    }

    function closeModal() {
        modal.style.display = 'none';
        document.removeEventListener('click', closeOnOutside);
    }

    function closeOnOutside(e) {
        if (!container.contains(e.target)) {
            closeModal();
        }
    }

    function updateActive() {
        const opt = alignOptions.find((o) => o.value === currentValue);
        if (opt) {
            triggerBtn.innerHTML = opt.svg;
            triggerBtn.title = opt.title;
            triggerBtn.dataset.alignValue = currentValue;
        }
        updateModalActive();
    }

    function updateModalActive() {
        modal.querySelectorAll('.tpp-align-modal-option').forEach((btn) => {
            const isActive = btn.dataset.alignValue === currentValue;
            btn.style.color = isActive ? 'rgb(53, 56, 205)' : '';
        });
    }

    triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modal.style.display === 'none') {
            openModal();
        } else {
            closeModal();
        }
    });

    const proxy = {
        get value() {
            return currentValue;
        },
        set value(v) {
            currentValue = v;
            updateActive();
        },
        addEventListener(event, cb) {
            if (event === 'change') changeListeners.push(cb);
        },
        _container: container,
    };

    updateActive();
    return proxy;
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

    panelInstance.alignControl = makeAlignButtons();
    panel.appendChild(panelInstance.alignControl._container);

    panelInstance.listControl = makeListButtons();
    panel.appendChild(panelInstance.listControl._container);

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
