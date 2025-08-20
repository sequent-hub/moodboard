import * as PIXI from 'pixi.js';
import { ObjectFactory } from '../objects/ObjectFactory.js';

export class PixiEngine {
    constructor(container, eventBus, options) {
        this.container = container;
        this.eventBus = eventBus;
        this.options = options;
        this.objects = new Map();
    }

    async init() {
        this.app = new PIXI.Application({
            width: this.options.width,
            height: this.options.height,
            backgroundColor: this.options.backgroundColor,
            antialias: true
        });

        this.container.appendChild(this.app.view);

        // Отдельные слои: сетка (не двигается) и мир с объектами (двигается)
        this.gridLayer = new PIXI.Container();
        this.gridLayer.name = 'gridLayer';
        this.gridLayer.zIndex = 0;
        this.app.stage.addChild(this.gridLayer);

        this.worldLayer = new PIXI.Container();
        this.worldLayer.name = 'worldLayer';
        this.worldLayer.zIndex = 1;
        this.worldLayer.sortableChildren = true;
        this.app.stage.addChild(this.worldLayer);



    }

    createObject(objectData) {
        let pixiObject;

        const instance = ObjectFactory.create(objectData.type, objectData);
        if (instance) {
            pixiObject = instance.getPixi();
            const prevMb = pixiObject._mb || {};
            pixiObject._mb = {
                ...prevMb,
                objectId: objectData.id,
                type: objectData.type,
                properties: objectData.properties || {},
                instance
            };
        } else {
            console.warn(`Unknown object type: ${objectData.type}`);
            pixiObject = this.createDefaultObject(objectData);
        }

        if (pixiObject) {
            pixiObject.x = objectData.position.x;
            pixiObject.y = objectData.position.y;
            pixiObject.eventMode = 'static'; // Исправляем deprecation warning
            pixiObject.cursor = 'pointer';
            // Сохраняем метаданные о типе и свойствах для последующих перерасчетов (resize),
            // если не были заданы выше (для frame уже установлено)
            const prevMb = pixiObject._mb || {};
            pixiObject._mb = {
                ...prevMb,
                objectId: prevMb.objectId ?? objectData.id,
                type: prevMb.type ?? objectData.type,
                properties: prevMb.properties ?? (objectData.properties || {}),
                instance: prevMb.instance
            };
            
            // Устанавливаем центр вращения в центр объекта
            if (pixiObject.anchor !== undefined) {
                // Для объектов с anchor (текст, спрайты)
                pixiObject.anchor.set(0.5, 0.5);
            } else if (pixiObject instanceof PIXI.Graphics) {
                // Для Graphics объектов устанавливаем pivot в центр
                const bounds = pixiObject.getBounds();
                const pivotX = bounds.width / 2;
                const pivotY = bounds.height / 2;
                pixiObject.pivot.set(pivotX, pivotY);
                
                // Компенсируем смещение pivot, только если координаты еще НЕ были скомпенсированы
                // Это проверяется по наличию transform.pivotCompensated
                const needsCompensation = !objectData.transform || !objectData.transform.pivotCompensated;
                
                if (needsCompensation) {
                    pixiObject.x += pivotX;
                    pixiObject.y += pivotY;
                }
            }
            
            // Применяем поворот из сохраненного состояния
            if (objectData.transform && objectData.transform.rotation !== undefined) {
                // Преобразуем градусы в радианы (углы сохраняются в градусах)
                const angleRadians = objectData.transform.rotation * Math.PI / 180;
                pixiObject.rotation = angleRadians;
            }
            
            // Убеждаемся, что объект может участвовать в hit testing
            if (pixiObject.beginFill) {
                // no-op
            }

            // Z-порядок пересчитывается извне (ZOrderManager)
            this.worldLayer.addChild(pixiObject);
            this.objects.set(objectData.id, pixiObject);


        }
    }

    // Добавление/обновление сетки в gridLayer
    setGrid(gridInstance) {
        if (!this.gridLayer) return;
        this.gridLayer.removeChildren();
        if (gridInstance && gridInstance.getPixiObject) {
            const g = gridInstance.getPixiObject();
            g.zIndex = 0;
            g.x = 0;
            g.y = 0;
            this.gridLayer.addChild(g);
        }
    }

    // createFrame удалён — логика вынесена в FrameObject

    // createText удалён — логика в TextObject

    // createEmoji удалён — логика вынесена в EmojiObject

    // createShape удалён — логика в ShapeObject

    // createDrawing удалён — логика вынесена в DrawingObject

