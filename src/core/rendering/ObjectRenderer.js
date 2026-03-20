import * as PIXI from 'pixi.js';
import { ObjectFactory } from '../../objects/ObjectFactory.js';
import { GeometryUtils } from './GeometryUtils.js';

/**
 * Рендерер объектов
 * Отвечает за создание, обновление и удаление PIXI объектов
 */
export class ObjectRenderer {
    constructor(objectsMap, eventBus = null) {
        this.objects = objectsMap; // Map<id, pixiObject> из PixiEngine
        this.eventBus = eventBus;
    }

    /**
     * Создать объект на холсте
     * @param {Object} objectData - Данные объекта
     * @returns {PIXI.DisplayObject|null} Созданный PIXI объект или null
     */
    createObject(objectData) {
        let pixiObject;

        // Создаем объект через фабрику
        const instance = ObjectFactory.create(objectData.type, objectData, this.eventBus);
        if (instance) {
            pixiObject = instance.getPixi();
            this._setupObjectMetadata(pixiObject, objectData, instance);
        } else {
            console.warn(`Unknown object type: ${objectData.type}`);
            pixiObject = this._createDefaultObject(objectData);
        }

        if (pixiObject) {
            this._setupObjectProperties(pixiObject, objectData);
            this._setupObjectTransform(pixiObject, objectData);
            // Объект добавляется в слой через PixiEngine, здесь только сохраняем в Map
            this.objects.set(objectData.id, pixiObject);
        }

        return pixiObject;
    }

    /**
     * Настройка метаданных объекта
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     * @param {Object} objectData - Данные объекта
     * @param {Object} instance - Экземпляр объекта
     * @private
     */
    _setupObjectMetadata(pixiObject, objectData, instance) {
        const prevMb = pixiObject._mb || {};
        pixiObject._mb = {
            ...prevMb,
            objectId: objectData.id,
            type: objectData.type,
            properties: objectData.properties || {},
            instance
        };
    }

    /**
     * Настройка базовых свойств объекта
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     * @param {Object} objectData - Данные объекта
     * @private
     */
    _setupObjectProperties(pixiObject, objectData) {
        pixiObject.x = objectData.position.x;
        pixiObject.y = objectData.position.y;
        pixiObject.eventMode = 'static';
        pixiObject.cursor = 'pointer';
    }

    /**
     * Настройка трансформации объекта
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     * @param {Object} objectData - Данные объекта
     * @private
     */
    _setupObjectTransform(pixiObject, objectData) {
        // Устанавливаем центр вращения
        if (pixiObject.anchor !== undefined) {
            pixiObject.anchor.set(0.5, 0.5);
        } else if (pixiObject instanceof PIXI.Graphics) {
            const bounds = pixiObject.getBounds();
            const isMindmap = objectData?.type === 'mindmap';
            const pivotX = isMindmap ? Math.floor(bounds.width / 2) : (bounds.width / 2);
            const pivotY = isMindmap ? Math.floor(bounds.height / 2) : (bounds.height / 2);
            pixiObject.pivot.set(pivotX, pivotY);
            
            // Компенсируем смещение pivot
            const needsCompensation = !objectData.transform || !objectData.transform.pivotCompensated;
            if (needsCompensation) {
                pixiObject.x += pivotX;
                pixiObject.y += pivotY;
                if (isMindmap) {
                    pixiObject.x = Math.round(pixiObject.x);
                    pixiObject.y = Math.round(pixiObject.y);
                }
            }
        }
        
        // Применяем поворот
        if (objectData.transform && objectData.transform.rotation !== undefined) {
            const angleRadians = GeometryUtils.degreesToRadians(objectData.transform.rotation);
            pixiObject.rotation = angleRadians;
        }
    }



