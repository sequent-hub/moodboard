import {
    BACKGROUND_COLOR_PRESETS,
    FONT_OPTIONS,
    FONT_SIZE_OPTIONS,
    TEXT_COLOR_PRESETS,
} from './TextPropertiesPanelMapper.js';
import { createTextFormatControls } from './TextFormatControls.js';
import { createTextLockMoreControls } from './TextLockMoreControls.js';

const NO_COLOR_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 23.5C18.3513 23.5 23.5 18.3513 23.5 12C23.5 5.64873 18.3513 0.5 12 0.5C5.64873 0.5 0.5 5.64873 0.5 12C0.5 18.3513 5.64873 23.5 12 23.5Z" stroke="#B2B2B2" stroke-width="1.2"></path><path d="M4.27344 19.7266L19.7148 4.28516" stroke="#B2B2B2" stroke-width="1.2"></path></svg>`;

function createNoColorIcon(extraStyle = '') {
    const wrapper = document.createElement('span');
    wrapper.className = 'no-color-icon';
    wrapper.style.cssText = `display:inline-flex;pointer-events:none;width:20px;height:20px;${extraStyle}`;
    wrapper.innerHTML = NO_COLOR_ICON_SVG;
    return wrapper;
}

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
        if (panelInstance.colorIndicator) {
            panelInstance.colorIndicator.style.backgroundColor = color;
        }
        panelInstance.currentColorButton.title = `Текущий цвет: ${color}`;
    }
    if (panelInstance.colorInput) {
        panelInstance.colorInput.value = color;
    }
}

export function toggleHighlightDropdown(panelInstance) {
    if (!panelInstance.highlightDropdown) {
        return;
    }

    if (panelInstance.highlightDropdown.style.display === 'none') {
        panelInstance.highlightDropdown.style.display = 'block';
    } else {
        panelInstance.highlightDropdown.style.display = 'none';
    }
}

export function hideHighlightDropdown(panelInstance) {
    if (panelInstance.highlightDropdown) {
        panelInstance.highlightDropdown.style.display = 'none';
    }
}

