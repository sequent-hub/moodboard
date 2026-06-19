function hidePresetTicks(buttons) {
    buttons.forEach((button) => {
        const tick = button.querySelector('i');
        if (tick) {
            tick.style.display = 'none';
        }
    });
}

function setFontDropdownOpen(panel, isOpen) {
    if (!panel.fontDropdown || !panel.fontSelect) {
        return;
    }
    panel.fontDropdown.classList.toggle('is-open', isOpen);
    panel.fontSelect.classList.toggle('is-active', isOpen);
    panel.fontSelect.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

export function bindTextPropertiesPanelControls(panel) {
    if (panel._bindingsAttached) {
        return;
    }

    panel.fontSelect.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = !panel.fontDropdown.classList.contains('is-open');
        setFontDropdownOpen(panel, willOpen);
    });

    panel.fontSelect.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const willOpen = !panel.fontDropdown.classList.contains('is-open');
            setFontDropdownOpen(panel, willOpen);
        } else if (event.key === 'Escape') {
            setFontDropdownOpen(panel, false);
        }
    });

    panel.fontDropdown.querySelectorAll('.font-dropdown__item').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.stopPropagation();
            const value = item.dataset.value;
            panel.fontSelect.value = value;
            panel._changeFontFamily(value);
            setFontDropdownOpen(panel, false);
        });
    });

    panel._onFontDocumentClick = (event) => {
        if (!panel._fontSelectWrapper || !event.target) {
            return;
        }
        if (!panel._fontSelectWrapper.contains(event.target)) {
            setFontDropdownOpen(panel, false);
        }
    };
    document.addEventListener('click', panel._onFontDocumentClick);

    panel.fontSizeSelect.addEventListener('change', (event) => {
        panel._changeFontSize(parseInt(event.target.value, 10));
    });

    if (panel.fontSizeUpBtn) {
        panel.fontSizeUpBtn.addEventListener('click', () => {
            const select = panel.fontSizeSelect;
            if (select.selectedIndex < select.options.length - 1) {
                select.selectedIndex++;
                select.dispatchEvent(new Event('change'));
            }
        });
    }

    if (panel.fontSizeDownBtn) {
        panel.fontSizeDownBtn.addEventListener('click', () => {
            const select = panel.fontSizeSelect;
            if (select.selectedIndex > 0) {
                select.selectedIndex--;
                select.dispatchEvent(new Event('change'));
            }
        });
    }

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

    if (panel.markdownToggle) {
        panel.markdownToggle.addEventListener('change', (event) => {
            panel._changeMarkdown(event.target.checked);
        });
    }

    [
        [panel.boldBtn, 'bold'],
        [panel.italicBtn, 'italic'],
        [panel.underlineBtn, 'underline'],
        [panel.strikethroughBtn, 'strikethrough'],
    ].forEach(([btn, prop]) => {
        if (btn) btn.addEventListener('click', () => panel._toggleFormat(prop));
    });

    if (panel.alignControl) {
        panel.alignControl.addEventListener('change', (e) => panel._changeTextAlign(e.target.value));
    }

    if (panel.listControl) {
        panel.listControl.addEventListener('change', (e) => panel._changeListType(e.target.value));
    }

    if (panel.lineHeightSlider) {
        panel.lineHeightSlider.addEventListener('input', (e) => panel._changeLineHeight(parseFloat(e.target.value)));
    }

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

    if (panel._onFontDocumentClick) {
        document.removeEventListener('click', panel._onFontDocumentClick);
        panel._onFontDocumentClick = null;
    }

    panel._bindingsAttached = false;
}
