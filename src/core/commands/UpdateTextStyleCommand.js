/**
 * Команда изменения свойств текста для системы Undo/Redo.
 * Поддерживает: fontFamily, fontSize, color, backgroundColor, markdown,
 * bold, italic, underline, strikethrough, textAlign, lineHeight, listType.
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';
import { syncPixiTextProperties } from '../../ui/text-properties/TextPropertiesPanelMapper.js';

const PROPERTY_LEVEL = ['fontFamily', 'markdown', 'bold', 'italic', 'underline', 'strikethrough', 'textAlign', 'lineHeight', 'listType'];

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
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
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

        if (PROPERTY_LEVEL.includes(property)) {
            if (!object.properties) object.properties = {};
            object.properties[property] = value;
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

        const updates = PROPERTY_LEVEL.includes(property)
            ? { properties: { [property]: value } }
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
        markdown: 'markdown-режим',
        bold: 'жирный текст',
        italic: 'курсив',
        underline: 'подчёркивание',
        strikethrough: 'зачёркивание',
        textAlign: 'выравнивание текста',
        lineHeight: 'межстрочный интервал',
        listType: 'тип списка',
    };
    return labels[property] || property;
}
