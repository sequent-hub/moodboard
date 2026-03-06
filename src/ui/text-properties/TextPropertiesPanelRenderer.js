import {
    BACKGROUND_COLOR_PRESETS,
    FONT_OPTIONS,
    FONT_SIZE_OPTIONS,
    TEXT_COLOR_PRESETS,
} from './TextPropertiesPanelMapper.js';

export function createTextPropertiesPanelRenderer(panelInstance) {
    const panel = document.createElement('div');
    panel.className = 'text-properties-panel';

    createFontControls(panelInstance, panel);

    panelInstance.panel = panel;
    return panel;
}

export function toggleColorDropdown(panelInstance) {
    if (!panelInstance.colorDropdown) {
        return;
    }

    if (panelInstance.colorDropdown.style.display === 'none') {
        panelInstance.colorDropdown.style.display = 'block';
    } else {
        panelInstance.colorDropdown.style.display = 'none';
    }
}

export function hideColorDropdown(panelInstance) {
    if (panelInstance.colorDropdown) {
        panelInstance.colorDropdown.style.display = 'none';
    }
}

export function updateCurrentColorButton(panelInstance, color) {
    if (panelInstance.currentColorButton) {
        panelInstance.currentColorButton.style.backgroundColor = color;
        panelInstance.currentColorButton.title = `Текущий цвет: ${color}`;
    }
    if (panelInstance.colorInput) {
        panelInstance.colorInput.value = color;
    }
}

export function toggleBgColorDropdown(panelInstance) {
    if (!panelInstance.bgColorDropdown) {
        return;
    }

    if (panelInstance.bgColorDropdown.style.display === 'none') {
        panelInstance.bgColorDropdown.style.display = 'block';
    } else {
        panelInstance.bgColorDropdown.style.display = 'none';
    }
}

export function hideBgColorDropdown(panelInstance) {
    if (panelInstance.bgColorDropdown) {
        panelInstance.bgColorDropdown.style.display = 'none';
    }
}

export function updateCurrentBgColorButton(panelInstance, color) {
    if (panelInstance.currentBgColorButton) {
        if (color === 'transparent') {
            panelInstance.currentBgColorButton.style.backgroundColor = 'white';
            panelInstance.currentBgColorButton.title = 'Без выделения';

            if (!panelInstance.currentBgColorButton.querySelector('div')) {
                const line = document.createElement('div');
                line.style.cssText = `
                    width: 20px;
                    height: 1px;
                    background: #ff0000;
                    transform: rotate(45deg);
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform-origin: center;
                    transform: translate(-50%, -50%) rotate(45deg);
                `;
                panelInstance.currentBgColorButton.appendChild(line);
            }
        } else {
            panelInstance.currentBgColorButton.style.backgroundColor = color;
            panelInstance.currentBgColorButton.title = `Цвет выделения: ${color}`;
            const line = panelInstance.currentBgColorButton.querySelector('div');
            if (line) {
                line.remove();
            }
        }
    }

    if (panelInstance.bgColorInput) {
        panelInstance.bgColorInput.value = color === 'transparent' ? '#ffff99' : color;
    }
}

