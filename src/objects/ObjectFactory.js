import { FrameObject } from './FrameObject.js';
import { ShapeObject } from './ShapeObject.js';
import { DrawingObject } from './DrawingObject.js';
import { TextObject } from './TextObject.js';
import { EmojiObject } from './EmojiObject.js';

/**
 * Фабрика объектов холста
 * Назначение: централизованно создавать инстансы по типу объекта
 */
export class ObjectFactory {
    static registry = new Map([
        ['frame', FrameObject],
        ['shape', ShapeObject],
        ['drawing', DrawingObject],
        ['text', TextObject],
        ['simple-text', TextObject],
        ['emoji', EmojiObject]
    ]);

    /**
     * Зарегистрировать новый тип объекта
     * @param {string} type
     * @param {class} clazz
     */
    static register(type, clazz) {
        if (!type || !clazz) return;
        this.registry.set(type, clazz);
    }

    /**
     * Создать инстанс объекта по типу
     * @param {string} type
     * @param {Object} objectData
     * @returns {any|null}
     */
    static create(type, objectData = {}) {
        const Ctor = this.registry.get(type);
        if (!Ctor) return null;
        try {
            return new Ctor(objectData);
        } catch (e) {
            console.error(`ObjectFactory: failed to create instance for type "${type}"`, e);
            return null;
        }
    }

    static has(type) {
        return this.registry.has(type);
    }
}


