import { Events } from '../../core/events/Events.js';

export class ToolbarRenderer {
    constructor(toolbar) {
        this.toolbar = toolbar;
    }

    createToolbar() {
        this.toolbar.element = document.createElement('div');
        this.toolbar.element.className = `moodboard-toolbar moodboard-toolbar--${this.toolbar.theme}`;

        const newTools = [
            { id: 'select', iconName: 'select', title: 'Инструмент выделения (V)', type: 'activate-select' },
            { id: 'pan', iconName: 'pan', title: 'Панорамирование (Пробел)', type: 'activate-pan' },
            { id: 'divider', type: 'divider' },
            { id: 'text-add', iconName: 'text-add', title: 'Добавить текст', type: 'text-add' },
            { id: 'note', iconName: 'note', title: 'Добавить записку', type: 'note-add' },
            { id: 'image', iconName: 'image', title: 'Добавить картинку', type: 'image-add' },
            // { id: 'image2', iconName: 'image', title: 'Добавить картинку', type: 'image2-add' },
            { id: 'shapes', iconName: 'shapes', title: 'Фигуры', type: 'custom-shapes' },
            { id: 'pencil', iconName: 'pencil', title: 'Рисование', type: 'custom-draw' },
            { id: 'attachments', iconName: 'attachments', title: 'Файлы', type: 'custom-attachments' },
            { id: 'emoji', iconName: 'emoji', title: 'Эмоджи', type: 'custom-emoji' }
        ];

        const existingTools = [
            { id: 'frame', iconName: 'frame', title: 'Добавить фрейм', type: 'frame' },
            { id: 'mindmap', iconName: 'mindmap', title: 'Схема', type: 'mindmap-add' },
            { id: 'divider', type: 'divider' },
            { id: 'undo', iconName: 'undo', title: 'Отменить (Ctrl+Z)', type: 'undo', disabled: true },
            { id: 'redo', iconName: 'redo', title: 'Повторить (Ctrl+Y)', type: 'redo', disabled: true }
        ];

        [...newTools, ...existingTools].forEach((tool) => {
            if (tool.type === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'moodboard-toolbar__divider';
                this.toolbar.element.appendChild(divider);
            } else {
                const button = this.createButton(tool);
                this.toolbar.element.appendChild(button);
            }
        });

        this.toolbar.container.appendChild(this.toolbar.element);
        this.toolbar.createShapesPopup();
        this.toolbar.createDrawPopup();
        this.toolbar.createEmojiPopup();
        this.toolbar.createFramePopup();

        this.toolbar.eventBus.on(Events.Tool.Activated, this.toolbar._toolActivatedHandler);

        this.toolbar.currentDrawTool = 'pencil';
    }

    createButton(tool) {
        const button = document.createElement('button');
        button.className = `moodboard-toolbar__button moodboard-toolbar__button--${tool.id}`;
        button.dataset.tool = tool.type;
        button.dataset.toolId = tool.id;

        if (tool.disabled) {
            button.disabled = true;
            button.classList.add('moodboard-toolbar__button--disabled');
        }

        if (tool.title) {
            this.toolbar.createTooltip(button, tool.title);
        }

        if (tool.iconName) {
            this.createSvgIcon(button, tool.iconName);
        }

        return button;
    }

    createSvgIcon(button, iconName) {
        if (this.toolbar.icons[iconName]) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.toolbar.icons[iconName];
            const svg = tempDiv.querySelector('svg');

            if (svg) {
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.style.display = 'block';
                button.appendChild(svg);
            }
        } else {
            const fallbackIcon = document.createElement('span');
            fallbackIcon.textContent = iconName.charAt(0).toUpperCase();
            fallbackIcon.style.fontSize = '14px';
            fallbackIcon.style.fontWeight = 'bold';
            button.appendChild(fallbackIcon);
        }
    }
}
