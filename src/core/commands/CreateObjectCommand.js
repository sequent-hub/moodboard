import { BaseCommand } from './BaseCommand.js';

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
            console.log('↷ Восстановлен объект:', this.objectData.id);
        } else {
            // При первом выполнении - создаем новый объект
            this.coreMoodboard.state.addObject(this.objectData);
            this.coreMoodboard.pixi.createObject(this.objectData);
            this.wasExecuted = true;
            console.log('✅ Создан объект:', this.objectData.id);
        }
        
        this.coreMoodboard.eventBus.emit('object:created', { 
            objectId: this.objectData.id, 
            objectData: this.objectData 
        });
    }

    undo() {
        // Удаляем объект из состояния и PIXI
        this.coreMoodboard.state.removeObject(this.objectData.id);
        this.coreMoodboard.pixi.removeObject(this.objectData.id);
        
        console.log('↶ Удален объект:', this.objectData.id);
        
        this.coreMoodboard.eventBus.emit('object:deleted', { 
            objectId: this.objectData.id 
        });
    }
}
