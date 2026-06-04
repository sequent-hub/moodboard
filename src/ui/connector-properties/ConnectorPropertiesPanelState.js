export function createConnectorPropertiesPanelState() {
    return {
        panel: null,
        currentId: null,

        // Main row
        _mainRow: null,

        // Stroke color
        strokeColorButton: null,
        strokeColorDropdown: null,
        strokeColorInput: null,
        _strokePresetButtons: [],
        _strokeSelectorContainer: null,
        _onStrokeDocumentClick: null,

        // Width buttons
        widthButtons: [],

        // Route dropdown
        routeSelect: null,

        // Dash toggle
        dashButton: null,

        // Head selects
        headEndSelect: null,
        headStartSelect: null,

        // Action buttons
        _swapBtn: null,
        _textBtn: null,
        _lockBtn: null,
        _delBtn:  null,

        // Label row (second row)
        _labelRow:           null,
        _labelColorBtn:      null,
        _labelColorDropdown: null,
        _labelColorContainer:null,
        _labelPresetButtons: [],
        _labelSizeDown:      null,
        _labelSizeDisplay:   null,
        _labelSizeUp:        null,
        _onLabelDocumentClick: null,

        // Internal flags
        _bindingsAttached: false,
        _eventBridgeAttached: false,
        _eventBridgeHandlers: null,
    };
}

export function clearConnectorPropertiesPanelState(state) {
    state.currentId = null;
    state._bindingsAttached = false;
    state._eventBridgeAttached = false;
    state._eventBridgeHandlers = null;
    state._onStrokeDocumentClick = null;
    state._onLabelDocumentClick  = null;
}
