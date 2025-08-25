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
        
        // Для файлов сохраняем информацию для возможной очистки с сервера
        if (this.objectData.type === 'file') {
            console.log('🔧 DEBUG DeleteObjectCommand: исходные данные файла:', {
                id: this.objectData.id,
                fileId: this.objectData.fileId,
                fileName: this.objectData.properties?.fileName
            });
            
            if (this.objectData.fileId) {
                // Сохраняем fileId для удаления с сервера
                this.fileIdToDelete = this.objectData.fileId;
                console.log('🔧 DEBUG DeleteObjectCommand: файл будет удален с сервера:', this.fileIdToDelete);
            }
        }
        
        // Обновляем описание с типом объекта
        this.description = `Удалить ${this.objectData.type}`;
    }

    async execute() {
        // Удаляем объект из состояния и PIXI
        this.coreMoodboard.state.removeObject(this.objectId);
        this.coreMoodboard.pixi.removeObject(this.objectId);
        
        // Если это файловый объект с fileId, удаляем файл с сервера
        if (this.fileIdToDelete && this.coreMoodboard.fileUploadService) {
            try {
                console.log('🗑️ Удаляем файл с сервера:', this.fileIdToDelete);
                await this.coreMoodboard.fileUploadService.deleteFile(this.fileIdToDelete);
                console.log('✅ Файл успешно удален с сервера:', this.fileIdToDelete);
            } catch (error) {
                console.warn('⚠️ Ошибка удаления файла с сервера:', error);
                // Не останавливаем выполнение команды, так как объект уже удален из UI
            }
        }
        
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
        
        // Специальная обработка для файловых объектов
        if (this.objectData.type === 'file' && this.fileIdToDelete) {
            console.log('🔄 DEBUG Undo файла:', {
                id: this.objectData.id,
                fileId: this.objectData.fileId,
                fileName: this.objectData.properties?.fileName
            });
            
            // Файл был удален с сервера, создаем объект с предупреждением
            const restoredObjectData = { ...this.objectData };
            if (restoredObjectData.properties) {
                restoredObjectData.properties = {
                    ...restoredObjectData.properties,
                    fileName: `[УДАЛЕН] ${restoredObjectData.properties.fileName || 'файл'}`,
                    isDeleted: true // Флаг для FileObject чтобы показать другую иконку
                };
            }
            
            // Восстанавливаем объект с измененными данными
            this.coreMoodboard.state.addObject(restoredObjectData);
            this.coreMoodboard.pixi.createObject(restoredObjectData);
            
            console.warn('⚠️ Файл восстановлен на холсте, но был удален с сервера');
        } else {
            // Восстанавливаем объект с сохраненными данными (для всех остальных типов)
            this.coreMoodboard.state.addObject(this.objectData);
            this.coreMoodboard.pixi.createObject(this.objectData);
        }
        
        this.coreMoodboard.eventBus.emit(Events.Object.Created, { 
            objectId: this.objectId, 
            objectData: this.objectData 
        });
    }
}
