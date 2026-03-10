/**
 * Команда изменения свойств текста (шрифт, размер, цвет, фон) для системы Undo/Redo.
 * Поддерживает: fontFamily, fontSize, color, backgroundColor.
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';
import { syncPixiTextProperties } from '../../ui/text-properties/TextPropertiesPanelMapper.js';

export class UpdateTextStyleCommand extends BaseCommand {
    /**
     * @param {Object} coreMoodboard — ядро доски
     * @param {string} objectId — id объекта
     * @param {string} property — имя свойства (fontFamily | fontSize | color | backgroundColor)
     * @param {*} oldValue — прежнее значение
     * @param {*} newValue — новое значение
     */
    constructor(coreMoodboard, objectId, property, oldValue, newValue) {
        super('update_text_style', `Изменить ${_propertyLabel(property)}`);
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
        this._apply(this.oldValue);
    }

    canMergeWith(otherCommand) {
        return otherCommand instanceof UpdateTextStyleCommand &&
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
        const objects = this.coreMoodboard.state.getObjects();
        const object = objects.find((obj) => obj.id === this.objectId);
        if (!object) return;

        const { property } = this;

        if (property === 'fontFamily') {
            if (!object.properties) object.properties = {};
            object.properties.fontFamily = value;
        } else {
            object[property] = value;
        }

        this.coreMoodboard.state.markDirty();

        const pixiObject = this.coreMoodboard.pixi?.objects?.get(this.objectId);
        if (pixiObject && pixiObject._mb) {
            if (!pixiObject._mb.properties) pixiObject._mb.properties = {};
            pixiObject._mb.properties[property] = value;
        }

        syncPixiTextProperties(this.coreMoodboard.eventBus, this.objectId, { [property]: value });

        const updates = property === 'fontFamily'
            ? { properties: { fontFamily: value } }
            : { [property]: value };
        this.coreMoodboard.eventBus.emit(Events.Object.StateChanged, {
            objectId: this.objectId,
            updates,
        });
    }
}

function _propertyLabel(property) {
    const labels = {
        fontFamily: 'шрифт',
        fontSize: 'размер шрифта',
        color: 'цвет текста',
        backgroundColor: 'фон текста',
    };
    return labels[property] || property;
}
