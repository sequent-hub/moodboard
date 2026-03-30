/**
 * Команда смены типа фрейма (type + lockedAspect + размер + позиция) — одно действие в истории.
 */
import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

export class UpdateFrameTypeCommand extends BaseCommand {
    /**
     * @param {Object} coreMoodboard
     * @param {string} objectId
     * @param {string} oldType
     * @param {string} newType
     * @param {{ width: number, height: number }} oldSize
     * @param {{ width: number, height: number }} newSize
     * @param {{ x: number, y: number }} oldPosition
     * @param {{ x: number, y: number }} newPosition
     */
    constructor(coreMoodboard, objectId, oldType, newType, oldSize, newSize, oldPosition, newPosition) {
        super('update_frame_type', `Изменить тип фрейма: ${oldType} → ${newType}`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldType = oldType;
        this.newType = newType;
        this.oldSize = oldSize ? { ...oldSize } : null;
        this.newSize = newSize ? { ...newSize } : null;
        this.oldPosition = oldPosition ? { ...oldPosition } : null;
        this.newPosition = newPosition ? { ...newPosition } : null;
    }

    execute() {
        this._apply(this.newType, this.newSize, this.newPosition);
    }

    undo() {
        // Локальный undo отключен: история состояния загружается с сервера по версиям.
    }

    _apply(typeValue, size, position) {
        const { coreMoodboard, objectId } = this;
        const objects = coreMoodboard.state.getObjects();
        const object = objects.find((obj) => obj.id === objectId);
        if (!object) return;

        if (!object.properties) object.properties = {};
        object.properties.type = typeValue;
        object.properties.lockedAspect = (typeValue !== 'custom');

        if (size) {
            object.width = size.width;
            object.height = size.height;
            coreMoodboard.pixi.updateObjectSize(objectId, size, 'frame');
        }

        if (position) {
            const pixiObject = coreMoodboard.pixi?.objects?.get(objectId);
            if (pixiObject) {
                const halfW = (object.width || 0) / 2;
                const halfH = (object.height || 0) / 2;
                pixiObject.x = position.x + halfW;
                pixiObject.y = position.y + halfH;
            }
            object.position = object.position || { x: 0, y: 0 };
            object.position.x = position.x;
            object.position.y = position.y;
        }

        coreMoodboard.state.markDirty();

        coreMoodboard.eventBus.emit(Events.Object.StateChanged, {
            objectId,
            updates: {
                properties: { type: typeValue, lockedAspect: (typeValue !== 'custom') },
            },
        });

        if (coreMoodboard.eventBus) {
            coreMoodboard.eventBus.emit(Events.Object.TransformUpdated, {
                objectId,
                type: 'resize',
                size: object.width && object.height ? { width: object.width, height: object.height } : null,
                position: object.position,
            });
        }
    }
}
