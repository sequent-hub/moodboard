import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда удаления объекта
 */
export class DeleteObjectCommand extends BaseCommand {
    constructor(coreMoodboard, objectId) {
        super('delete_object', `Удалить объект`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        
        // Сохраняем данные объекта для возможности восстановления
        const objects = this.coreMoodboard.state.getObjects();
        this.objectData = objects.find(obj => obj.id === objectId);
        
        if (!this.objectData) {
            throw new Error(`Object with id ${objectId} not found`);
        }
        
        // Обновляем описание с типом объекта
        this.description = `Удалить ${this.objectData.type}`;
    }

    execute() {
        // Удаляем объект из состояния и PIXI
        this.coreMoodboard.state.removeObject(this.objectId);
        this.coreMoodboard.pixi.removeObject(this.objectId);
        

        
        this.coreMoodboard.eventBus.emit(Events.Object.Deleted, { 
            objectId: this.objectId 
        });
    }

    undo() {
        // Восстанавливаем объект
        this.coreMoodboard.state.addObject(this.objectData);
        this.coreMoodboard.pixi.createObject(this.objectData);
        

        
        this.coreMoodboard.eventBus.emit(Events.Object.Created, { 
            objectId: this.objectId, 
            objectData: this.objectData 
        });
    }
}
