import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда перемещения объекта
 */
export class MoveObjectCommand extends BaseCommand {
    constructor(coreMoodboard, objectId, oldPosition, newPosition) {
        super('move_object', `Переместить объект`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldPosition = { ...oldPosition };
        this.newPosition = { ...newPosition };
        
        // Обновляем описание с координатами
        this.description = `Переместить объект (${Math.round(this.oldPosition.x)}, ${Math.round(this.oldPosition.y)}) → (${Math.round(this.newPosition.x)}, ${Math.round(this.newPosition.y)})`;
    }

    execute() {
        // Устанавливаем новую позицию
        this._setPosition(this.newPosition);

    }

    undo() {
        // Возвращаем старую позицию
        this._setPosition(this.oldPosition);

    }

    _setPosition(position) {
        // Используем готовую функцию из ядра - она правильно обрабатывает все типы объектов
        // position уже является координатами левого-верхнего угла
        this.coreMoodboard.updateObjectPositionDirect(this.objectId, position);
        
        // Уведомляем о том, что объект был изменен (для обновления ручек)
        if (this.eventBus) {
            this.eventBus.emit(Events.Object.TransformUpdated, {
                objectId: this.objectId,
                type: 'position',
                position: position
            });
        }
    }

    /**
     * Можно ли объединить с другой командой перемещения того же объекта
     */
    canMergeWith(otherCommand) {
        return otherCommand instanceof MoveObjectCommand && 
               otherCommand.objectId === this.objectId;
    }

    /**
     * Объединить с другой командой перемещения
     */
    mergeWith(otherCommand) {
        if (!this.canMergeWith(otherCommand)) {
            throw new Error('Cannot merge with this command');
        }
        
        // Обновляем конечную позицию
        this.newPosition = { ...otherCommand.newPosition };
        this.description = `Переместить объект (${Math.round(this.oldPosition.x)}, ${Math.round(this.newPosition.y)}) → (${Math.round(this.newPosition.x)}, ${Math.round(this.newPosition.y)})`;
        this.timestamp = otherCommand.timestamp; // Обновляем время последнего изменения
        

    }
}
