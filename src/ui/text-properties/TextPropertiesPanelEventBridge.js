import { Events } from '../../core/events/Events.js';

export function attachTextPropertiesPanelEventBridge(panel) {
    if (panel._eventBridgeAttached) {
        return;
    }

    panel._eventBridgeHandlers = {
        onSelectionAdd: () => panel.updateFromSelection(),
        onSelectionRemove: () => panel.updateFromSelection(),
        onSelectionClear: () => panel.hide(),
        onDragUpdate: () => panel.reposition(),
        onGroupDragUpdate: () => panel.reposition(),
        onResizeUpdate: () => panel.reposition(),
        onRotateUpdate: () => panel.reposition(),
        onZoomPercent: () => panel.reposition(),
        onPanUpdate: () => panel.reposition(),
        onDeleted: ({ objectId }) => {
            if (panel.currentId && objectId === panel.currentId) {
                panel.hide();
            }
        },
        onTextEditStart: () => {
            panel.isTextEditing = true;
            panel.hide();
        },
        onTextEditEnd: () => {
            panel.isTextEditing = false;
            setTimeout(() => panel.updateFromSelection(), 100);
        },
        onStateChanged: ({ objectId }) => {
            if (panel.currentId && objectId === panel.currentId && panel.panel && panel.panel.style.display !== 'none') {
                panel._updateControlsFromObject();
            }
        },
    };

    panel.eventBus.on(Events.Tool.SelectionAdd, panel._eventBridgeHandlers.onSelectionAdd);
    panel.eventBus.on(Events.Tool.SelectionRemove, panel._eventBridgeHandlers.onSelectionRemove);
    panel.eventBus.on(Events.Tool.SelectionClear, panel._eventBridgeHandlers.onSelectionClear);
    panel.eventBus.on(Events.Tool.DragUpdate, panel._eventBridgeHandlers.onDragUpdate);
    panel.eventBus.on(Events.Tool.GroupDragUpdate, panel._eventBridgeHandlers.onGroupDragUpdate);
    panel.eventBus.on(Events.Tool.ResizeUpdate, panel._eventBridgeHandlers.onResizeUpdate);
    panel.eventBus.on(Events.Tool.RotateUpdate, panel._eventBridgeHandlers.onRotateUpdate);
    panel.eventBus.on(Events.UI.ZoomPercent, panel._eventBridgeHandlers.onZoomPercent);
    panel.eventBus.on(Events.Tool.PanUpdate, panel._eventBridgeHandlers.onPanUpdate);
    panel.eventBus.on(Events.Object.Deleted, panel._eventBridgeHandlers.onDeleted);
    panel.eventBus.on(Events.UI.TextEditStart, panel._eventBridgeHandlers.onTextEditStart);
    panel.eventBus.on(Events.UI.TextEditEnd, panel._eventBridgeHandlers.onTextEditEnd);
    panel.eventBus.on(Events.Object.StateChanged, panel._eventBridgeHandlers.onStateChanged);

    panel._eventBridgeAttached = true;
}

export function detachTextPropertiesPanelEventBridge(panel) {
    if (!panel._eventBridgeAttached || !panel._eventBridgeHandlers || !panel.eventBus?.off) {
        panel._eventBridgeAttached = false;
        return;
    }

    panel.eventBus.off(Events.Tool.SelectionAdd, panel._eventBridgeHandlers.onSelectionAdd);
    panel.eventBus.off(Events.Tool.SelectionRemove, panel._eventBridgeHandlers.onSelectionRemove);
    panel.eventBus.off(Events.Tool.SelectionClear, panel._eventBridgeHandlers.onSelectionClear);
    panel.eventBus.off(Events.Tool.DragUpdate, panel._eventBridgeHandlers.onDragUpdate);
    panel.eventBus.off(Events.Tool.GroupDragUpdate, panel._eventBridgeHandlers.onGroupDragUpdate);
    panel.eventBus.off(Events.Tool.ResizeUpdate, panel._eventBridgeHandlers.onResizeUpdate);
    panel.eventBus.off(Events.Tool.RotateUpdate, panel._eventBridgeHandlers.onRotateUpdate);
    panel.eventBus.off(Events.UI.ZoomPercent, panel._eventBridgeHandlers.onZoomPercent);
    panel.eventBus.off(Events.Tool.PanUpdate, panel._eventBridgeHandlers.onPanUpdate);
    panel.eventBus.off(Events.Object.Deleted, panel._eventBridgeHandlers.onDeleted);
    panel.eventBus.off(Events.UI.TextEditStart, panel._eventBridgeHandlers.onTextEditStart);
    panel.eventBus.off(Events.UI.TextEditEnd, panel._eventBridgeHandlers.onTextEditEnd);
    panel.eventBus.off(Events.Object.StateChanged, panel._eventBridgeHandlers.onStateChanged);

    panel._eventBridgeHandlers = null;
    panel._eventBridgeAttached = false;
}
