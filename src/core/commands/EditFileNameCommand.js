import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

/**
 * Команда изменения названия файла
 */
export class EditFileNameCommand extends BaseCommand {
    constructor(coreMoodboard, objectId, oldName, newName) {
        super('edit_file_name', `Переименовать файл`);
        this.coreMoodboard = coreMoodboard;
        this.objectId = objectId;
        this.oldName = oldName;
        this.newName = newName;
        
        // Обновляем описание с названиями
        this.description = `Переименовать файл "${this.oldName}" → "${this.newName}"`;
    }

    async execute() {
        // Устанавливаем новое название
        await this._setFileName(this.newName);
    }

    async undo() {
        // Возвращаем старое название
        await this._setFileName(this.oldName);
    }

    /**
     * Можно объединить команды переименования одного и того же файла
     */
    canMergeWith(otherCommand) {
        return otherCommand instanceof EditFileNameCommand &&
               otherCommand.objectId === this.objectId;
    }

    /**
     * Объединяет команды переименования - берет начальное название из первой команды
     * и конечное название из второй
     */
    mergeWith(otherCommand) {
        if (!this.canMergeWith(otherCommand)) {
            throw new Error('Cannot merge commands');
        }
        
        // Обновляем конечное название
        this.newName = otherCommand.newName;
        this.description = `Переименовать файл "${this.oldName}" → "${this.newName}"`;
        this.timestamp = otherCommand.timestamp;
    }

    /**
     * Устанавливает название файла
     * @private
     */
    async _setFileName(fileName) {
        // Обновляем в состоянии
        const objects = this.coreMoodboard.state.getObjects();
        const objectData = objects.find(obj => obj.id === this.objectId);
        
        if (objectData) {
            // Обновляем properties объекта
            if (!objectData.properties) {
                objectData.properties = {};
            }
            objectData.properties.fileName = fileName;
            
            // Синхронизируем с сервером, если есть fileId
            if (objectData.fileId && this.coreMoodboard.fileUploadService) {
                try {
                    console.log('🔄 Синхронизируем название файла с сервером:', { fileId: objectData.fileId, fileName });
                    await this.coreMoodboard.fileUploadService.updateFileMetadata(objectData.fileId, { 
                        fileName: fileName 
                    });
                    console.log('✅ Название файла успешно обновлено на сервере');
                } catch (error) {
                    console.warn('⚠️ Ошибка синхронизации названия файла с сервером:', error);
                    // Не останавливаем выполнение, продолжаем с локальным обновлением
                }
            }
            
            // Обновляем состояние
            this.coreMoodboard.state.markDirty();
            
            // Обновляем визуальное представление
            const pixiReq = { objectId: this.objectId, pixiObject: null };
            this.coreMoodboard.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
            
            if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
                const fileInstance = pixiReq.pixiObject._mb.instance;
                if (typeof fileInstance.setFileName === 'function') {
                    fileInstance.setFileName(fileName);
                }
            }
            
            // Эмитим событие обновления объекта
            this.coreMoodboard.eventBus.emit(Events.Object.Updated, { 
                objectId: this.objectId,
                type: 'fileName',
                oldValue: this.oldName,
                newValue: fileName
            });
        } else {
            console.warn(`EditFileNameCommand: объект с ID ${this.objectId} не найден`);
        }
    }
}
