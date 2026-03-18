import { Events } from '../../core/events/Events.js';

export class ToolbarStateController {
    constructor(toolbar) {
        this.toolbar = toolbar;
    }

    setActiveToolbarButton(toolName) {
        if (!this.toolbar.element) return;

        this.toolbar.element.querySelectorAll('.moodboard-toolbar__button--active').forEach((el) => {
            el.classList.remove('moodboard-toolbar__button--active');
        });

        const map = {
            select: 'select',
            pan: 'pan',
            draw: 'pencil',
            text: 'text-add'
        };

        let btnId = map[toolName];

        if (!btnId && toolName === 'place') {
            const placeButtonMap = {
                text: 'text-add',
                note: 'note',
                frame: 'frame',
                'frame-tool': 'frame',
                comments: 'comments',
                attachments: 'attachments',
                shapes: 'shapes',
                emoji: 'emoji',
                mindmap: 'mindmap',
                null: 'image'
            };
            btnId = placeButtonMap[this.toolbar.placeSelectedButtonId] || 'shapes';
        }

        if (!btnId) return;

        const btn = this.toolbar.element.querySelector(`.moodboard-toolbar__button--${btnId}`);
        if (btn) {
            btn.classList.add('moodboard-toolbar__button--active');
        }
    }

    setupHistoryEvents() {
        this.toolbar.eventBus.on(Events.UI.UpdateHistoryButtons, (data) => {
            this.updateHistoryButtons(data.canUndo, data.canRedo);
        });
    }

    updateHistoryButtons(canUndo, canRedo) {
        const undoButton = this.toolbar.element.querySelector('[data-tool="undo"]');
        const redoButton = this.toolbar.element.querySelector('[data-tool="redo"]');

        if (undoButton) {
            undoButton.disabled = !canUndo;
            if (canUndo) {
                undoButton.classList.remove('moodboard-toolbar__button--disabled');
                undoButton.title = 'Отменить последнее действие (Ctrl+Z)';
            } else {
                undoButton.classList.add('moodboard-toolbar__button--disabled');
                undoButton.title = 'Нет действий для отмены';
            }
        }

        if (redoButton) {
            redoButton.disabled = !canRedo;
            if (canRedo) {
                redoButton.classList.remove('moodboard-toolbar__button--disabled');
                redoButton.title = 'Повторить отмененное действие (Ctrl+Y)';
            } else {
                redoButton.classList.add('moodboard-toolbar__button--disabled');
                redoButton.title = 'Нет действий для повтора';
            }
        }
    }
}