function createFontControls(panelInstance, panel) {
    const fontLabel = document.createElement('span');
    fontLabel.textContent = 'Шрифт:';
    fontLabel.className = 'tpp-label';
    panel.appendChild(fontLabel);

    panelInstance.fontSelect = document.createElement('select');
    panelInstance.fontSelect.className = 'font-select';
    panelInstance.fontSelect.className = 'font-select';

    FONT_OPTIONS.forEach((font) => {
        const option = document.createElement('option');
        option.value = font.value;
        option.textContent = font.name;
        option.style.fontFamily = font.value;
        panelInstance.fontSelect.appendChild(option);
    });

    panel.appendChild(panelInstance.fontSelect);

    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = 'Размер:';
    sizeLabel.className = 'tpp-label tpp-label--spaced';
    panel.appendChild(sizeLabel);

    panelInstance.fontSizeSelect = document.createElement('select');
    panelInstance.fontSizeSelect.className = 'font-size-select';
    panelInstance.fontSizeSelect.className = 'font-size-select';

    FONT_SIZE_OPTIONS.forEach((size) => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}px`;
        panelInstance.fontSizeSelect.appendChild(option);
    });

    panel.appendChild(panelInstance.fontSizeSelect);

    const colorLabel = document.createElement('span');
    colorLabel.textContent = 'Цвет:';
    colorLabel.className = 'tpp-label tpp-label--spaced';
    panel.appendChild(colorLabel);

    createCompactColorSelector(panelInstance, panel);

    const bgColorLabel = document.createElement('span');
    bgColorLabel.textContent = 'Фон:';
    bgColorLabel.className = 'tpp-label tpp-label--spaced';
    panel.appendChild(bgColorLabel);

    createCompactBackgroundSelector(panelInstance, panel);
}

function createCompactColorSelector(panelInstance, panel) {
    const colorSelectorContainer = document.createElement('div');
    colorSelectorContainer.style.cssText = `
        position: relative;
        display: inline-block;
        margin-left: 4px;
    `;
    panelInstance._colorSelectorContainer = colorSelectorContainer;

    panelInstance.currentColorButton = document.createElement('button');
    panelInstance.currentColorButton.type = 'button';
    panelInstance.currentColorButton.title = 'Выбрать цвет';
    panelInstance.currentColorButton.className = 'current-color-button';

    panelInstance.colorDropdown = document.createElement('div');
    panelInstance.colorDropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        padding: 8px;
        display: none;
        z-index: 10000;
        min-width: 200px;
    `;

    createColorGrid(panelInstance, panelInstance.colorDropdown);

    colorSelectorContainer.appendChild(panelInstance.currentColorButton);
    colorSelectorContainer.appendChild(panelInstance.colorDropdown);
    panel.appendChild(colorSelectorContainer);
}

function createColorGrid(panelInstance, container) {
    const presetsGrid = document.createElement('div');
    presetsGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(6, 28px);
        gap: 6px;
        margin-bottom: 8px;
        align-items: center;
        justify-items: center;
    `;

    panelInstance._colorPresetButtons = [];

    TEXT_COLOR_PRESETS.forEach((preset) => {
        const colorButton = document.createElement('button');
        colorButton.type = 'button';
        colorButton.title = preset.name;
        colorButton.dataset.colorValue = preset.color;
        colorButton.style.cssText = `
            width: 28px;
            height: 28px;
            border: 1px solid #ddd;
            border-radius: 50%;
            background-color: ${preset.color};
            cursor: pointer;
            margin: 0;
            padding: 0;
            display: block;
            box-sizing: border-box;
            ${preset.color === '#ffffff' ? 'border-color: #ccc;' : ''}
            position: relative;
        `;

        const tick = document.createElement('i');
        tick.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            width: 8px;
            height: 5px;
            transform: translate(-50%, -50%) rotate(315deg) scaleX(-1);
            border-right: 2px solid #111;
            border-bottom: 2px solid #111;
            display: none;
            pointer-events: none;
        `;
        colorButton.appendChild(tick);
        presetsGrid.appendChild(colorButton);
        panelInstance._colorPresetButtons.push(colorButton);
    });

    container.appendChild(presetsGrid);

    const separator = document.createElement('div');
    separator.style.cssText = `
        height: 1px;
        background: #eee;
        margin: 8px 0;
    `;
    container.appendChild(separator);

    const customContainer = document.createElement('div');
    customContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    const customLabel = document.createElement('span');
    customLabel.textContent = 'Свой цвет:';
    customLabel.style.cssText = `
        font-size: 12px;
        color: #666;
    `;

    panelInstance.colorInput = document.createElement('input');
    panelInstance.colorInput.type = 'color';
    panelInstance.colorInput.style.cssText = `
        width: 32px;
        height: 24px;
        border: 1px solid #ddd;
        border-radius: 3px;
        cursor: pointer;
        padding: 0;
    `;

    customContainer.appendChild(customLabel);
    customContainer.appendChild(panelInstance.colorInput);
    container.appendChild(customContainer);
}

