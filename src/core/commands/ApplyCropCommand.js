import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';
import { applyCropToSprite } from '../../utils/applyCrop.js';

/**
 * Команда применения / отмены кадрирования изображения.
 *
 * before / after = {
 *   cropRect:         { x, y, w, h } | null  — нормализованные 0..1 от оригинала
 *   cropShape:        'circle' | 'rect' | null
 *   position:         { x, y }                — world top-left
 *   size:             { width, height }        — world display size
 *   originalPosition: { x, y } | null         — до первого кропа
 *   originalSize:     { width, height } | null
 *   borderRadius:     number
 * }
 */
export class ApplyCropCommand extends BaseCommand {
    constructor(core, objectId, before, after) {
        super('apply_crop', 'Обрезать изображение');
        this.core = core;
        this.objectId = objectId;
        this.before = before;
        this.after = after;
    }

    async execute() {
        this._apply(this.after);
    }

    async undo() {
        this._apply(this.before);
    }

    _apply(state) {
        const objects = this.core.state.getObjects();
        const obj = objects.find(o => o.id === this.objectId);
        if (!obj) return;

        if (!obj.properties) obj.properties = {};

        // Кроп-метаданные
        if (state.cropRect) {
            obj.properties.cropRect = { ...state.cropRect };
        } else {
            delete obj.properties.cropRect;
        }
        obj.properties.cropShape = state.cropShape || null;

        // Хранение оригинальных размеров (для "Original")
        if (state.originalPosition && state.originalSize) {
            obj.properties.originalPosition = { ...state.originalPosition };
            obj.properties.originalSize = { ...state.originalSize };
        } else {
            delete obj.properties.originalPosition;
            delete obj.properties.originalSize;
        }

        // Позиция и размер объекта
        if (state.position) {
            obj.position = { ...state.position };
        }
        if (state.size) {
            obj.width = state.size.width;
            obj.height = state.size.height;
            obj.properties.width = state.size.width;
            obj.properties.height = state.size.height;
        }

        this.core.state.markDirty();

        // PIXI-визуал
        const sprite = this.core?.pixi?.objects?.get(this.objectId);
        if (sprite) {
            applyCropToSprite(
                sprite,
                state.cropRect || null,
                state.cropShape || null,
                state.size,
                state.position,
                state.borderRadius || 0
            );
        }

        // Уведомить систему ручек об изменении трансформации
        if (this.core?.eventBus) {
            this.core.eventBus.emit(Events.Object.TransformUpdated, { objectId: this.objectId });
        }
    }
}
