import { BaseCommand } from './BaseCommand.js';

/**
 * Команда изменения размера объекта
 */
export class ResizeObjectCommand extends BaseCommand {
    constructor(coreMoodboard, objectId, oldSize, newSize) {
        super('resize_object', `Изменить размер объекта`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldSize = { ...oldSize };
        this.newSize = { ...newSize };
        
        // Обновляем описание с размерами
        this.description = `Изменить размер объекта ${Math.round(this.oldSize.width)}×${Math.round(this.oldSize.height)} → ${Math.round(this.newSize.width)}×${Math.round(this.newSize.height)}`;
    }

    execute() {
        // Устанавливаем новый размер
        this._setSize(this.newSize);
    }

    undo() {
        // Возвращаем старый размер
        this._setSize(this.oldSize);
    }

    _setSize(size) {
        // Получаем тип объекта из состояния
        const objects = this.coreMoodboard.state.state.objects;
        const object = objects.find(obj => obj.id === this.objectId);
        const objectType = object ? object.type : null;
        
        console.log(`🔄 ResizeObjectCommand._setSize: объект ${this.objectId}, тип ${objectType}`);
        
        // Обновляем размер в PIXI с указанием типа
        this.coreMoodboard.pixi.updateObjectSize(this.objectId, size, objectType);
        
        // Обновляем размер в состоянии (без эмита события, чтобы не создавать новую команду)
        if (object) {
            object.width = size.width;
            object.height = size.height;
            this.coreMoodboard.state.markDirty();
        }
    }

    /**
     * Можно ли объединить с другой командой изменения размера того же объекта
     */
    canMergeWith(otherCommand) {
        return otherCommand instanceof ResizeObjectCommand && 
               otherCommand.objectId === this.objectId;
    }

    /**
     * Объединить с другой командой изменения размера
     */
    mergeWith(otherCommand) {
        if (!this.canMergeWith(otherCommand)) {
            throw new Error('Cannot merge with this command');
        }
        
        // Обновляем конечный размер
        this.newSize = { ...otherCommand.newSize };
        this.description = `Изменить размер объекта ${Math.round(this.oldSize.width)}×${Math.round(this.oldSize.height)} → ${Math.round(this.newSize.width)}×${Math.round(this.newSize.height)}`;
        this.timestamp = otherCommand.timestamp; // Обновляем время последнего изменения
    }
}
