import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда изменения размера объекта
 */
export class ResizeObjectCommand extends BaseCommand {
    constructor(coreMoodboard, objectId, oldSize, newSize, oldPosition = null, newPosition = null) {
        super('resize_object', `Изменить размер объекта`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldSize = { ...oldSize };
        this.newSize = { ...newSize };
        this.oldPosition = oldPosition ? { ...oldPosition } : null;
        this.newPosition = newPosition ? { ...newPosition } : null;
        
        // Обновляем описание с размерами
        this.description = `Изменить размер объекта ${Math.round(this.oldSize.width)}×${Math.round(this.oldSize.height)} → ${Math.round(this.newSize.width)}×${Math.round(this.newSize.height)}`;
    }

    execute() {
        // Устанавливаем новый размер и позицию
        this._setSizeAndPosition(this.newSize, this.newPosition);
        this._updateResizeHandles();
    }

    undo() {
        // Возвращаем старый размер и позицию
        this._setSizeAndPosition(this.oldSize, this.oldPosition);
        this._updateResizeHandles();
    }

    _setSizeAndPosition(size, position = null) {
        // Получаем тип объекта из состояния
        const objects = this.coreMoodboard.state.state.objects;
        const object = objects.find(obj => obj.id === this.objectId);
        const objectType = object ? object.type : null;
        

        
        
        // Обновляем размер в PIXI с указанием типа
        this.coreMoodboard.pixi.updateObjectSize(this.objectId, size, objectType);

        // Обновляем позицию если передана (позиция в state — левый-верх; в PIXI — центр)
        // ВАЖНО: используем НОВЫЙ размер для правильного вычисления центра!
        if (position && object) {
            const pixiObject = this.coreMoodboard.pixi.objects.get(this.objectId);
            if (pixiObject) {
                const halfW = size.width / 2;
                const halfH = size.height / 2;
                pixiObject.x = position.x + halfW;
                pixiObject.y = position.y + halfH;
                object.position.x = position.x;
                object.position.y = position.y;
                

            }
        }
        
        // Обновляем размер в состоянии (без эмита события, чтобы не создавать новую команду)
        if (object) {
            object.width = size.width;
            object.height = size.height;
            this.coreMoodboard.state.markDirty();
        }
        
        // Уведомляем о том, что объект был изменен (для обновления ручек)
        if (this.eventBus) {
            this.eventBus.emit(Events.Object.TransformUpdated, {
                objectId: this.objectId,
                type: 'resize',
                size: size,
                position: position
            });
        } else {
            console.warn(`❌ ResizeObjectCommand: eventBus не установлен для ${this.objectId}`);
        }
    }

    /**
     * Обновляет ручки изменения размера после операции
     */
    _updateResizeHandles() {
        // Проверяем, есть ли активный SelectTool и выделен ли этот объект
        const toolManager = this.coreMoodboard.toolManager;
        if (!toolManager) return;
        
        const activeTool = toolManager.getActiveTool();
        if (!activeTool || activeTool.name !== 'select') return;
        
        // Если этот объект выделен, обновляем ручки
        if (activeTool.selectedObjects && activeTool.selectedObjects.has(this.objectId)) {
            activeTool.updateResizeHandles();
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
        
        // Обновляем конечный размер и позицию
        this.newSize = { ...otherCommand.newSize };
        if (otherCommand.newPosition) {
            this.newPosition = { ...otherCommand.newPosition };
        }
        this.description = `Изменить размер объекта ${Math.round(this.oldSize.width)}×${Math.round(this.oldSize.height)} → ${Math.round(this.newSize.width)}×${Math.round(this.newSize.height)}`;
        this.timestamp = otherCommand.timestamp; // Обновляем время последнего изменения
    }
}