export function updateCurrentHighlightButton(panelInstance, color) {
    if (panelInstance.currentHighlightButton) {
        if (panelInstance.highlightIndicator) {
            panelInstance.highlightIndicator.style.backgroundColor = color === 'transparent' ? 'transparent' : color;
        }
        panelInstance.currentHighlightButton.title = color === 'transparent' ? 'Без фона текста' : `Цвет фона текста: ${color}`;
    }
    if (panelInstance.highlightInput) {
        panelInstance.highlightInput.value = color === 'transparent' ? '#ffff99' : color;
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

            const line = panelInstance.currentBgColorButton.querySelector('div');
            if (line) {
                line.remove();
            }

            if (!panelInstance.currentBgColorButton.querySelector('.no-color-icon')) {
                panelInstance.currentBgColorButton.appendChild(
                    createNoColorIcon('position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);')
                );
            }
        } else {
            panelInstance.currentBgColorButton.style.backgroundColor = color;
            panelInstance.currentBgColorButton.title = `Цвет выделения: ${color}`;
            
            const icon = panelInstance.currentBgColorButton.querySelector('.no-color-icon');
            if (icon) {
                icon.remove();
            }
            
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
    const fontWrapper = document.createElement('div');
    fontWrapper.className = 'font-select-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'font-select';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'font-select__label';
    trigger.appendChild(triggerLabel);

    const dropdown = document.createElement('div');
    dropdown.id = `tpp-font-dropdown-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    dropdown.className = 'font-dropdown';
    dropdown.setAttribute('role', 'listbox');

    const optionElements = [];
    const optionRefs = FONT_OPTIONS.map((font) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'font-dropdown__item';
        item.setAttribute('role', 'option');
        item.dataset.value = font.value;
        item.textContent = font.name;
        item.style.fontFamily = font.value;
        dropdown.appendChild(item);
        optionElements.push(item);
        return { value: font.value, textContent: font.name, element: item };
    });

    fontWrapper.appendChild(trigger);
    fontWrapper.appendChild(dropdown);
    panel.appendChild(fontWrapper);

    let currentValue = FONT_OPTIONS[0].value;
    const applyValue = (newValue) => {
        currentValue = newValue;
        const match = optionRefs.find((opt) => opt.value === newValue);
        triggerLabel.textContent = match ? match.textContent : newValue;
        triggerLabel.style.fontFamily = newValue;
        optionRefs.forEach((opt) => {
            opt.element.classList.toggle('is-active', opt.value === newValue);
        });
    };
    applyValue(currentValue);

    Object.defineProperty(trigger, 'value', {
        configurable: true,
        get() {
            return currentValue;
        },
        set(newValue) {
            applyValue(newValue);
        },
    });
    Object.defineProperty(trigger, 'options', {
        configurable: true,
        get() {
            return optionElements;
        },
    });

    panelInstance.fontSelect = trigger;
    panelInstance.fontDropdown = dropdown;
    panelInstance._fontSelectWrapper = fontWrapper;

    const fontSeparator = document.createElement('div');
    fontSeparator.style.cssText = 'width:1px;height:18px;background:#e0e0e0;margin:0 6px;flex-shrink:0;';
    panel.appendChild(fontSeparator);

    const fontSizeWrapper = document.createElement('div');
    fontSizeWrapper.className = 'font-size-wrapper';

    panelInstance.fontSizeSelect = document.createElement('select');
    panelInstance.fontSizeSelect.className = 'font-size-select';

    FONT_SIZE_OPTIONS.forEach((size) => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = String(size);
        panelInstance.fontSizeSelect.appendChild(option);
    });

    const stepperContainer = document.createElement('div');
    stepperContainer.className = 'font-size-steppers';

    panelInstance.fontSizeUpBtn = document.createElement('button');
    panelInstance.fontSizeUpBtn.type = 'button';
    panelInstance.fontSizeUpBtn.className = 'font-size-stepper font-size-stepper--up';
    panelInstance.fontSizeUpBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style="top: 1px;"><path d="M8.25 6.75L5 3.25L1.75 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

    panelInstance.fontSizeDownBtn = document.createElement('button');
    panelInstance.fontSizeDownBtn.type = 'button';
    panelInstance.fontSizeDownBtn.className = 'font-size-stepper font-size-stepper--down';
    panelInstance.fontSizeDownBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="bottom: 1px;"><path d="M8.25 3.25L5 6.75L1.75 3.25"></path></svg>';

    stepperContainer.appendChild(panelInstance.fontSizeUpBtn);
    stepperContainer.appendChild(panelInstance.fontSizeDownBtn);

    fontSizeWrapper.appendChild(panelInstance.fontSizeSelect);
    fontSizeWrapper.appendChild(stepperContainer);

    panel.appendChild(fontSizeWrapper);

    const colorSeparator = document.createElement('div');
    colorSeparator.style.cssText = 'width:1px;height:18px;background:#e0e0e0;margin:0 6px;flex-shrink:0;';
    panel.appendChild(colorSeparator);

    createCompactColorSelector(panelInstance, panel);

    createCompactHighlightSelector(panelInstance, panel);

    createCompactBackgroundSelector(panelInstance, panel);

    const mdSeparator = document.createElement('div');
    mdSeparator.style.cssText = 'width:1px;height:18px;background:#e0e0e0;margin:0 6px;flex-shrink:0;';
    panel.appendChild(mdSeparator);

    const mdId = `tpp-md-${Date.now()}`;
    panelInstance.markdownToggle = document.createElement('input');
    panelInstance.markdownToggle.type = 'checkbox';
    panelInstance.markdownToggle.id = mdId;
    panelInstance.markdownToggle.className = 'tpp-md-toggle';
    panelInstance.markdownToggle.style.cssText = 'width:14px;height:14px;cursor:pointer;flex-shrink:0;';

    const mdLabel = document.createElement('label');
    mdLabel.htmlFor = mdId;
    mdLabel.textContent = 'MD';
    mdLabel.title = 'Отображать как Markdown';
    mdLabel.className = 'tpp-label';
    mdLabel.style.cssText = 'cursor:pointer;user-select:none;';

    panel.appendChild(panelInstance.markdownToggle);
    panel.appendChild(mdLabel);

    createTextFormatControls(panelInstance, panel);

    createTextLockMoreControls(panelInstance, panel);
}

function createCompactColorSelector(panelInstance, panel) {
    const colorSelectorContainer = document.createElement('div');
    colorSelectorContainer.style.cssText = `
        position: relative;
        display: inline-block;
    `;
    panelInstance._colorSelectorContainer = colorSelectorContainer;

    panelInstance.currentColorButton = document.createElement('button');
    panelInstance.currentColorButton.type = 'button';
    panelInstance.currentColorButton.title = 'Выбрать цвет';
    panelInstance.currentColorButton.className = 'current-color-button';

    const colorIcon = document.createElement('span');
    colorIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5636 13.9875L12 5L15.4364 13.9875"></path><path d="M9.88525 10.8155H14.1147"></path></svg>';
    colorIcon.style.cssText = 'width: 24px; height: 24px; pointer-events: none; display: flex; align-items: center; justify-content: center;';

    panelInstance.colorIndicator = document.createElement('div');
    panelInstance.colorIndicator.style.cssText = `
        width: 18px;
        height: 5px;
        position: absolute;
        bottom: 2px;
        background: rgb(255, 235, 164);
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset;
        border-radius: 2px;
    `;

    panelInstance.currentColorButton.appendChild(colorIcon);
    panelInstance.currentColorButton.appendChild(panelInstance.colorIndicator);

    panelInstance.colorDropdown = document.createElement('div');
    panelInstance.colorDropdown.id = `tpp-color-dropdown-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
        width: max-content;
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

function createCompactHighlightSelector(panelInstance, panel) {
    const highlightSelectorContainer = document.createElement('div');
    highlightSelectorContainer.style.cssText = `
        position: relative;
        display: inline-block;
        margin-left: 4px;
    `;
    panelInstance._highlightSelectorContainer = highlightSelectorContainer;

    panelInstance.currentHighlightButton = document.createElement('button');
    panelInstance.currentHighlightButton.type = 'button';
    panelInstance.currentHighlightButton.title = 'Выбрать цвет фона текста';
    panelInstance.currentHighlightButton.className = 'current-highlight-button';

    const highlightIcon = document.createElement('span');
    highlightIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.431 13.4828L17.5 6.27586L15.2241 4L8.01724 10.069M11.431 13.4828L6.5 15L8.01724 10.069M11.431 13.4828L8.01724 10.069" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    highlightIcon.style.cssText = 'width: 24px; height: 24px; pointer-events: none; display: flex; align-items: center; justify-content: center;';

    panelInstance.highlightIndicator = document.createElement('div');
    panelInstance.highlightIndicator.style.cssText = `
        width: 18px;
        height: 5px;
        position: absolute;
        bottom: 2px;
        background: transparent;
        box-shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset;
        border-radius: 2px;
    `;

    panelInstance.currentHighlightButton.appendChild(highlightIcon);
    panelInstance.currentHighlightButton.appendChild(panelInstance.highlightIndicator);

    panelInstance.highlightDropdown = document.createElement('div');
    panelInstance.highlightDropdown.id = `tpp-highlight-dropdown-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    panelInstance.highlightDropdown.style.cssText = `
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
        width: max-content;
    `;

    createHighlightColorGrid(panelInstance, panelInstance.highlightDropdown);

    highlightSelectorContainer.appendChild(panelInstance.currentHighlightButton);
    highlightSelectorContainer.appendChild(panelInstance.highlightDropdown);
    panel.appendChild(highlightSelectorContainer);
}

function createHighlightColorGrid(panelInstance, container) {
    const presetsGrid = document.createElement('div');
    presetsGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(6, 28px);
        gap: 6px;
        margin-bottom: 8px;
        align-items: center;
        justify-items: center;
    `;

    panelInstance._highlightPresetButtons = [];

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

            colorButton.appendChild(createNoColorIcon());
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
        panelInstance._highlightPresetButtons.push(colorButton);
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

    panelInstance.highlightInput = document.createElement('input');
    panelInstance.highlightInput.type = 'color';
    panelInstance.highlightInput.style.cssText = `
        width: 32px;
        height: 24px;
        border: 1px solid #ddd;
        border-radius: 3px;
        cursor: pointer;
        padding: 0;
    `;

    customContainer.appendChild(customLabel);
    customContainer.appendChild(panelInstance.highlightInput);
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
    panelInstance.bgColorDropdown.id = `tpp-bgcolor-dropdown-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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
        width: max-content;
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

            colorButton.appendChild(createNoColorIcon());
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
