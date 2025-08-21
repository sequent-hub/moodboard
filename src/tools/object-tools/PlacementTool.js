import { BaseTool } from '../BaseTool.js';
import { Events } from '../../core/events/Events.js';
import * as PIXI from 'pixi.js';

/**
 * Инструмент одноразового размещения объекта по клику на холст
 * Логика: выбираем инструмент/вариант на тулбаре → кликаем на холст → объект создаётся → возврат к Select
 */
export class PlacementTool extends BaseTool {
    constructor(eventBus) {
        super('place', eventBus);
        this.cursor = 'crosshair';
        this.hotkey = null;
        this.app = null;
        this.world = null;
        this.pending = null; // { type, properties }

        if (this.eventBus) {
            this.eventBus.on(Events.Place.Set, (cfg) => {
                this.pending = cfg ? { ...cfg } : null;
            });
            // Сброс pending при явном выборе select-инструмента
            this.eventBus.on(Events.Tool.Activated, ({ tool }) => {
                if (tool === 'select') {
                    this.pending = null;
                }
            });
        }
    }

    activate(app) {
        super.activate();
        this.app = app;
        this.world = this._getWorldLayer();
        // Курсор указывает на размещение (прицел)
        if (this.app && this.app.view) this.app.view.style.cursor = 'crosshair';
    }

    deactivate() {
        super.deactivate();
        if (this.app && this.app.view) this.app.view.style.cursor = '';
        this.app = null;
        this.world = null;
    }

    onMouseDown(event) {
        super.onMouseDown(event);
        if (!this.pending) return;

        const worldPoint = this._toWorld(event.x, event.y);
        const halfW = (this.pending.size?.width ?? 100) / 2;
        const halfH = (this.pending.size?.height ?? 100) / 2;
        const position = { x: Math.round(worldPoint.x - halfW), y: Math.round(worldPoint.y - halfH) };

        const props = this.pending.properties || {};
        const isTextWithEditing = this.pending.type === 'text' && props.editOnCreate;
        const isImage = this.pending.type === 'image';
        const presetSize = {
            width: (this.pending.size && this.pending.size.width) ? this.pending.size.width : 200,
            height: (this.pending.size && this.pending.size.height) ? this.pending.size.height : 150,
        };

        if (isTextWithEditing) {
            // Переключаемся на select, чтобы у него был доступ к PIXI app, затем открываем редактор
            this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
            this.eventBus.emit(Events.Tool.ObjectEdit, {
                object: {
                    id: null,
                    type: 'text',
                    position,
                    properties: { fontSize: props.fontSize || 18, content: '' }
                },
                create: true
            });
        } else if (isImage && props.selectFileOnPlace) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
                try {
                    const file = input.files && input.files[0];
                    if (!file) return;
                    // Читаем как DataURL, чтобы не использовать blob: URL (устраняем ERR_FILE_NOT_FOUND)
                    const reader = new FileReader();
                    reader.onload = () => {
                        const dataUrl = reader.result;
                        const img = new Image();
                        img.onload = () => {
                            const natW = img.naturalWidth || img.width || 1;
                            const natH = img.naturalHeight || img.height || 1;
                            const targetW = 300; // дефолтная ширина
                            const targetH = Math.max(1, Math.round(natH * (targetW / natW)));
                            this.eventBus.emit(Events.UI.ToolbarAction, {
                                type: 'image',
                                id: 'image',
                                position,
                                properties: { src: dataUrl, name: file.name, width: targetW, height: targetH }
                            });
                        };
                        img.src = dataUrl;
                    };
                    reader.readAsDataURL(file);
                } finally {
                    input.remove();
                }
            }, { once: true });
            input.click();
        } else {
            // Обычное размещение через общий канал
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: this.pending.type,
                id: this.pending.type,
                position,
                properties: props
            });
        }

        // Сбрасываем pending и возвращаем стандартное поведение
        this.pending = null;
        if (!isTextWithEditing) {
            this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
        }
    }

    _toWorld(x, y) {
        if (!this.world) return { x, y };
        const global = new PIXI.Point(x, y);
        const local = this.world.toLocal(global);
        return { x: local.x, y: local.y };
    }

    _getWorldLayer() {
        if (!this.app || !this.app.stage) return null;
        const world = this.app.stage.getChildByName && this.app.stage.getChildByName('worldLayer');
        return world || this.app.stage;
    }
}


