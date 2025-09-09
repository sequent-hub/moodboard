import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

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
            // Если копируем фрейм — кладём в буфер группу: сам фрейм + его дети
            if (object.type === 'frame') {
                const frame = JSON.parse(JSON.stringify(object));
                const children = (objects || []).filter(o => o && o.properties && o.properties.frameId === object.id)
                    .map(o => JSON.parse(JSON.stringify(o)));
                const groupData = [frame, ...children];
                this.coreMoodboard.clipboard = {
                    type: 'group',
                    data: groupData,
                    meta: { pasteCount: 0, frameBundle: true }
                };
            } else {
                // Обычный объект
                this.objectData = JSON.parse(JSON.stringify(object));
                this.coreMoodboard.clipboard = {
                    type: 'object',
                    data: this.objectData
                };
            }
            
            this.emit(Events.Object.Updated, {
                objectId: this.objectId,
                objectData: object
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
