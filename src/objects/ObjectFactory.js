import { FrameObject } from './FrameObject.js';
import { ShapeObject } from './ShapeObject.js';
import { DrawingObject } from './DrawingObject.js';
import { TextObject } from './TextObject.js';
import { EmojiObject } from './EmojiObject.js';
import { ImageObject } from './ImageObject.js';
import { CommentObject } from './CommentObject.js';
import { NoteObject } from './NoteObject.js';
import { FileObject } from './FileObject.js';

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
        ['emoji', EmojiObject],
        ['image', ImageObject],
        ['comment', CommentObject],
        ['note', NoteObject],
        ['file', FileObject]
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
     * @param {Object} eventBus EventBus для объектов, которым он нужен
     * @returns {any|null}
     */
    static create(type, objectData = {}, eventBus = null) {
        const Ctor = this.registry.get(type);
        if (!Ctor) return null;
        try {
            // Если тип объекта - фрейм, передаем eventBus
            if (type === 'frame' && eventBus) {
                return new Ctor(objectData, eventBus);
            }
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


