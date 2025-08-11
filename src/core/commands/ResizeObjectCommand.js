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
        // Обновляем размер в PIXI
        const pixiObject = this.coreMoodboard.pixi.objects.get(this.objectId);
        if (pixiObject) {
            // Для Graphics объектов нужно пересоздать геометрию
            if (pixiObject.clear && pixiObject.drawRect) {
                this.coreMoodboard.pixi.updateObjectSize(this.objectId, size);
            } else if (pixiObject.style) {
                // Для Text объектов
                pixiObject.style.fontSize = Math.max(12, size.height / 3);
            }
        }
        
        // Обновляем размер в состоянии (без эмита события, чтобы не создавать новую команду)
        const objects = this.coreMoodboard.state.state.objects;
        const object = objects.find(obj => obj.id === this.objectId);
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
