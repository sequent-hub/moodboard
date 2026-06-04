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

export function createFileNameEditorWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'moodboard-file-name-editor';
    wrapper.style.cssText = `
            position: absolute;
            z-index: 1000;
            background: white;
            border: 2px solid #2563eb;
            border-radius: 6px;
            padding: 6px 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 140px;
            max-width: 200px;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        `;
    return wrapper;
}

export function createFrameTitleEditorWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'moodboard-frame-title-editor';
    wrapper.style.cssText = `
            position: absolute;
            z-index: 1000;
            background: white;
            border: 2px solid #2563eb;
            border-radius: 6px;
            padding: 3px 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 100px;
            max-width: 320px;
            font-family: Inter, system-ui, -apple-system, Arial, sans-serif;
        `;
    return wrapper;
}

export function createFrameTitleEditorInput(title) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = title;
    input.style.cssText = `
            border: none;
            outline: none;
            background: transparent;
            font-family: Inter, system-ui, -apple-system, Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            width: 100%;
            padding: 1px 2px;
            color: #1f2937;
        `;
    return input;
}

export function createFileNameEditorInput(fileName) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = fileName;
    input.style.cssText = `
            border: none;
            outline: none;
            background: transparent;
            font-family: inherit;
            font-size: 12px;
            text-align: center;
            width: 100%;
            padding: 2px 4px;
            color: #1f2937;
            font-weight: 500;
        `;
    return input;
}
