import { BaseCommand } from './BaseCommand.js';

/**
 * Команда вставки объекта
 */
export class PasteObjectCommand extends BaseCommand {
    constructor(coreMoodboard, pastePosition = null) {
        super();
        this.coreMoodboard = coreMoodboard;
        this.pastePosition = pastePosition;
        this.newObjectId = null;
        this.newObjectData = null;
    }

    execute() {
        // Проверяем, есть ли что-то в буфере обмена
        if (!this.coreMoodboard.clipboard || this.coreMoodboard.clipboard.type !== 'object') {
            return;
        }

        // Получаем данные из буфера обмена
        const originalData = this.coreMoodboard.clipboard.data;
        
        // Создаем новый объект на основе скопированного
        this.newObjectData = JSON.parse(JSON.stringify(originalData));
        
        // Генерируем новый ID
        this.newObjectId = 'obj_' + Date.now() + '_copy';
        this.newObjectData.id = this.newObjectId;
        
        // Сохраняем ID оригинального объекта для отслеживания копий
        this.newObjectData.originalId = originalData.id;
        
        // Устанавливаем позицию вставки
        if (this.pastePosition) {
            this.newObjectData.position = { ...this.pastePosition };
        } else {
            // Если позиция не указана, смещаем относительно оригинала
            // Проверяем, сколько копий этого объекта уже создано
            const existingObjects = this.coreMoodboard.state.state.objects;
            const originalId = originalData.id;
            
            // Ищем все копии этого конкретного объекта
            const copies = existingObjects.filter(obj => 
                obj.originalId === originalId || // Копии оригинального объекта
                (obj.id === originalId && obj.originalId) // Если оригинал сам является копией
            );
            
            // Рассчитываем смещение на основе количества копий
            const offsetMultiplier = copies.length + 1;
            const offsetStep = 25; // Шаг смещения в пикселях
            
            console.log(`📋 Вставка копии объекта ${originalId}: найдено ${copies.length} существующих копий, смещение ${offsetStep * offsetMultiplier}px`);
            
            this.newObjectData.position = {
                x: originalData.position.x + (offsetStep * offsetMultiplier),
                y: originalData.position.y + (offsetStep * offsetMultiplier)
            };
        }
        
        // Сбрасываем флаг компенсации pivot для нового объекта
        if (!this.newObjectData.transform) {
            this.newObjectData.transform = {};
        }
        this.newObjectData.transform.pivotCompensated = false;
        
        // Добавляем в состояние
        this.coreMoodboard.state.addObject(this.newObjectData);
        
        // Создаем PIXI объект
        this.coreMoodboard.pixi.createObject(this.newObjectData);
        
        this.emit('object:pasted', {
            originalId: originalData.id,
            newId: this.newObjectId,
            objectData: this.newObjectData
        });
    }

    undo() {
        if (this.newObjectId) {
            // Удаляем созданный объект
            this.coreMoodboard.state.removeObject(this.newObjectId);
            this.coreMoodboard.pixi.removeObject(this.newObjectId);
            
            this.emit('object:removed', {
                objectId: this.newObjectId
            });
        }
    }

    getDescription() {
        return `Вставить объект`;
    }
}
