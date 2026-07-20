import {
    LINE_HEIGHT_DEFAULT,
    LINE_HEIGHT_MAX,
    LINE_HEIGHT_MIN,
    LINE_HEIGHT_STEP,
} from './TextPropertiesPanelMapper.js';

// Статичные SVG-строки (lucide-style). innerHTML допустим — это доверенные константы, не пользовательский ввод.
const SVG_TEXT_FORMAT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" type="text-format" size="24"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.54459 15.3341C7.52012 15.4823 7.52819 15.634 7.56823 15.7787C7.60828 15.9234 7.67935 16.0576 7.77651 16.1721C7.87366 16.2866 7.99458 16.3786 8.13085 16.4416C8.26712 16.5047 8.41548 16.5373 8.56563 16.5372H11.9587C12.8918 16.5372 13.6811 16.3966 14.3277 16.1141C14.9742 15.8286 15.4822 15.4417 15.8505 14.9566C16.2229 14.4662 16.4608 13.9138 16.5674 13.2993C16.6656 12.6755 16.6242 12.1469 16.4432 11.7124C16.2632 11.2779 16.0005 10.9417 15.657 10.7069C15.3354 10.4746 14.9536 10.3399 14.5574 10.319L14.5801 10.201C14.9567 10.1079 15.3146 9.9569 15.656 9.74897C15.9974 9.54207 16.287 9.2669 16.526 8.92552C16.7691 8.58414 16.9315 8.16414 17.0142 7.66241C17.1156 7.06655 17.0691 6.53172 16.8725 6.05793C16.676 5.58 16.3201 5.20138 15.8029 4.9231C15.2898 4.64069 14.607 4.5 13.7515 4.5H10.2208C9.97593 4.50011 9.73904 4.58708 9.55227 4.74544C9.3655 4.9038 9.24096 5.12328 9.2008 5.36483L7.54563 15.3341H7.54459ZM12.0415 14.9803H9.42011L10.0667 11.1238H12.7522C13.2384 11.1238 13.6418 11.2179 13.9625 11.4062C14.2884 11.5945 14.5201 11.8469 14.6567 12.1645C14.7974 12.4821 14.8387 12.8307 14.7808 13.2114C14.6898 13.7162 14.428 14.1372 13.9925 14.4745C13.5622 14.8117 12.9115 14.9803 12.0415 14.9803ZM12.7346 9.70759H10.3077L10.9077 6.04552H13.3874C14.1042 6.04552 14.608 6.21414 14.8977 6.55138C15.1915 6.88448 15.296 7.30138 15.2091 7.8031C15.1511 8.1869 15.0022 8.52207 14.7632 8.80862C14.5274 9.09414 14.2315 9.31552 13.8756 9.47276C13.5229 9.62897 13.1422 9.70759 12.7346 9.70759ZM6.56908 17.9483C6.3633 17.9483 6.16596 18.03 6.02046 18.1755C5.87496 18.321 5.79321 18.5184 5.79321 18.7241C5.79321 18.9299 5.87496 19.1273 6.02046 19.2728C6.16596 19.4183 6.3633 19.5 6.56908 19.5H17.4311C17.6369 19.5 17.8343 19.4183 17.9798 19.2728C18.1253 19.1273 18.207 18.9299 18.207 18.7241C18.207 18.5184 18.1253 18.321 17.9798 18.1755C17.8343 18.03 17.6369 17.9483 17.4311 17.9483H6.56908Z"></path></svg>';
const SVG_BOLD = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.92188 12H13.1719C14.8978 12 16.2969 10.6009 16.2969 8.875C16.2969 7.14911 14.8978 5.75 13.1719 5.75H6.92188V12ZM6.92188 12H13.9531C15.679 12 17.0781 13.3991 17.0781 15.125C17.0781 16.8509 15.679 18.25 13.9531 18.25H6.92188V12Z"></path></svg>';
const SVG_ITALIC = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.4688 5.75H10.4375M13.5625 18.25H6.53125M14.3438 5.75L9.65625 18.25"></path></svg>';
const SVG_UNDERLINE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>';
const SVG_STRIKE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.3125 15.125C7.3125 16.8509 8.71161 18.25 10.4375 18.25H13.5625C15.2884 18.25 16.6875 16.8509 16.6875 15.125C16.6875 13.3991 15.2884 12 13.5625 12M16.6875 8.875C16.6875 7.14911 15.2884 5.75 13.5625 5.75H10.4375C8.71161 5.75 7.3125 7.14911 7.3125 8.875M4.96875 12H19.0312"></path></svg>';

