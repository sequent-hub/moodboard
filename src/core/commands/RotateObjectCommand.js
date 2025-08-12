/**
 * Команда поворота объекта для системы Undo/Redo
 */
import { BaseCommand } from './BaseCommand.js';

export class RotateObjectCommand extends BaseCommand {
    constructor(coreMoodboard, objectId, oldAngle, newAngle) {
        super();
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldAngle = oldAngle;
        this.newAngle = newAngle;
    }

    execute() {
        // Обновляем угол поворота в состоянии
        this._setRotation(this.newAngle);
        
        // Применяем новый угол поворота
        this.emit('object:rotate', {
            objectId: this.objectId,
            angle: this.newAngle
        });
        console.log(`🔄 Поворачиваем объект ${this.objectId} на ${this.newAngle}°`);
    }

    undo() {
        // Обновляем угол поворота в состоянии
        this._setRotation(this.oldAngle);
        
        // Возвращаем старый угол поворота
        this.emit('object:rotate', {
            objectId: this.objectId,
            angle: this.oldAngle
        });
        console.log(`↩️ Отменяем поворот объекта ${this.objectId}, возвращаем ${this.oldAngle}°`);
    }

    /**
     * Обновляет угол поворота объекта в состоянии
     * @private
     */
    _setRotation(angle) {
        // Обновляем угол поворота в состоянии объекта
        const objects = this.coreMoodboard.state.state.objects;
        const object = objects.find(obj => obj.id === this.objectId);
        if (object) {
            if (!object.transform) {
                object.transform = {};
            }
            object.transform.rotation = angle;
            this.coreMoodboard.state.markDirty();
        }
        
        // Уведомляем о том, что объект был изменен (для обновления ручек)
        if (this.eventBus) {
            this.eventBus.emit('object:transform:updated', {
                objectId: this.objectId,
                type: 'rotation',
                rotation: angle
            });
        }
    }

    getDescription() {
        const delta = this.newAngle - this.oldAngle;
        return `Поворот объекта на ${delta.toFixed(1)}°`;
    }
}
