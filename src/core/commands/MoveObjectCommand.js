import { BaseCommand } from './BaseCommand.js';

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
        // Обновляем позицию в PIXI
        const pixiObject = this.coreMoodboard.pixi.objects.get(this.objectId);
        if (pixiObject) {
            pixiObject.x = position.x;
            pixiObject.y = position.y;
        }
        
        // Обновляем позицию в состоянии (но БЕЗ эмита события, чтобы не создавать новую команду)
        const objects = this.coreMoodboard.state.state.objects;
        const object = objects.find(obj => obj.id === this.objectId);
        if (object) {
            object.position = { ...position };
            this.coreMoodboard.state.markDirty();
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