const SVG_ALIGN_LEFT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M4.75 18.2637H13.25"/><path d="M4.75 14.0879H19.25"/><path d="M4.75 9.91211L13.25 9.91211"/></svg>';
const SVG_ALIGN_CENTER = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M7.75 18.2637H16.25"/><path d="M4.75 14.0879H19.25"/><path d="M7.75 9.91211L16.25 9.91211"/></svg>';
const SVG_ALIGN_RIGHT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M10.75 18.2637H19.25"/><path d="M4.75 14.0879H19.25"/><path d="M10.75 9.91211L19.25 9.91211"/></svg>';
const SVG_ALIGN_JUSTIFY = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4.75 5.73633H19.25"/><path d="M4.75 9.91211H19.25"/><path d="M4.75 14.0879H19.25"/><path d="M4.75 18.2637H19.25"/></svg>';

const SVG_LIST_BULLET = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.28516 5.49609H19.2852M8.28516 11H19.2852M8.28516 16.4961H19.2852M4.21484 17.25C4.62906 17.25 4.96484 16.9142 4.96484 16.5C4.96484 16.0858 4.62906 15.75 4.21484 15.75C3.80063 15.75 3.46484 16.0858 3.46484 16.5C3.46484 16.9142 3.80063 17.25 4.21484 17.25ZM4.21484 11.75C4.62906 11.75 4.96484 11.4142 4.96484 11C4.96484 10.5858 4.62906 10.25 4.21484 10.25C3.80063 10.25 3.46484 10.5858 3.46484 11C3.46484 11.4142 3.80063 11.75 4.21484 11.75ZM4.21484 6.24609C4.62906 6.24609 4.96484 5.91031 4.96484 5.49609C4.96484 5.08188 4.62906 4.74609 4.21484 4.74609C3.80063 4.74609 3.46484 5.08188 3.46484 5.49609C3.46484 5.91031 3.80063 6.24609 4.21484 6.24609Z"/></svg>';
const SVG_LIST_NUMBERED = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.28516 5.49505H19.2852M8.28516 10.999H19.2852M8.28516 16.4951H19.2852M3.30078 5.32812L4.67578 4.64062V9.45312M3.39531 13.2839C3.45867 13.1269 3.55438 12.9853 3.67622 12.8678C3.79808 12.7505 3.9433 12.6602 4.10242 12.6027C4.26156 12.5453 4.43101 12.5221 4.59972 12.5345C4.76844 12.547 4.93262 12.595 5.08156 12.6752C5.23049 12.7555 5.36082 12.8662 5.46407 13.0002C5.56729 13.1343 5.6411 13.2885 5.68067 13.453C5.72022 13.6175 5.72466 13.7885 5.69366 13.9549C5.66266 14.1211 5.59693 14.279 5.50078 14.4182L3.30078 17.3573H5.70703"/></svg>';
const SVG_LIST_CHECK = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.28516 5.49609H19.2852M8.28516 11H19.2852M8.28516 16.4961H19.2852M2.9 5.2L3.9 6.2L5.7 4.2M2.9 10.7L3.9 11.7L5.7 9.7M2.9 16.2L3.9 17.2L5.7 15.2"/></svg>';
const SVG_LINE_HEIGHT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" type="line-height-2" size="24"><path d="M6.02009 5.35419V18.6459M6.02009 5.35419L8.77156 8.10419M6.02009 5.35419L3.27156 8.10419M6.02009 18.6459L3.26862 15.8959M6.02009 18.6459L8.76862 15.8959" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13.6112 13.2205H18.9513M11.8311 17.481L15.633 7.47121C15.839 6.92904 15.9419 6.65795 16.0846 6.57385C16.2086 6.50077 16.3539 6.50077 16.4779 6.57385C16.6206 6.65795 16.7235 6.92904 16.9295 7.47121L20.7314 17.481" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

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
    btn.id = `tpp-btn-${prop}`;
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
    triggerBtn.id = 'tpp-btn-list-trigger';
    triggerBtn.innerHTML = SVG_LIST_BULLET;

    const modal = document.createElement('div');
    modal.id = `tpp-list-modal-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    modal.className = 'tpp-list-modal';
    modal.style.display = 'none';

    listOptions.forEach(({ value, title, svg }) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.title = title;
        optBtn.className = 'tpp-list-modal-option';
        optBtn.id = `tpp-list-option-${value}`;
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

export function makeAlignButtons() {
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
    triggerBtn.id = 'tpp-btn-align-trigger';
    triggerBtn.dataset.alignValue = 'left';

    // Модальный попап
    const modal = document.createElement('div');
    modal.id = `tpp-align-modal-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    modal.className = 'tpp-align-modal';
    modal.style.display = 'none';

    alignOptions.forEach(({ value, title, svg }) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.title = title;
        optBtn.className = 'tpp-align-modal-option';
        optBtn.id = `tpp-align-option-${value}`;
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

function makeFormatButtons(panelInstance) {
    const container = document.createElement('div');
    container.className = 'tpp-format-btns-wrapper';
    container.style.position = 'relative';
    container.style.display = 'flex';

    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.title = 'Форматирование текста';
    triggerBtn.className = 'tpp-format-btn tpp-format-trigger';
    triggerBtn.id = 'tpp-btn-format-trigger';
    triggerBtn.innerHTML = SVG_TEXT_FORMAT;

    const modal = document.createElement('div');
    modal.id = `tpp-format-modal-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    modal.className = 'tpp-format-modal';
    modal.style.display = 'none';

    panelInstance.boldBtn = makeToggleBtn(SVG_BOLD, 'Жирный', 'bold');
    panelInstance.italicBtn = makeToggleBtn(SVG_ITALIC, 'Курсив', 'italic');
    panelInstance.underlineBtn = makeToggleBtn(SVG_UNDERLINE, 'Подчёркнутый', 'underline');
    panelInstance.strikethroughBtn = makeToggleBtn(SVG_STRIKE, 'Зачёркнутый', 'strikethrough');

    const btns = [
        panelInstance.boldBtn,
        panelInstance.italicBtn,
        panelInstance.underlineBtn,
        panelInstance.strikethroughBtn
    ];

    btns.forEach((btn) => {
        btn.classList.add('tpp-format-modal-option');
        modal.appendChild(btn);
    });

    container.appendChild(triggerBtn);
    container.appendChild(modal);

    function openModal() {
        modal.style.display = 'flex';
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

    triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modal.style.display === 'none') {
            openModal();
        } else {
            closeModal();
        }
    });

    return container;
}

function makeLineHeightControl(panelInstance) {
    const container = document.createElement('div');
    container.className = 'tpp-lh-control';

    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.title = 'Межстрочный интервал';
    triggerBtn.className = 'tpp-format-btn';
    triggerBtn.id = 'tpp-btn-line-height-trigger';
    triggerBtn.innerHTML = SVG_LINE_HEIGHT;

    const modal = document.createElement('div');
    modal.className = 'tpp-lh-modal';
    modal.style.display = 'none';

    panelInstance.lineHeightSlider = document.createElement('input');
    panelInstance.lineHeightSlider.type = 'range';
    panelInstance.lineHeightSlider.className = 'tpp-lh-slider';
    panelInstance.lineHeightSlider.min = String(LINE_HEIGHT_MIN);
    panelInstance.lineHeightSlider.max = String(LINE_HEIGHT_MAX);
    panelInstance.lineHeightSlider.step = String(LINE_HEIGHT_STEP);
    panelInstance.lineHeightSlider.value = String(LINE_HEIGHT_DEFAULT);

    modal.appendChild(panelInstance.lineHeightSlider);
    container.appendChild(triggerBtn);
    container.appendChild(modal);

    function openModal() {
        modal.style.display = 'flex';
        triggerBtn.classList.add('is-active');
        setTimeout(() => {
            document.addEventListener('click', closeOnOutside);
        }, 0);
    }

    function closeModal() {
        modal.style.display = 'none';
        triggerBtn.classList.remove('is-active');
        document.removeEventListener('click', closeOnOutside);
    }

    function closeOnOutside(e) {
        if (!container.contains(e.target)) {
            closeModal();
        }
    }

    triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modal.style.display === 'none') {
            openModal();
        } else {
            closeModal();
        }
    });

    return container;
}

export function createTextFormatControls(panelInstance, panel) {
    panel.appendChild(makeSep());

    const formatButtonsWrapper = makeFormatButtons(panelInstance);
    panel.appendChild(formatButtonsWrapper);

    panelInstance.alignControl = makeAlignButtons();
    panel.appendChild(panelInstance.alignControl._container);

    panelInstance.listControl = makeListButtons();
    panel.appendChild(panelInstance.listControl._container);

    panel.appendChild(makeSep());

    const lhControl = makeLineHeightControl(panelInstance);
    panel.appendChild(lhControl);

    panel.appendChild(makeSep());
}
