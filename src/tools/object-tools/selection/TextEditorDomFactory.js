export function createTextEditorWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'moodboard-text-editor';
    return wrapper;
}

export function createTextEditorTextarea(content) {
    const textarea = document.createElement('textarea');
    textarea.className = 'moodboard-text-input';
    textarea.value = content || '';
    textarea.placeholder = 'Напишите что-нибудь';
    return textarea;
}

export function computeTextEditorLineHeightPx(fontSizePx) {
    if (fontSizePx <= 12) return Math.round(fontSizePx * 1.40);
    if (fontSizePx <= 18) return Math.round(fontSizePx * 1.34);
    if (fontSizePx <= 36) return Math.round(fontSizePx * 1.26);
    if (fontSizePx <= 48) return Math.round(fontSizePx * 1.24);
    if (fontSizePx <= 72) return Math.round(fontSizePx * 1.22);
    if (fontSizePx <= 96) return Math.round(fontSizePx * 1.20);
    return Math.round(fontSizePx * 1.18);
}

export function applyInitialTextEditorTextareaStyles(textarea, { effectiveFontPx, lineHeightPx }) {
    textarea.style.fontSize = `${effectiveFontPx}px`;
    textarea.style.lineHeight = `${lineHeightPx}px`;

    const initialHeightPx = Math.max(1, lineHeightPx);
    textarea.style.minHeight = `${initialHeightPx}px`;
    textarea.style.height = `${initialHeightPx}px`;
    textarea.setAttribute('rows', '1');
    textarea.style.overflowY = 'hidden';
    textarea.style.whiteSpace = 'pre-wrap';
    textarea.style.wordBreak = 'break-word';
    textarea.style.letterSpacing = '0px';
    textarea.style.fontKerning = 'normal';
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
    styleEl.textContent = `.${uid}::placeholder{font-size:${effectiveFontPx}px;opacity:${placeholderOpacity};line-height:${computeTextEditorLineHeightPx(effectiveFontPx)}px;white-space:nowrap;}`;
    document.head.appendChild(styleEl);

    return styleEl;
}
