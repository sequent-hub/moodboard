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
        // Обновляем позицию в PIXI (x/y — центр), position — левый-верх
        const pixiObject = this.coreMoodboard.pixi.objects.get(this.objectId);
        if (pixiObject) {
            const halfW = (pixiObject.width || 0) / 2;
            const halfH = (pixiObject.height || 0) / 2;
            pixiObject.x = position.x + halfW;
            pixiObject.y = position.y + halfH;
        }
        
        // Обновляем позицию в состоянии (левый-верх; без эмита события)
        const objects = this.coreMoodboard.state.state.objects;
        const object = objects.find(obj => obj.id === this.objectId);
        if (object) {
            object.position = { ...position };
            
            // Помечаем, что координаты уже скомпенсированы для pivot
            if (!object.transform) {
                object.transform = {};
            }
            object.transform.pivotCompensated = true;
            
            this.coreMoodboard.state.markDirty();
        }
        
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
        this.description = `Переместить объект (${Math.round(this.oldPosition.x)}, ${Math.round(this.oldPosition.y)}) → (${Math.round(this.newPosition.x)}, ${Math.round(this.newPosition.y)})`;
        this.timestamp = otherCommand.timestamp; // Обновляем время последнего изменения
        

    }
}
