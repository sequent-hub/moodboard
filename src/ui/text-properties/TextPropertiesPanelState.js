export function createTextPropertiesPanelState() {
    return {
        layer: null,
        panel: null,
        currentId: null,
        isTextEditing: false,
        fontSelect: null,
        fontSizeSelect: null,
        currentColorButton: null,
        colorDropdown: null,
        colorInput: null,
        currentBgColorButton: null,
        bgColorDropdown: null,
        bgColorInput: null,
        _bindingsAttached: false,
        _eventBridgeAttached: false,
        _eventBridgeHandlers: null,
        _colorSelectorContainer: null,
        _bgSelectorContainer: null,
        _colorPresetButtons: [],
        _bgPresetButtons: [],
        _onColorDocumentClick: null,
        _onBgDocumentClick: null,
    };
}

export function resetCurrentSelection(panel) {
    panel.currentId = null;
}

export function clearTextPropertiesPanelState(panel) {
    panel.layer = null;
    panel.currentId = null;
    panel._bindingsAttached = false;
    panel._eventBridgeAttached = false;
    panel._eventBridgeHandlers = null;
    panel._onColorDocumentClick = null;
    panel._onBgDocumentClick = null;
}
