/**
 * Команда изменения стиля записки (шрифт, размер, цвет текста, фон) для системы Undo/Redo.
 * Поддерживает: fontFamily, fontSize, textColor, backgroundColor (все в object.properties).
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

const NOTE_STYLE_PROPS = ['fontFamily', 'fontSize', 'textColor', 'backgroundColor'];

export class UpdateNoteStyleCommand extends BaseCommand {
    /**
     * @param {Object} coreMoodboard — ядро доски
     * @param {string} objectId — id объекта записки
     * @param {string} property — имя свойства (fontFamily | fontSize | textColor | backgroundColor)
     * @param {*} oldValue — прежнее значение
     * @param {*} newValue — новое значение
     */
    constructor(coreMoodboard, objectId, property, oldValue, newValue) {
        super('update_note_style', `Изменить ${_propertyLabel(property)}`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.property = property;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }

    execute() {
        this._apply(this.newValue);
    }

    undo() {
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
    }

    canMergeWith(otherCommand) {
        return otherCommand instanceof UpdateNoteStyleCommand &&
               otherCommand.objectId === this.objectId &&
               otherCommand.property === this.property;
    }

    mergeWith(otherCommand) {
        if (!this.canMergeWith(otherCommand)) {
            throw new Error('Cannot merge commands');
        }
        this.newValue = otherCommand.newValue;
        this.timestamp = otherCommand.timestamp;
    }

    _apply(value) {
        const { coreMoodboard, objectId, property } = this;
        const objects = coreMoodboard.state.getObjects();
        const object = objects.find((obj) => obj.id === objectId);
        if (!object) return;

        if (!object.properties) object.properties = {};
        object.properties[property] = value;
        coreMoodboard.state.markDirty();

        const pixiObject = coreMoodboard.pixi?.objects?.get(objectId);
        if (pixiObject?._mb?.instance) {
            const instance = pixiObject._mb.instance;
            if (instance.setStyle) {
                const styleUpdates = { [property]: value };
                instance.setStyle(styleUpdates);
            }
        }

        if (pixiObject?._mb) {
            if (!pixiObject._mb.properties) pixiObject._mb.properties = {};
            pixiObject._mb.properties[property] = value;
        }

        coreMoodboard.eventBus.emit(Events.Object.StateChanged, {
            objectId,
            updates: { properties: { [property]: value } },
        });
    }
}

function _propertyLabel(property) {
    const labels = {
        fontFamily: 'шрифт',
        fontSize: 'размер шрифта',
        textColor: 'цвет текста',
        backgroundColor: 'фон',
    };
    return labels[property] || property;
}
