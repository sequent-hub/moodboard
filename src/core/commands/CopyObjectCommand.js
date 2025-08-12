import { BaseCommand } from './BaseCommand.js';

/**
 * Команда копирования объекта
 */
export class CopyObjectCommand extends BaseCommand {
    constructor(coreMoodboard, objectId) {
        super();
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.objectData = null;
    }

    execute() {
        // Находим объект в состоянии
        const objects = this.coreMoodboard.state.state.objects;
        const object = objects.find(obj => obj.id === this.objectId);
        
        if (object) {
            // Создаем глубокую копию данных объекта
            this.objectData = JSON.parse(JSON.stringify(object));
            
            // Сохраняем в буфер обмена приложения
            this.coreMoodboard.clipboard = {
                type: 'object',
                data: this.objectData
            };
            
            this.emit('object:copied', {
                objectId: this.objectId,
                objectData: this.objectData
            });
        }
    }

    undo() {
        // Копирование не нужно отменять - это не меняет состояние доски
    }

    getDescription() {
        return `Копировать объект ${this.objectId}`;
    }
}
