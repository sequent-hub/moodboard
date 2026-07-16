/**
 * Команда изменения стиля фигуры (цвет заливки, тип, обводка, радиус скругления) — одно действие в истории.
 * Поддерживает частичные обновления: хранит только те поля, которые изменились.
 *
 * Снапшот: { color?, properties?: { kind?, cornerRadius?, borderColor?, borderWidth?, borderStyle?, borderOpacity?, fillOpacity? } }
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

export class UpdateShapeStyleCommand extends BaseCommand {
    /**
     * @param {Object} coreMoodboard — ядро доски
     * @param {string} objectId — id объекта-фигуры
     * @param {Object} oldSnapshot — прежние значения (только изменяемые поля)
     * @param {Object} newSnapshot — новые значения (только изменяемые поля)
     */
    constructor(coreMoodboard, objectId, oldSnapshot, newSnapshot) {
        super('update_shape_style', 'Изменить стиль фигуры');
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldSnapshot = oldSnapshot;
        this.newSnapshot = newSnapshot;
    }

    execute() {
        this._apply(this.newSnapshot);
    }

    undo() {
        // Локальный undo отключён: история состояния загружается с сервера по версиям.
    }

    canMergeWith(other) {
        return other instanceof UpdateShapeStyleCommand &&
            other.objectId === this.objectId &&
            _snapshotKeysMatch(this.newSnapshot, other.newSnapshot);
    }

    mergeWith(other) {
        if (!this.canMergeWith(other)) throw new Error('Cannot merge commands');
        this.newSnapshot = other.newSnapshot;
        this.timestamp = other.timestamp;
    }

    _apply(snapshot) {
        const { coreMoodboard, objectId } = this;
        const object = coreMoodboard.state.getObjects().find(o => o.id === objectId);
        if (!object) return;

        // Обновить состояние
        if ('color' in snapshot) {
            object.color = snapshot.color;
        }
        if (snapshot.properties) {
            if (!object.properties) object.properties = {};
            Object.assign(object.properties, snapshot.properties);
        }
        coreMoodboard.state.markDirty();

        // Обновить PIXI-инстанс
        const pixiObject = coreMoodboard.pixi?.objects?.get(objectId);
        const instance = pixiObject?._mb?.instance;

        if (instance) {
            if ('color' in snapshot && instance.setColor) {
                instance.setColor(snapshot.color);
            }
            if (snapshot.properties) {
                const p = snapshot.properties;

                // kind, cornerRadius, fillOpacity — через setProperties (borderStyle идёт только в setStroke)
                if ((p.kind !== undefined || p.cornerRadius !== undefined || p.fillOpacity !== undefined) && instance.setProperties) {
                    instance.setProperties({ kind: p.kind, cornerRadius: p.cornerRadius, fillOpacity: p.fillOpacity });
                }

                // Параметры обводки (borderStyle здесь тоже)
                const hasStroke = p.borderColor !== undefined || p.borderWidth !== undefined ||
                    p.borderStyle !== undefined || p.borderOpacity !== undefined;
                if (hasStroke && instance.setStroke) {
                    instance.setStroke({
                        borderColor: p.borderColor,
                        borderWidth: p.borderWidth,
                        borderStyle: p.borderStyle,
                        borderOpacity: p.borderOpacity,
                    });
                }
            }
        }

        // Синхронизировать _mb.properties с новым состоянием
        if (pixiObject?._mb) {
            if (!pixiObject._mb.properties) pixiObject._mb.properties = {};
            if ('color' in snapshot) pixiObject._mb.color = snapshot.color;
            if (snapshot.properties) Object.assign(pixiObject._mb.properties, snapshot.properties);
        }

        // Уведомить остальных подписчиков (с флагом чтобы избежать рекурсии в tryCreateShapeStyleCommand)
        const updates = {};
        if ('color' in snapshot) updates.color = snapshot.color;
        if (snapshot.properties) updates.properties = { ...snapshot.properties };

        coreMoodboard.eventBus.emit(Events.Object.StateChanged, {
            objectId,
            updates,
            _fromCommand: true,
        });
    }
}

/**
 * Проверяет, что два снапшота содержат одинаковый набор ключей — для слияния команд.
 */
function _snapshotKeysMatch(a, b) {
    const topA = Object.keys(a).sort().join(',');
    const topB = Object.keys(b).sort().join(',');
    if (topA !== topB) return false;
    if (a.properties && b.properties) {
        return Object.keys(a.properties).sort().join(',') === Object.keys(b.properties).sort().join(',');
    }
    return !(a.properties || b.properties);
}
