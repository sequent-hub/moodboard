import { Events } from '../events/Events.js';

export class KeyboardToolSwitching {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }

    createHandler(actionId) {
        switch (actionId) {
            case 'tool-select':
                return () => {
                    this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                };
            case 'tool-text':
                return () => {
                    this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'text' });
                };
            case 'tool-frame':
                return () => {
                    this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'frame' });
                };
            default:
                return null;
        }
    }
}