function createCompactBackgroundSelector(panelInstance, panel) {
    const bgSelectorContainer = document.createElement('div');
    bgSelectorContainer.style.cssText = `
        position: relative;
        display: inline-block;
        margin-left: 4px;
    `;
    panelInstance._bgSelectorContainer = bgSelectorContainer;

    panelInstance.currentBgColorButton = document.createElement('button');
    panelInstance.currentBgColorButton.type = 'button';
    panelInstance.currentBgColorButton.title = 'Выбрать цвет выделения';
    panelInstance.currentBgColorButton.className = 'current-bgcolor-button';

    panelInstance.bgColorDropdown = document.createElement('div');
    panelInstance.bgColorDropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        padding: 8px;
        display: none;
        z-index: 10000;
        min-width: 200px;
    `;

    createBackgroundColorGrid(panelInstance, panelInstance.bgColorDropdown);

    bgSelectorContainer.appendChild(panelInstance.currentBgColorButton);
    bgSelectorContainer.appendChild(panelInstance.bgColorDropdown);
    panel.appendChild(bgSelectorContainer);
}

function createBackgroundColorGrid(panelInstance, container) {
    const presetsGrid = document.createElement('div');
    presetsGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(6, 28px);
        gap: 6px;
        margin-bottom: 8px;
        align-items: center;
        justify-items: center;
    `;

    panelInstance._bgPresetButtons = [];

    BACKGROUND_COLOR_PRESETS.forEach((preset) => {
        const colorButton = document.createElement('button');
        colorButton.type = 'button';
        colorButton.title = preset.name;
        colorButton.dataset.colorValue = preset.color;

        if (preset.color === 'transparent') {
            colorButton.style.cssText = `
                width: 28px;
                height: 28px;
                border: 1px solid #ddd;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                position: relative;
            `;

            const line = document.createElement('div');
            line.style.cssText = `
                width: 20px;
                height: 1px;
                background: #ff0000;
                transform: rotate(45deg);
            `;
            colorButton.appendChild(line);
        } else {
            colorButton.style.cssText = `
                width: 28px;
                height: 28px;
                border: 1px solid #ddd;
                border-radius: 50%;
                background-color: ${preset.color};
                cursor: pointer;
                margin: 0;
                padding: 0;
                display: block;
                box-sizing: border-box;
                ${preset.color === '#ffffff' ? 'border-color: #ccc;' : ''}
                position: relative;
            `;

            const tick = document.createElement('i');
            tick.style.cssText = `
                position: absolute;
                left: 50%;
                top: 50%;
                width: 8px;
                height: 5px;
                transform: translate(-50%, -50%) rotate(315deg) scaleX(-1);
                border-right: 2px solid #111;
                border-bottom: 2px solid #111;
                display: none;
                pointer-events: none;
            `;
            colorButton.appendChild(tick);
        }

        presetsGrid.appendChild(colorButton);
        panelInstance._bgPresetButtons.push(colorButton);
    });

    container.appendChild(presetsGrid);

    const separator = document.createElement('div');
    separator.style.cssText = `
        height: 1px;
        background: #eee;
        margin: 8px 0;
    `;
    container.appendChild(separator);

    const customContainer = document.createElement('div');
    customContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    const customLabel = document.createElement('span');
    customLabel.textContent = 'Свой цвет:';
    customLabel.style.cssText = `
        font-size: 12px;
        color: #666;
    `;

    panelInstance.bgColorInput = document.createElement('input');
    panelInstance.bgColorInput.type = 'color';
    panelInstance.bgColorInput.style.cssText = `
        width: 32px;
        height: 24px;
        border: 1px solid #ddd;
        border-radius: 3px;
        cursor: pointer;
        padding: 0;
    `;

    customContainer.appendChild(customLabel);
    customContainer.appendChild(panelInstance.bgColorInput);
    container.appendChild(customContainer);
}
