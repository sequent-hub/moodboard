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

        const currentObject = this._getCurrentObject();
        if (!currentObject) {
            throw new Error(`Object with id ${objectId} not found`);
        }
        this.description = `Удалить ${currentObject.type}`;
    }

    async execute() {
        console.log('🗑️ DeleteObjectCommand: начинаем удаление объекта:', this.objectId);

        const currentObject = this._getCurrentObject();
        const blobSrc = currentObject?.properties?.src || currentObject?.src;

        // Удаляем объект из состояния и PIXI
        this.coreMoodboard.state.removeObject(this.objectId);
        this.coreMoodboard.pixi.removeObject(this.objectId);

        console.log('🗑️ DeleteObjectCommand: объект удален из state и PIXI');

        // Освобождаем blob URL у изображений (утечка памяти при fallback без upload)
        if (typeof blobSrc === 'string' && blobSrc.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(blobSrc);
            } catch (_) {}
        }

        // Эмитим событие удаления для обновления всех UI компонентов
        this.coreMoodboard.eventBus.emit(Events.Object.Deleted, {
            objectId: this.objectId
        });

        console.log('✅ DeleteObjectCommand: событие Events.Object.Deleted отправлено');
    }

    undo() {
        // Локальный undo-restore отключен: история состояния загружается с сервера по версиям.
    }

    _getCurrentObject() {
        const objects = this.coreMoodboard.state.getObjects();
        return objects.find(obj => obj.id === this.objectId);
    }
}
