import { Events } from '../events/Events.js';

export class KeyboardSelectionActions {
    constructor(eventBus, isTextEditorActive) {
        this.eventBus = eventBus;
        this.isTextEditorActive = isTextEditorActive;
    }

    createHandler(actionId) {
        switch (actionId) {
            case 'undo':
                return () => {
                    this.eventBus.emit(Events.Keyboard.Undo);
                };
            case 'redo':
                return () => {
                    this.eventBus.emit(Events.Keyboard.Redo);
                };
            case 'select-all':
                return () => {
                    this.eventBus.emit(Events.Keyboard.SelectAll);
                };
            case 'copy':
                return () => {
                    this.eventBus.emit(Events.Keyboard.Copy);
                };
            case 'paste':
                return () => {
                    this.eventBus.emit(Events.Keyboard.Paste);
                };
            case 'layer-bring-to-front':
                return () => {
                    const data = { selection: [] };
                    this.eventBus.emit(Events.Tool.GetSelection, data);
                    const id = data.selection?.[0];
                    if (id) this.eventBus.emit(Events.UI.LayerBringToFront, { objectId: id });
                };
            case 'layer-bring-forward':
                return () => {
                    const data = { selection: [] };
                    this.eventBus.emit(Events.Tool.GetSelection, data);
                    const id = data.selection?.[0];
                    if (id) this.eventBus.emit(Events.UI.LayerBringForward, { objectId: id });
                };
            case 'layer-send-to-back':
                return () => {
                    const data = { selection: [] };
                    this.eventBus.emit(Events.Tool.GetSelection, data);
                    const id = data.selection?.[0];
                    if (id) this.eventBus.emit(Events.UI.LayerSendToBack, { objectId: id });
                };
            case 'layer-send-backward':
                return () => {
                    const data = { selection: [] };
                    this.eventBus.emit(Events.Tool.GetSelection, data);
                    const id = data.selection?.[0];
                    if (id) this.eventBus.emit(Events.UI.LayerSendBackward, { objectId: id });
                };
            case 'delete':
                return () => {
                    if (this.isTextEditorActive()) {
                        console.log('🔒 KeyboardManager: Текстовый редактор активен, пропускаем удаление объектов');
                        return;
                    }
                    this.eventBus.emit(Events.Keyboard.Delete);
                };
            case 'escape':
                return () => {
                    this.eventBus.emit(Events.Keyboard.Escape);
                };
            case 'move-up':
                return (event) => {
                    this.eventBus.emit(Events.Keyboard.Move, {
                        direction: 'up',
                        step: event.shiftKey ? 10 : 1
                    });
                };
            case 'move-down':
                return (event) => {
                    this.eventBus.emit(Events.Keyboard.Move, {
                        direction: 'down',
                        step: event.shiftKey ? 10 : 1
                    });
                };
            case 'move-left':
                return (event) => {
                    this.eventBus.emit(Events.Keyboard.Move, {
                        direction: 'left',
                        step: event.shiftKey ? 10 : 1
                    });
                };
            case 'move-right':
                return (event) => {
                    this.eventBus.emit(Events.Keyboard.Move, {
                        direction: 'right',
                        step: event.shiftKey ? 10 : 1
                    });
                };
            default:
                return null;
        }
    }
}
