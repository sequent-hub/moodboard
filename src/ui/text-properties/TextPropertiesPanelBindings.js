function hidePresetTicks(buttons) {
    buttons.forEach((button) => {
        const tick = button.querySelector('i');
        if (tick) {
            tick.style.display = 'none';
        }
    });
}

export function bindTextPropertiesPanelControls(panel) {
    if (panel._bindingsAttached) {
        return;
    }

    panel.fontSelect.addEventListener('change', (event) => {
        panel._changeFontFamily(event.target.value);
    });

    panel.fontSizeSelect.addEventListener('change', (event) => {
        panel._changeFontSize(parseInt(event.target.value, 10));
    });

    panel.currentColorButton.addEventListener('click', (event) => {
        event.stopPropagation();
        panel._toggleColorDropdown();
    });

    panel._colorPresetButtons.forEach((button) => {
        button.addEventListener('click', () => {
            hidePresetTicks(panel._colorPresetButtons);
            const tick = button.querySelector('i');
            if (tick) {
                tick.style.display = 'block';
            }
            panel._selectColor(button.dataset.colorValue);
        });
    });

    panel.colorInput.addEventListener('change', (event) => {
        panel._selectColor(event.target.value);
    });

    panel._onColorDocumentClick = (event) => {
        if (!panel._colorSelectorContainer || !event.target || !panel._colorSelectorContainer.contains(event.target)) {
            panel._hideColorDropdown();
        }
    };
    document.addEventListener('click', panel._onColorDocumentClick);

    panel.currentBgColorButton.addEventListener('click', (event) => {
        event.stopPropagation();
        panel._toggleBgColorDropdown();
    });

    panel._bgPresetButtons.forEach((button) => {
        button.addEventListener('click', () => {
            hidePresetTicks(panel._bgPresetButtons);
            const tick = button.querySelector('i');
            if (tick) {
                tick.style.display = 'block';
            }
            panel._selectBgColor(button.dataset.colorValue);
        });
    });

    panel.bgColorInput.addEventListener('change', (event) => {
        panel._selectBgColor(event.target.value);
    });

    panel._onBgDocumentClick = (event) => {
        if (!panel._bgSelectorContainer || !event.target || !panel._bgSelectorContainer.contains(event.target)) {
            panel._hideBgColorDropdown();
        }
    };
    document.addEventListener('click', panel._onBgDocumentClick);

    panel._bindingsAttached = true;
}

export function unbindTextPropertiesPanelControls(panel) {
    if (panel._onColorDocumentClick) {
        document.removeEventListener('click', panel._onColorDocumentClick);
        panel._onColorDocumentClick = null;
    }

    if (panel._onBgDocumentClick) {
        document.removeEventListener('click', panel._onBgDocumentClick);
        panel._onBgDocumentClick = null;
    }

    panel._bindingsAttached = false;
}
