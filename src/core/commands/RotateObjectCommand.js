/**
 * Команда поворота объекта для системы Undo/Redo
 */
import { BaseCommand } from './BaseCommand.js';

export class RotateObjectCommand extends BaseCommand {
    constructor(objectId, oldAngle, newAngle) {
        super();
        this.objectId = objectId;
        this.oldAngle = oldAngle;
        this.newAngle = newAngle;
    }

    execute() {
        // Применяем новый угол поворота
        this.emit('object:rotate', {
            objectId: this.objectId,
            angle: this.newAngle
        });
        console.log(`🔄 Поворачиваем объект ${this.objectId} на ${this.newAngle}°`);
    }

    undo() {
        // Возвращаем старый угол поворота
        this.emit('object:rotate', {
            objectId: this.objectId,
            angle: this.oldAngle
        });
        console.log(`↩️ Отменяем поворот объекта ${this.objectId}, возвращаем ${this.oldAngle}°`);
    }

    getDescription() {
        const delta = this.newAngle - this.oldAngle;
        return `Поворот объекта на ${delta.toFixed(1)}°`;
    }
}
