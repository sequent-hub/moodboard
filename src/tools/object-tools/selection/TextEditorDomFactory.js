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
    const placeholderOpacity = isNote ? '0.4' : '0.6';
    styleEl.textContent = `.${uid}::placeholder{font-size:${effectiveFontPx}px;opacity:${placeholderOpacity};line-height:${computeTextEditorLineHeightPx(effectiveFontPx)}px;white-space:nowrap;color:#111;-webkit-text-fill-color:#111;}`;
    document.head.appendChild(styleEl);

    return styleEl;
}
