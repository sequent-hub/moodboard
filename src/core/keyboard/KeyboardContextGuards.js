export function isInputElement(element) {
    if (!element || !element.tagName) {
        return false;
    }

    const inputTags = ['input', 'textarea', 'select'];
    const isInput = inputTags.includes(element.tagName.toLowerCase());
    const isContentEditable = element.contentEditable === 'true';

    return isInput || isContentEditable;
}

export function isTextEditorActive(doc = document) {
    const activeElement = doc.activeElement;

    if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
    )) {
        return true;
    }

    const fileNameEditor = doc.querySelector('.moodboard-file-name-editor');
    if (fileNameEditor && fileNameEditor.style.display !== 'none') {
        return true;
    }

    const textEditor = doc.querySelector('.moodboard-text-editor');
    if (textEditor && textEditor.style.display !== 'none') {
        return true;
    }

    return false;
}
