import * as PIXI from 'pixi.js';
import { GeometryUtils } from './GeometryUtils.js';

/**
 * Менеджер hit-testing объектов
 * Отвечает за определение объектов под курсором
 */
export class HitTestManager {
    constructor(layerManager, objectsMap) {
        this.layerManager = layerManager;
        this.objectsMap = objectsMap; // Map<id, pixiObject>
    }

    /**
     * Поиск объекта в указанной позиции
     * @param {number} x - X координата в экранных координатах
     * @param {number} y - Y координата в экранных координатах
     * @returns {{type: string, object?: string, pixiObject?: PIXI.DisplayObject}} Результат hit-test
     */
    hitTest(x, y) {
        const point = new PIXI.Point(x, y);
        const worldLayer = this.layerManager.getWorldLayer();
        
        if (!worldLayer) {
            return { type: 'empty' };
        }

        // Проходим по объектам в worldLayer от верхних к нижним
        for (let i = worldLayer.children.length - 1; i >= 0; i--) {
            const child = worldLayer.children[i];
            
            if (this._testObjectHit(child, point)) {
                return this._createHitResult(child);
            }
        }
        
        return { type: 'empty' };
    }

    /**
     * Тестирует попадание в конкретный объект
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект для тестирования
     * @param {PIXI.Point} point - Точка для тестирования
     * @returns {boolean} true если точка попадает в объект
     * @private
     */
    _testObjectHit(pixiObject, point) {
        // Основной hit-test через PIXI
        if (pixiObject.containsPoint && pixiObject.containsPoint(point)) {
            return true;
        }

        // Дополнительный hit-test для нарисованных линий
        return this._testDrawingHit(pixiObject, point);
    }

    /**
     * Специальный hit-test для нарисованных линий
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     * @param {PIXI.Point} point - Точка для тестирования
     * @returns {boolean} true если точка попадает в линию
     * @private
     */
    _testDrawingHit(pixiObject, point) {
        const meta = pixiObject._mb;
        
        // Проверяем только drawing объекты
        if (!meta || meta.type !== 'drawing' || !pixiObject.toLocal) {
            return false;
        }

        // Переводим точку в локальные координаты объекта
        const local = pixiObject.toLocal(point);
        const props = meta.properties || {};
        const points = Array.isArray(props.points) ? props.points : [];

        if (points.length < 2) {
            return false;
        }

        // Оценка текущего масштаба относительно базовых размеров
        const baseW = props.baseWidth || 1;
        const baseH = props.baseHeight || 1;
        const bounds = pixiObject.getBounds();
        const scaleX = baseW ? (bounds.width / baseW) : 1;
        const scaleY = baseH ? (bounds.height / baseH) : 1;

        // Толщина линии с учётом режима маркера
        const baseWidth = props.strokeWidth || 2;
        const lineWidth = (props.mode === 'marker' ? baseWidth * 2 : baseWidth);
        const threshold = Math.max(4, lineWidth / 2 + 3);

        // Проверяем расстояние до каждого сегмента
        for (let j = 0; j < points.length - 1; j++) {
            const ax = points[j].x * scaleX;
            const ay = points[j].y * scaleY;
            const bx = points[j + 1].x * scaleX;
            const by = points[j + 1].y * scaleY;
            
            const dist = GeometryUtils.distancePointToSegment(
                local.x, local.y, ax, ay, bx, by
            );
            
            if (dist <= threshold) {
                return true;
            }
        }

        return false;
    }

    /**
     * Создает результат hit-test
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     * @returns {{type: string, object: string, pixiObject: PIXI.DisplayObject}} Результат
     * @private
     */
    _createHitResult(pixiObject) {
        // Находим ID объекта
        for (const [objectId, obj] of this.objectsMap.entries()) {
            if (obj === pixiObject) {
                return {
                    type: 'object',
                    object: objectId,
                    pixiObject: pixiObject
                };
            }
        }

        // Если ID не найден, возвращаем объект без ID
        return {
            type: 'object',
            object: null,
            pixiObject: pixiObject
        };
    }

    /**
     * Получить все объекты в указанной области
     * @param {number} x - X координата левого верхнего угла
     * @param {number} y - Y координата левого верхнего угла
     * @param {number} width - Ширина области
     * @param {number} height - Высота области
     * @returns {Array} Массив объектов в области
     */
    hitTestArea(x, y, width, height) {
        const worldLayer = this.layerManager.getWorldLayer();
        if (!worldLayer) return [];

        const results = [];
        const worldObjects = this.layerManager.getWorldObjects();

        for (const pixiObject of worldObjects) {
            if (this._testObjectInArea(pixiObject, x, y, width, height)) {
                const result = this._createHitResult(pixiObject);
                if (result.object) {
                    results.push(result);
                }
            }
        }

        return results;
    }

    /**
     * Проверяет, находится ли объект в указанной области
     * @param {PIXI.DisplayObject} pixiObject - PIXI объект
     * @param {number} areaX - X координата области
     * @param {number} areaY - Y координата области
     * @param {number} areaWidth - Ширина области
     * @param {number} areaHeight - Высота области
     * @returns {boolean} true если объект в области
     * @private
     */
    _testObjectInArea(pixiObject, areaX, areaY, areaWidth, areaHeight) {
        const bounds = pixiObject.getBounds();
        
        return GeometryUtils.pointInRect(
            bounds.x, bounds.y,
            areaX, areaY, areaWidth, areaHeight
        ) || GeometryUtils.pointInRect(
            bounds.x + bounds.width, bounds.y + bounds.height,
            areaX, areaY, areaWidth, areaHeight
        );
    }
}
