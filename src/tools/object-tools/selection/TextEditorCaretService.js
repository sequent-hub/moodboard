const propertiesToCopy = [
    'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
    'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing',
    'tabSize', 'MozTabSize', 'whiteSpace', 'wordBreak', 'wordWrap'
];

let mirrorDiv = null;

export function getCaretCoordinates(element, position) {
    if (!mirrorDiv) {
        mirrorDiv = document.createElement('div');
        document.body.appendChild(mirrorDiv);
    }
    
    const style = mirrorDiv.style;
    const computed = window.getComputedStyle(element);
    
    style.whiteSpace = 'pre-wrap';
    if (element.nodeName !== 'INPUT') {
        style.wordWrap = 'break-word';
    }

    style.position = 'absolute';
    style.top = '-9999px';
    style.left = '-9999px';
    style.visibility = 'hidden';

    propertiesToCopy.forEach(prop => {
        style[prop] = computed[prop];
    });

    if (window.mozInnerScreenX != null) {
        if (element.scrollHeight > parseInt(computed.height)) {
            style.overflowY = 'scroll';
        }
    } else {
        style.overflow = 'hidden';
    }

    mirrorDiv.textContent = element.value.substring(0, position);
    
    if (element.nodeName === 'INPUT') {
        mirrorDiv.textContent = mirrorDiv.textContent.replace(/\s/g, '\u00a0');
    }

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    mirrorDiv.appendChild(span);

    const coordinates = {
        top: span.offsetTop + parseInt(computed['borderTopWidth'] || 0),
        left: span.offsetLeft + parseInt(computed['borderLeftWidth'] || 0),
        height: parseInt(computed['lineHeight']) || span.offsetHeight
    };

    return coordinates;
}

export function updateCustomCaret(textarea, caretEl) {
    if (!textarea || !caretEl) return;
    
    if (document.activeElement !== textarea) {
        caretEl.style.display = 'none';
        return;
    }

    if (textarea.selectionStart !== textarea.selectionEnd) {
        caretEl.style.display = 'none';
        return;
    }
    
    caretEl.style.display = 'block';
    
    const pos = textarea.selectionStart;
    const coords = getCaretCoordinates(textarea, pos);
    
    // Adjust for scroll
    const top = coords.top - textarea.scrollTop;
    const left = coords.left - textarea.scrollLeft;
    
    // Calculate width based on font size to match stroke thickness
    const computed = window.getComputedStyle(textarea);
    const fontSize = parseFloat(computed.fontSize) || 16;
    // Толщина каретки пропорциональна шрифту (≈7% размера). Минимум 1px — при сильном
    // отдалении каретка остаётся видимой и не нарушает пропорцию. Жёсткий пол 2px убран,
    // чтобы при уменьшении масштаба каретка масштабировалась вместе с текстом.
    const caretWidth = Math.max(1, Math.round(fontSize * 0.07));

    // Цвет текста в textarea теперь прозрачный (видимый текст рисует backdrop-слой),
    // поэтому цвет каретки берём из backdrop, иначе она станет невидимой.
    let caretColor = computed.color;
    if (!caretColor || caretColor === 'transparent' || caretColor === 'rgba(0, 0, 0, 0)') {
        const backdrop = caretEl.parentElement
            ? caretEl.parentElement.querySelector('.moodboard-text-backdrop')
            : null;
        const backdropColor = backdrop ? window.getComputedStyle(backdrop).color : '';
        caretColor = (backdropColor && backdropColor !== 'transparent' && backdropColor !== 'rgba(0, 0, 0, 0)')
            ? backdropColor
            : '#111';
    }

    caretEl.style.top = `${top - 2}px`;
    caretEl.style.left = `${left - Math.floor(caretWidth / 2)}px`;
    caretEl.style.height = `${coords.height}px`;
    caretEl.style.width = `${caretWidth}px`;
    caretEl.style.backgroundColor = caretColor;
    
    // Reset animation to keep it visible while typing
    caretEl.style.animation = 'none';
    void caretEl.offsetWidth; // trigger reflow
    caretEl.style.animation = 'mb-caret-blink 1s step-end infinite';
}
