import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';
import { generateObjectId } from '../../utils/objectIdGenerator.js';

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
        
        // Генерируем уникальный ID с проверкой коллизий
        const exists = (id) => {
            const inState = (this.coreMoodboard.state.state.objects || []).some(o => o.id === id);
            const inPixi = this.coreMoodboard.pixi?.objects?.has ? this.coreMoodboard.pixi.objects.has(id) : false;
            return inState || inPixi;
        };
        this.newObjectId = generateObjectId(exists);
        this.newObjectData.id = this.newObjectId;

        // Название для фрейма, если не проставлено заранее (например, из DuplicateRequest)
        try {
            if (this.newObjectData.type === 'frame') {
                const t0 = this.newObjectData?.properties?.title || '';
                if (!/^\s*Фрейм\s+\d+\s*$/i.test(t0)) {
                    const objects = this.coreMoodboard.state?.state?.objects || [];
                    let maxNum = 0;
                    for (const o of objects) {
                        if (!o || o.type !== 'frame') continue;
                        const t = o?.properties?.title || '';
                        const m = t.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                        if (m) {
                            const n = parseInt(m[1], 10);
                            if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
                        }
                    }
                    const nextIndex = maxNum + 1;
                    this.newObjectData.properties = this.newObjectData.properties || {};
                    this.newObjectData.properties.title = `Фрейм ${nextIndex}`;
                }
            }
        } catch (_) { /* no-op */ }
        
        // Сохраняем ID оригинального объекта для отслеживания копий
        this.newObjectData.originalId = originalData.id;
        
        // Устанавливаем позицию вставки: если пришла — строго под курсор; иначе fallback со смещением
        if (this.pastePosition) {
            this.newObjectData.position = { ...this.pastePosition };
        } else {
            const existingObjects = this.coreMoodboard.state.state.objects;
            const originalId = originalData.id;
            const copies = existingObjects.filter(obj => obj.originalId === originalId || (obj.id === originalId && obj.originalId));
            const offsetMultiplier = copies.length + 1;
            const offsetStep = 25;
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
        
        this.emit(Events.Object.Pasted, {
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
            
            // Соответствующего константного события нет — остаёмся без эмита или используем Object.Deleted, если надо глобально
            this.emit(Events.Object.Deleted, {
                objectId: this.newObjectId
            });
        }
    }

    getDescription() {
        return `Вставить объект`;
    }
}
