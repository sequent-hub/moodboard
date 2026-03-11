/**
 * Команда изменения свойств фрейма (название, фон, тип, lockedAspect) для системы Undo/Redo.
 * Поддерживает: title, backgroundColor, type, lockedAspect.
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

const FRAME_PROP_LABELS = {
    title: 'название',
    backgroundColor: 'фон',
    type: 'тип',
    lockedAspect: 'фиксация пропорций',
};

export class UpdateFramePropertiesCommand extends BaseCommand {
    /**
     * @param {Object} coreMoodboard — ядро доски
     * @param {string} objectId — id объекта фрейма
     * @param {string} property — имя свойства (title | backgroundColor | type | lockedAspect)
     * @param {*} oldValue — прежнее значение
     * @param {*} newValue — новое значение
     */
    constructor(coreMoodboard, objectId, property, oldValue, newValue) {
        super('update_frame_properties', `Изменить ${FRAME_PROP_LABELS[property] || property}`);
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
        return otherCommand instanceof UpdateFramePropertiesCommand &&
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

        if (property === 'backgroundColor') {
            object.backgroundColor = value;
        } else {
            if (!object.properties) object.properties = {};
            object.properties[property] = value;
            if (property === 'type') {
                object.properties.lockedAspect = (value !== 'custom');
            }
        }

        coreMoodboard.state.markDirty();

        const pixiObject = coreMoodboard.pixi?.objects?.get(objectId);
        if (pixiObject?._mb?.instance) {
            const instance = pixiObject._mb.instance;
            if (property === 'title' && instance.setTitle) {
                instance.setTitle(value);
            }
            if (property === 'backgroundColor' && instance.setBackgroundColor) {
                instance.setBackgroundColor(value);
            }
        }

        let updates;
        if (property === 'backgroundColor') {
            updates = { backgroundColor: value };
        } else {
            updates = { properties: { [property]: value } };
            if (property === 'type') {
                updates.properties.lockedAspect = (value !== 'custom');
            }
        }

        coreMoodboard.eventBus.emit(Events.Object.StateChanged, {
            objectId,
            updates,
        });
    }
}