    /**
     * Создать объект по умолчанию для неизвестных типов
     * @param {Object} objectData - Данные объекта
     * @returns {PIXI.Graphics} PIXI Graphics объект
     * @private
     */
    _createDefaultObject(objectData) {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0xFF0000, 0.5);
        graphics.drawRect(0, 0, objectData.width || 100, objectData.height || 100);
        graphics.endFill();
        return graphics;
    }

    /**
     * Удалить объект с холста
     * @param {string} objectId - ID объекта
     */
    removeObject(objectId) {
        const pixiObject = this.objects.get(objectId);
        if (pixiObject) {
            // Объект удаляется из слоя через PixiEngine, здесь только удаляем из Map
            this.objects.delete(objectId);
        }
    }

    /**
     * Обновить размер объекта
     * @param {string} objectId - ID объекта
     * @param {Object} size - Новый размер {width, height}
     * @param {string} objectType - Тип объекта
     */
    updateObjectSize(objectId, size, objectType = null) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;

        console.log(`🎨 Обновляем размер объекта ${objectId}, тип: ${objectType}`);
        
        // Делегируем изменение размера объекту
        const meta = pixiObject._mb || {};
        if (meta.instance && typeof meta.instance.updateSize === 'function') {
            meta.instance.updateSize(size);
        } else if (pixiObject instanceof PIXI.Graphics) {
            this._recreateGraphicsObject(pixiObject, size, objectType);
        }
    }

    /**
     * Пересоздать Graphics объект с новым размером
     * @param {PIXI.Graphics} pixiObject - PIXI Graphics объект
     * @param {Object} size - Новый размер
     * @param {string} objectType - Тип объекта
     * @private
     */
    _recreateGraphicsObject(pixiObject, size, objectType = null) {
        pixiObject.clear();
        
        console.log(`🔄 Пересоздаем Graphics объект, тип: ${objectType}`);
        
        if (objectType === 'drawing') {
            this._redrawDrawingObject(pixiObject, size);
        } else {
            this._redrawDefaultObject(pixiObject, size);
        }
        
        // Устанавливаем pivot в центр
        const pivotX = size.width / 2;
        const pivotY = size.height / 2;
        pixiObject.pivot.set(pivotX, pivotY);
    }

    /**
     * Перерисовать drawing объект
     * @param {PIXI.Graphics} pixiObject - PIXI Graphics объект
     * @param {Object} size - Размер
     * @private
     */
    _redrawDrawingObject(pixiObject, size) {
        const meta = pixiObject._mb || {};
        const props = meta.properties || {};
        const color = props.strokeColor ?? 0x111827;
        const widthPx = props.strokeWidth ?? 2;
        const alpha = props.mode === 'marker' ? 0.6 : 1;
        const points = Array.isArray(props.points) ? props.points : [];
        const baseW = props.baseWidth || size.width || 1;
        const baseH = props.baseHeight || size.height || 1;
        const scaleX = baseW ? (size.width / baseW) : 1;
        const scaleY = baseH ? (size.height / baseH) : 1;
        const lineWidth = props.mode === 'marker' ? widthPx * 2 : widthPx;
        
        pixiObject.lineStyle({ 
            width: lineWidth, 
            color, 
            alpha, 
            cap: 'round', 
            join: 'round', 
            miterLimit: 2, 
            alignment: 0.5 
        });
        
        pixiObject.blendMode = props.mode === 'marker' ? PIXI.BLEND_MODES.LIGHTEN : PIXI.BLEND_MODES.NORMAL;
        
        if (points.length > 0) {
            this._drawPoints(pixiObject, points, scaleX, scaleY);
        }
    }

    /**
     * Нарисовать точки для drawing объекта
     * @param {PIXI.Graphics} pixiObject - PIXI Graphics объект
     * @param {Array} points - Массив точек
     * @param {number} scaleX - Масштаб по X
     * @param {number} scaleY - Масштаб по Y
     * @private
     */
    _drawPoints(pixiObject, points, scaleX, scaleY) {
        if (points.length < 3) {
            pixiObject.moveTo(points[0].x * scaleX, points[0].y * scaleY);
            for (let i = 1; i < points.length; i++) {
                pixiObject.lineTo(points[i].x * scaleX, points[i].y * scaleY);
            }
        } else {
            pixiObject.moveTo(points[0].x * scaleX, points[0].y * scaleY);
            for (let i = 1; i < points.length - 1; i++) {
                const cx = points[i].x * scaleX, cy = points[i].y * scaleY;
                const nx = points[i + 1].x * scaleX, ny = points[i + 1].y * scaleY;
                const mx = (cx + nx) / 2, my = (cy + ny) / 2;
                pixiObject.quadraticCurveTo(cx, cy, mx, my);
            }
            const pen = points[points.length - 2];
            const last = points[points.length - 1];
            pixiObject.quadraticCurveTo(pen.x * scaleX, pen.y * scaleY, last.x * scaleX, last.y * scaleY);
        }
    }

    /**
     * Перерисовать объект по умолчанию
     * @param {PIXI.Graphics} pixiObject - PIXI Graphics объект
     * @param {Object} size - Размер
     * @private
     */
    _redrawDefaultObject(pixiObject, size) {
        const borderWidth = 2;
        pixiObject.lineStyle(borderWidth, 0x333333, 1);
        pixiObject.beginFill(0xFFFFFF, 0.1);
        
        const halfBorder = borderWidth / 2;
        pixiObject.drawRect(halfBorder, halfBorder, size.width - borderWidth, size.height - borderWidth);
        pixiObject.endFill();
    }

    /**
     * Обновить содержимое объекта
     * @param {string} objectId - ID объекта
     * @param {string} content - Новое содержимое
     */
    updateObjectContent(objectId, content) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;

        console.log(`🎨 Обновляем содержимое объекта ${objectId}:`, content);
        
        // Делегируем изменение содержимого объекту
        const meta = pixiObject._mb || {};
        if (meta.instance) {
            if (typeof meta.instance.setContent === 'function') {
                meta.instance.setContent(content);
            } else if (typeof meta.instance.setText === 'function') {
                meta.instance.setText(content);
            }
        }
    }

    /**
     * Скрыть текст объекта (используется во время редактирования)
     * @param {string} objectId - ID объекта
     */
    hideObjectText(objectId) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;

        const meta = pixiObject._mb || {};
        if (meta.instance && typeof meta.instance.hideText === 'function') {
            meta.instance.hideText();
        }
    }

    /**
     * Показать текст объекта (используется после завершения редактирования)
     * @param {string} objectId - ID объекта
     */
    showObjectText(objectId) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;

        const meta = pixiObject._mb || {};
        if (meta.instance && typeof meta.instance.showText === 'function') {
            meta.instance.showText();
        }
    }

    /**
     * Обновить угол поворота объекта
     * @param {string} objectId - ID объекта
     * @param {number} angleDegrees - Угол в градусах
     */
    updateObjectRotation(objectId, angleDegrees) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;

        const angleRadians = GeometryUtils.degreesToRadians(angleDegrees);
        pixiObject.rotation = angleRadians;
    }

    /**
     * Установить цвет заливки для фрейма
     * @param {string} objectId - ID объекта
     * @param {number} width - Ширина
     * @param {number} height - Высота
     * @param {number} fillColor - Цвет заливки
     */
    setFrameFill(objectId, width, height, fillColor = 0xFFFFFF) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;
        const meta = pixiObject._mb || {};
        if (meta.type !== 'frame' || !meta.instance) return;
        meta.instance.setFill(fillColor);
    }

    /**
     * Получить объект по ID
     * @param {string} objectId - ID объекта
     * @returns {PIXI.DisplayObject|null} PIXI объект или null
     */
    getObject(objectId) {
        return this.objects.get(objectId) || null;
    }

    /**
     * Получить все объекты
     * @returns {Map} Map всех объектов
     */
    getAllObjects() {
        return this.objects;
    }

    /**
     * Очистить все объекты
     */
    clearAllObjects() {
        // Слой очищается через PixiEngine, здесь только очищаем Map
        this.objects.clear();
    }
}
