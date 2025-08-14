import { BaseTool } from '../BaseTool.js';
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
            this.eventBus.on('place:set', (cfg) => {
                this.pending = cfg ? { ...cfg } : null;
            });
            // Сброс pending при явном выборе select-инструмента
            this.eventBus.on('tool:activated', ({ tool }) => {
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
        // Центр к курсору: смещаем на половину дефолтного размера (100x100)
        const halfW = (this.pending.size?.width ?? 100) / 2;
        const halfH = (this.pending.size?.height ?? 100) / 2;
        const position = { x: Math.round(worldPoint.x - halfW), y: Math.round(worldPoint.y - halfH) };
        // Создаём объект через общий канал (важно: без префикса tool:)
        this.eventBus.emit('toolbar:action', {
            type: this.pending.type,
            id: this.pending.type,
            position,
            properties: this.pending.properties || {}
        });

        // Сброс и возврат к select
        this.pending = null;
        this.eventBus.emit('keyboard:tool-select', { tool: 'select' });
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


