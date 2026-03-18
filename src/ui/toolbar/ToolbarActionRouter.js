import { Events } from '../../core/events/Events.js';

export class ToolbarActionRouter {
    constructor(toolbar) {
        this.toolbar = toolbar;
    }

    routeToolbarAction(button, toolType, toolId) {
        if (toolType === 'undo') {
            this.toolbar.eventBus.emit(Events.Keyboard.Undo);
            this.toolbar.animateButton(button);
            return true;
        }

        if (toolType === 'redo') {
            this.toolbar.eventBus.emit(Events.Keyboard.Redo);
            this.toolbar.animateButton(button);
            return true;
        }

        if (toolType === 'activate-select') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Place.Set, null);
            this.toolbar.placeSelectedButtonId = null;
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
            this.toolbar.setActiveToolbarButton('select');
            return true;
        }

        if (toolType === 'activate-pan') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'pan' });
            this.toolbar.setActiveToolbarButton('pan');
            return true;
        }

        if (toolType === 'text-add') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'text';
            this.toolbar.setActiveToolbarButton('place');
            this.toolbar.eventBus.emit(Events.Place.Set, {
                type: 'text',
                properties: { editOnCreate: true, fontSize: 18 }
            });
            return true;
        }

        if (toolType === 'note-add') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'note';
            this.toolbar.setActiveToolbarButton('place');
            this.toolbar.eventBus.emit(Events.Place.Set, {
                type: 'note',
                properties: {
                    content: 'Новая записка',
                    fontFamily: 'Caveat, Arial, cursive',
                    fontSize: 32,
                    width: 250,
                    height: 250
                }
            });
            return true;
        }

        if (toolType === 'mindmap-add') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'mindmap';
            this.toolbar.setActiveToolbarButton('place');
            this.toolbar.eventBus.emit(Events.Place.Set, {
                type: 'mindmap',
                size: { width: 220, height: 140 },
                properties: {
                    fontSize: 20,
                    width: 220,
                    height: 140,
                    strokeColor: 0x2563EB,
                    fillColor: 0x3B82F6,
                    fillAlpha: 0.25,
                    strokeWidth: 2
                }
            });
            return true;
        }

        if (toolType === 'frame') {
            this.toolbar.animateButton(button);
            this.toolbar.toggleFramePopup(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'frame';
            this.toolbar.setActiveToolbarButton('place');
            // Сразу включаем произвольный фрейм; в popup можно выбрать A4, 1:1 и т.д.
            this.toolbar.eventBus.emit(Events.Place.Set, { type: 'frame-draw', properties: {} });
            return true;
        }

        if (toolType === 'image-add') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.openImageDialog();
            return true;
        }

        if (toolType === 'image2-add') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.openImageObject2Dialog();
            return true;
        }

        if (toolType === 'custom-comments') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'comments';
            this.toolbar.setActiveToolbarButton('place');
            this.toolbar.eventBus.emit(Events.Place.Set, { type: 'comment', properties: { width: 72, height: 72 } });
            return true;
        }

        if (toolType === 'custom-attachments') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.openFileDialog();
            return true;
        }

        if (toolType === 'custom-frame') {
            this.toolbar.animateButton(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'frame-tool';
            this.toolbar.setActiveToolbarButton('place');
            this.toolbar.eventBus.emit(Events.Place.Set, {
                type: 'frame',
                properties: { width: 200, height: 300 }
            });
            return true;
        }

        if (toolType === 'custom-shapes') {
            this.toolbar.animateButton(button);
            this.toolbar.toggleShapesPopup(button);
            this.toolbar.closeDrawPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'shapes';
            this.toolbar.setActiveToolbarButton('place');
            return true;
        }

        if (toolType === 'custom-draw') {
            this.toolbar.animateButton(button);
            this.toolbar.toggleDrawPopup(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeEmojiPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'draw' });
            this.toolbar.setActiveToolbarButton('draw');
            return true;
        }

        if (toolType === 'custom-emoji') {
            this.toolbar.animateButton(button);
            this.toolbar.toggleEmojiPopup(button);
            this.toolbar.closeShapesPopup();
            this.toolbar.closeDrawPopup();
            this.toolbar.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'place' });
            this.toolbar.placeSelectedButtonId = 'emoji';
            this.toolbar.setActiveToolbarButton('place');
            return true;
        }

        if (toolType === 'clear') {
            this.toolbar.animateButton(button);
            this.toolbar.showClearConfirmation();
            return true;
        }

        this.toolbar.eventBus.emit(Events.UI.ToolbarAction, {
            type: toolType,
            id: toolId,
            position: this.toolbar.getRandomPosition()
        });
        this.toolbar.animateButton(button);
        return true;
    }
}
