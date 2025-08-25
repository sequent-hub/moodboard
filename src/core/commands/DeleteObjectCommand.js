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
        const originalData = objects.find(obj => obj.id === objectId);
        
        if (!originalData) {
            throw new Error(`Object with id ${objectId} not found`);
        }

        // Делаем глубокую копию данных объекта
        this.objectData = JSON.parse(JSON.stringify(originalData));
        
        // Для изображений убедимся, что есть src URL для восстановления
        if (this.objectData.type === 'image') {
            console.log('🔧 DEBUG DeleteObjectCommand: исходные данные изображения:', {
                id: this.objectData.id,
                imageId: this.objectData.imageId,
                src: this.objectData.src,
                propertiesSrc: this.objectData.properties?.src,
                hasBase64Src: !!(this.objectData.src && this.objectData.src.startsWith('data:')),
                hasBase64Props: !!(this.objectData.properties?.src && this.objectData.properties.src.startsWith('data:'))
            });
            
            if (this.objectData.imageId) {
                const imageUrl = `/api/images/${this.objectData.imageId}/file`;
                
                // Всегда восстанавливаем URL из imageId для гарантии
                // (может быть удален при предыдущих сохранениях)
                this.objectData.src = imageUrl;
                
                if (!this.objectData.properties) {
                    this.objectData.properties = {};
                }
                this.objectData.properties.src = imageUrl;
                
                console.log('🔧 DEBUG DeleteObjectCommand: обновленные данные изображения:', {
                    id: this.objectData.id,
                    imageId: this.objectData.imageId,
                    src: this.objectData.src,
                    propertiesSrc: this.objectData.properties?.src
                });
            } else {
                console.warn('🔧 DEBUG DeleteObjectCommand: у изображения нет imageId, оставляем как есть');
            }
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
        // DEBUG: Логируем состояние объекта при Undo
        if (this.objectData.type === 'image') {
            console.log('🔄 DEBUG Undo изображения:', {
                id: this.objectData.id,
                imageId: this.objectData.imageId,
                src: this.objectData.src,
                propertiesSrc: this.objectData.properties?.src,
                hasBase64Src: !!(this.objectData.src && this.objectData.src.startsWith('data:')),
                hasBase64Props: !!(this.objectData.properties?.src && this.objectData.properties.src.startsWith('data:'))
            });
        }

        // Восстанавливаем объект с сохраненными данными
        this.coreMoodboard.state.addObject(this.objectData);
        this.coreMoodboard.pixi.createObject(this.objectData);
        
        this.coreMoodboard.eventBus.emit(Events.Object.Created, { 
            objectId: this.objectId, 
            objectData: this.objectData 
        });
    }
}
