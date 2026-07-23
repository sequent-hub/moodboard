import { applyEditorSizing, applyTextStyles, computeLineHeightPx } from '../../../services/text/TextBoxMetrics.js';

export function createTextEditorWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'moodboard-text-editor';
    
    const backdrop = document.createElement('div');
    backdrop.className = 'moodboard-text-backdrop';
    wrapper.appendChild(backdrop);
    
    const caret = document.createElement('div');
    caret.className = 'mb-custom-caret';
    wrapper.appendChild(caret);
    
    return { wrapper, caret, backdrop };
}

export function createTextEditorTextarea(content) {
    const textarea = document.createElement('textarea');
    textarea.className = 'moodboard-text-input';
    textarea.value = content || '';
    textarea.placeholder = 'Напишите что-нибудь';
    return textarea;
}

export function computeTextEditorLineHeightPx(fontSizePx) {
    return computeLineHeightPx(fontSizePx);
}

/**
 * Применяет все текстовые параметры на textarea/backdrop через общий applyTextStyles,
 * и дополнительно выставляет sizing-параметры поля ввода (height, rows, overflow, white-space).
 *
 * fontSizePx — отображаемый размер в px (с учётом зума);
 * baseFontSizePx — базовый без зума (для выбора line-height ratio).
 * Эти два значения разделены, чтобы line-height ratio вычислялся по тому же baseFontSizePx,
 * что и в HtmlTextLayer — строки совпадают при любом уровне зума.
 */
export function applyInitialTextEditorTextareaStyles(textarea, {
    effectiveFontPx,
    baseFontSizePx,
    fontFamily,
    properties,
    lineHeightPx,
}) {
    applyTextStyles(textarea, {
        fontSizePx: effectiveFontPx,
        baseFontSizePx: baseFontSizePx || effectiveFontPx,
        fontFamily: fontFamily || textarea.style.fontFamily || '',
        properties: properties || {},
    });
    applyEditorSizing(textarea, lineHeightPx);
    // CSS .moodboard-text-input/.moodboard-text-backdrop задают transition: all 0.2s.
    // Кастомная каретка позиционируется вручную по ЖИВЫМ метрикам textarea
    // (getComputedStyle/getBoundingClientRect). При зуме обёртка редактора меняет размер
    // мгновенно, а textarea/backdrop анимируются 0.2s; каретка же показывается по
    // дебаунсу через 150 мс — раньше, чем доигрывает transition, поэтому считается по
    // ещё анимируемой геометрии и «вылезает» за рамку, оставаясь там до следующего
    // ввода. Отключаем анимацию геометрии поля (как уже сделано для фигур), чтобы
    // размеры применялись сразу и каретка всегда совпадала с рамкой.
    textarea.style.transition = 'none';
}

export function measureTextEditorPlaceholderWidth(textarea, placeholder = 'Напишите что-нибудь') {
    const measureEl = document.createElement('span');
    measureEl.style.position = 'absolute';
    measureEl.style.visibility = 'hidden';
    measureEl.style.whiteSpace = 'pre';
    measureEl.style.fontFamily = textarea.style.fontFamily;
    measureEl.style.fontSize = textarea.style.fontSize;
    measureEl.textContent = placeholder;
    document.body.appendChild(measureEl);

    const width = Math.ceil(measureEl.getBoundingClientRect().width);
    measureEl.remove();
    return width;
}

export function attachTextEditorPlaceholderStyle(textarea, { effectiveFontPx, isNote }) {
    const uid = 'mbti-' + Math.random().toString(36).slice(2);
    textarea.classList.add(uid);

    const styleEl = document.createElement('style');
    const placeholderOpacity = isNote ? '0.4' : '0.3';
    // Размер placeholder держим синхронным с текущим шрифтом поля: при зуме/масштабе
    // редактор пересчитывает font-size textarea (createRegularTextEditorUpdater), и без
    // обновления этого правила placeholder «замерзает» на размере момента открытия и
    // вылезает за рамку при последующем уменьшении.
    const setFontPx = (fontPx) => {
        const px = Math.max(1, Math.round(fontPx));
        styleEl.textContent = `.${uid}::placeholder{font-size:${px}px;opacity:${placeholderOpacity};line-height:${computeTextEditorLineHeightPx(px)}px;white-space:nowrap;color:#111;-webkit-text-fill-color:#111;}`;
    };
    setFontPx(effectiveFontPx);
    document.head.appendChild(styleEl);

    return { styleEl, setFontPx };
}