    createDefaultObject(objectData) {
        // Заглушка для неизвестных типов
        const graphics = new PIXI.Graphics();
        graphics.beginFill(0xFF0000, 0.5);
        graphics.drawRect(0, 0, objectData.width || 100, objectData.height || 100);
        graphics.endFill();
        return graphics;
    }

    removeObject(objectId) {
        const pixiObject = this.objects.get(objectId);
        if (pixiObject) {
            if (this.worldLayer) {
                this.worldLayer.removeChild(pixiObject);
            } else {
                this.app.stage.removeChild(pixiObject);
            }
            this.objects.delete(objectId);
        }
    }

    /**
     * Обновить размер объекта
     */
    updateObjectSize(objectId, size, objectType = null) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;

        // Сохраняем позицию (центр) на случай, если инстанс пересоздаст геометрию
        const position = { x: pixiObject.x, y: pixiObject.y };
        
        console.log(`🎨 Обновляем размер объекта ${objectId}, тип: ${objectType}`);
        
        // Для Graphics объектов (рамки, фигуры) нужно пересоздать геометрию
        // Делегируем изменение размера объекту, если есть инстанс с updateSize
        const meta = pixiObject._mb || {};
        if (meta.instance && typeof meta.instance.updateSize === 'function') {
            meta.instance.updateSize(size);
        } else if (pixiObject instanceof PIXI.Graphics) {
            // Fallback для устаревших объектов без инстанса
            this.recreateGraphicsObject(pixiObject, size, position, objectType);
        }
    }

    /**
     * Пересоздать Graphics объект с новым размером
     */
    recreateGraphicsObject(pixiObject, size, position, objectType = null) {
        // Очищаем графику
        pixiObject.clear();
        
        console.log(`🔄 Пересоздаем Graphics объект, тип: ${objectType}`);
        
        // Определяем что рисовать по типу объекта
        if (objectType === 'drawing') {
            // Рисунок: перерисовываем по сохранённым точкам с масштабированием под новый size
            const meta = pixiObject._mb || {};
            const props = meta.properties || {};
            const color = props.strokeColor ?? 0x111827;
            const widthPx = props.strokeWidth ?? 2;
            const alpha = props.mode === 'marker' ? 0.6 : 1;
            const pts = Array.isArray(props.points) ? props.points : [];
            const baseW = props.baseWidth || size.width || 1;
            const baseH = props.baseHeight || size.height || 1;
            const scaleX = baseW ? (size.width / baseW) : 1;
            const scaleY = baseH ? (size.height / baseH) : 1;
            const lineWidth = props.mode === 'marker' ? widthPx * 2 : widthPx;
            pixiObject.lineStyle({ width: lineWidth, color, alpha, cap: 'round', join: 'round', miterLimit: 2, alignment: 0.5 });
            pixiObject.blendMode = props.mode === 'marker' ? PIXI.BLEND_MODES.LIGHTEN : PIXI.BLEND_MODES.NORMAL;
            if (pts.length > 0) {
                if (pts.length < 3) {
                    pixiObject.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
                    for (let i = 1; i < pts.length; i++) pixiObject.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
                } else {
                    pixiObject.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
                    for (let i = 1; i < pts.length - 1; i++) {
                        const cx = pts[i].x * scaleX, cy = pts[i].y * scaleY;
                        const nx = pts[i + 1].x * scaleX, ny = pts[i + 1].y * scaleY;
                        const mx = (cx + nx) / 2, my = (cy + ny) / 2;
                        pixiObject.quadraticCurveTo(cx, cy, mx, my);
                    }
                    const pen = pts[pts.length - 2];
                    const last = pts[pts.length - 1];
                    pixiObject.quadraticCurveTo(pen.x * scaleX, pen.y * scaleY, last.x * scaleX, last.y * scaleY);
                }
            }
        } else {
            // Fallback - определяем по существующему содержимому (если тип не передан)
            console.warn(`⚠️ Тип объекта не определен, используем fallback логику`);
            
            // Если есть только контур без заливки - это рамка
            // Если есть заливка - это фигура
            const borderWidth = 2;
            pixiObject.lineStyle(borderWidth, 0x333333, 1);
            pixiObject.beginFill(0xFFFFFF, 0.1);
            
            const halfBorder = borderWidth / 2;
            pixiObject.drawRect(halfBorder, halfBorder, size.width - borderWidth, size.height - borderWidth);
            pixiObject.endFill();
        }
        
        // Устанавливаем pivot в центр (для правильного вращения)
        const pivotX = size.width / 2;
        const pivotY = size.height / 2;
        // Сохраняем текущий центр до изменения pivot
        const prevCenter = { x: pixiObject.x, y: pixiObject.y };
        pixiObject.pivot.set(pivotX, pivotY);
        // Восстанавливаем центр, чтобы левый-верх в state не «уползал» при ресайзе
        pixiObject.x = prevCenter.x;
        pixiObject.y = prevCenter.y;
    }

    /**
     * Обновить размер текстового объекта
     */
    // Методы обновления текстов/эмоджи перенесены в соответствующие классы

    /**
     * Обновить угол поворота объекта
     */
    updateObjectRotation(objectId, angleDegrees) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject) return;

        // Конвертируем градусы в радианы
        const angleRadians = angleDegrees * Math.PI / 180;
        
        // Применяем поворот
        pixiObject.rotation = angleRadians;
    }

    /**
     * Установить цвет заливки для фрейма, не изменяя размер и позицию
     * Используется для визуала «во время перетаскивания» (светло-серый фон)
     */
    setFrameFill(objectId, width, height, fillColor = 0xFFFFFF) {
        const pixiObject = this.objects.get(objectId);
        if (!pixiObject || !(pixiObject instanceof PIXI.Graphics)) return;
        const meta = pixiObject._mb || {};
        if (meta.type !== 'frame') return;
        if (meta.instance) {
            meta.instance.setFill(fillColor);
        }
    }

    /**
     * Поиск объекта в указанной позиции
     */
    hitTest(x, y) {
        // Hit test at coordinates
        
        // Получаем все объекты в позиции (PIXI автоматически учитывает трансформации)
        const point = new PIXI.Point(x, y);
        
        // Проходим по объектам в worldLayer от верхних к нижним
        const container = this.worldLayer || this.app.stage;
        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];
            if (child.containsPoint && child.containsPoint(point)) {
                // Находим ID объекта
                for (const [objectId, pixiObject] of this.objects.entries()) {
                    if (pixiObject === child) {
                        return {
                            type: 'object',
                            object: objectId,
                            pixiObject: child
                        };
                    }
                }
            } else {
                // Доп. хит-тест для нарисованных линий (stroke), где containsPoint может не сработать
                const meta = child._mb;
                if (meta && meta.type === 'drawing' && child.toLocal) {
                    // Переводим точку в локальные координаты объекта
                    const local = child.toLocal(point);
                    const props = meta.properties || {};
                    const pts = Array.isArray(props.points) ? props.points : [];
                    if (pts.length >= 2) {
                        // Оценка текущего масштаба относительно базовых размеров
                        const baseW = props.baseWidth || 1;
                        const baseH = props.baseHeight || 1;
                        const b = child.getBounds();
                        const scaleX = baseW ? (b.width / baseW) : 1;
                        const scaleY = baseH ? (b.height / baseH) : 1;
                        // Толщина линии с учётом режима маркера
                        const baseWidth = props.strokeWidth || 2;
                        const lineWidth = (props.mode === 'marker' ? baseWidth * 2 : baseWidth);
                        const threshold = Math.max(4, lineWidth / 2 + 3);
                        // Проверяем расстояние до каждого сегмента
                        for (let j = 0; j < pts.length - 1; j++) {
                            const ax = pts[j].x * scaleX;
                            const ay = pts[j].y * scaleY;
                            const bx = pts[j + 1].x * scaleX;
                            const by = pts[j + 1].y * scaleY;
                            const dist = this._distancePointToSegment(local.x, local.y, ax, ay, bx, by);
                            if (dist <= threshold) {
                                // Найдём и вернём ID
                                for (const [objectId, pixiObject] of this.objects.entries()) {
                                    if (pixiObject === child) {
                                        return { type: 'object', object: objectId, pixiObject: child };
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return { type: 'empty' };
    }

    // Геометрические помощники/хит-тесты вынести в отдельный сервис при следующем рефакторинге
    _distancePointToSegment(px, py, ax, ay, bx, by) {
        const vectorABx = bx - ax;
        const vectorABy = by - ay;
        const vectorAPx = px - ax;
        const vectorAPy = py - ay;
        const squaredLengthAB = vectorABx * vectorABx + vectorABy * vectorABy;
        if (squaredLengthAB === 0) {
            return Math.hypot(px - ax, py - ay);
        }
        let t = (vectorAPx * vectorABx + vectorAPy * vectorABy) / squaredLengthAB;
        t = Math.max(0, Math.min(1, t));
        const closestX = ax + t * vectorABx;
        const closestY = ay + t * vectorABy;
        return Math.hypot(px - closestX, py - closestY);
    }

    destroy() {
        this.app.destroy(true);
    }
}