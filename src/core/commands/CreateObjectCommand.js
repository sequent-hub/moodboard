import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда создания объекта
 */
export class CreateObjectCommand extends BaseCommand {
    constructor(coreMoodboard, objectData) {
        super('create_object', `Создать ${objectData.type}`);
        this.coreMoodboard = coreMoodboard;
        this.objectData = { ...objectData }; // Копируем данные объекта
        this.wasExecuted = false;
    }

    execute() {
        if (this.wasExecuted) {
            // При redo - восстанавливаем объект
            this.coreMoodboard.state.addObject(this.objectData);
            this.coreMoodboard.pixi.createObject(this.objectData);

        } else {
            // При первом выполнении - создаем новый объект
            this.coreMoodboard.state.addObject(this.objectData);
            this.coreMoodboard.pixi.createObject(this.objectData);
            this.wasExecuted = true;

        }
        
        this.coreMoodboard.eventBus.emit(Events.Object.Created, { 
            objectId: this.objectData.id, 
            objectData: this.objectData 
        });
    }

    undo() {
        // Удаляем объект из состояния и PIXI
        this.coreMoodboard.state.removeObject(this.objectData.id);
        this.coreMoodboard.pixi.removeObject(this.objectData.id);
        

        
        this.coreMoodboard.eventBus.emit(Events.Object.Deleted, { 
            objectId: this.objectData.id 
        });
    }
}
