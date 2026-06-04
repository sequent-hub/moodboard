import { Events } from '../../core/events/Events.js';

export function attachConnectorPropertiesPanelEventBridge(inst) {
    if (inst._eventBridgeAttached) return;

    inst._eventBridgeHandlers = {
        onSelectionAdd:    () => inst.updateFromSelection(),
        onSelectionRemove: () => inst.updateFromSelection(),
        onSelectionClear:  () => inst.hide(),

        onDragStart:       () => inst.hide(),
        onDragUpdate:      () => inst.reposition(),
        onDragEnd:         () => inst.updateFromSelection(),

        onGroupDragStart:  () => inst.hide(),
        onGroupDragUpdate: () => inst.reposition(),
        onGroupDragEnd:    () => inst.updateFromSelection(),

        onResizeUpdate:    () => inst.reposition(),
        onRotateUpdate:    () => inst.reposition(),

        onZoomPercent:     () => { if (inst.currentId) inst.reposition(); },
        onPanUpdate:       () => { if (inst.currentId) inst.reposition(); },

        onDeleted: (objectId) => {
            if (inst.currentId && objectId === inst.currentId) inst.hide();
        },

        onToolActivated: ({ tool }) => {
            if (tool !== 'select') inst.hide();
        },

        onStateChanged: ({ objectId }) => {
            if (inst.currentId && objectId === inst.currentId
                && inst.panel && inst.panel.style.display !== 'none') {
                inst._updateControlsFromObject();
            }
        },

        // History.Changed — синхронизация после undo/redo (как у FramePropertiesPanel)
        onHistoryChanged: () => {
            if (inst.currentId && inst.panel && inst.panel.style.display !== 'none') {
                inst._updateControlsFromObject();
            }
        },
    };

    const h = inst._eventBridgeHandlers;
    const eb = inst.eventBus;

    eb.on(Events.Tool.SelectionAdd,    h.onSelectionAdd);
    eb.on(Events.Tool.SelectionRemove, h.onSelectionRemove);
    eb.on(Events.Tool.SelectionClear,  h.onSelectionClear);

    eb.on(Events.Tool.DragStart,       h.onDragStart);
    eb.on(Events.Tool.DragUpdate,      h.onDragUpdate);
    eb.on(Events.Tool.DragEnd,         h.onDragEnd);

    eb.on(Events.Tool.GroupDragStart,  h.onGroupDragStart);
    eb.on(Events.Tool.GroupDragUpdate, h.onGroupDragUpdate);
    eb.on(Events.Tool.GroupDragEnd,    h.onGroupDragEnd);

    eb.on(Events.Tool.ResizeUpdate,    h.onResizeUpdate);
    eb.on(Events.Tool.RotateUpdate,    h.onRotateUpdate);

    eb.on(Events.UI.ZoomPercent,       h.onZoomPercent);
    eb.on(Events.Tool.PanUpdate,       h.onPanUpdate);

    eb.on(Events.Object.Deleted,       h.onDeleted);
    eb.on(Events.Tool.Activated,       h.onToolActivated);
    eb.on(Events.Object.StateChanged,  h.onStateChanged);
    eb.on(Events.History.Changed,      h.onHistoryChanged);

    inst._eventBridgeAttached = true;
}

export function detachConnectorPropertiesPanelEventBridge(inst) {
    if (!inst._eventBridgeAttached || !inst._eventBridgeHandlers || !inst.eventBus?.off) {
        inst._eventBridgeAttached = false;
        return;
    }

    const h = inst._eventBridgeHandlers;
    const eb = inst.eventBus;

    eb.off(Events.Tool.SelectionAdd,    h.onSelectionAdd);
    eb.off(Events.Tool.SelectionRemove, h.onSelectionRemove);
    eb.off(Events.Tool.SelectionClear,  h.onSelectionClear);

    eb.off(Events.Tool.DragStart,       h.onDragStart);
    eb.off(Events.Tool.DragUpdate,      h.onDragUpdate);
    eb.off(Events.Tool.DragEnd,         h.onDragEnd);

    eb.off(Events.Tool.GroupDragStart,  h.onGroupDragStart);
    eb.off(Events.Tool.GroupDragUpdate, h.onGroupDragUpdate);
    eb.off(Events.Tool.GroupDragEnd,    h.onGroupDragEnd);

    eb.off(Events.Tool.ResizeUpdate,    h.onResizeUpdate);
    eb.off(Events.Tool.RotateUpdate,    h.onRotateUpdate);

    eb.off(Events.UI.ZoomPercent,       h.onZoomPercent);
    eb.off(Events.Tool.PanUpdate,       h.onPanUpdate);

    eb.off(Events.Object.Deleted,       h.onDeleted);
    eb.off(Events.Tool.Activated,       h.onToolActivated);
    eb.off(Events.Object.StateChanged,  h.onStateChanged);
    eb.off(Events.History.Changed,      h.onHistoryChanged);

    inst._eventBridgeHandlers = null;
    inst._eventBridgeAttached = false;
}
