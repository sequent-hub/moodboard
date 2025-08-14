import * as PIXI from 'pixi.js';

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

        switch (objectData.type) {
            case 'frame':
                pixiObject = this.createFrame(objectData);
                break;
            case 'simple-text':
            case 'text':
                pixiObject = this.createText(objectData);
                break;
            case 'shape':
                pixiObject = this.createShape(objectData);
                break;
            case 'drawing':
                pixiObject = this.createDrawing(objectData);
                break;
            default:
                console.warn(`Unknown object type: ${objectData.type}`);
                pixiObject = this.createDefaultObject(objectData);
        }

        if (pixiObject) {
            pixiObject.x = objectData.position.x;
            pixiObject.y = objectData.position.y;
            pixiObject.eventMode = 'static'; // Исправляем deprecation warning
            pixiObject.cursor = 'pointer';
            // Сохраняем метаданные о типе и свойствах для последующих перерасчетов (resize)
            pixiObject._mb = {
                objectId: objectData.id,
                type: objectData.type,
                properties: objectData.properties || {}
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

            // Объекты над слоем сетки
            pixiObject.zIndex = (this.app.stage.children.length || 1) + 1;
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

    createFrame(objectData) {
        const graphics = new PIXI.Graphics();
        
        const borderWidth = 2;
        const width = objectData.width || 100;
        const height = objectData.height || 100;
        
        // Рамка с учетом толщины границы
        graphics.lineStyle(borderWidth, objectData.borderColor || 0x333333, 1);
        graphics.beginFill(objectData.backgroundColor || 0xFFFFFF, objectData.backgroundAlpha || 0.1);
        
        // Рисуем с отступом на половину толщины границы
        const halfBorder = borderWidth / 2;
        graphics.drawRect(halfBorder, halfBorder, width - borderWidth, height - borderWidth);
        graphics.endFill();

        return graphics;
    }

    createText(objectData) {
        const textStyle = new PIXI.TextStyle({
            fontFamily: objectData.fontFamily || 'Arial',
            fontSize: objectData.fontSize || 16,
            fill: objectData.color || 0x000000,
            fontWeight: objectData.fontWeight || 'normal',
            fontStyle: objectData.fontStyle || 'normal'
        });

        const text = new PIXI.Text(objectData.content || 'Sample Text', textStyle);
        return text;
    }

    createShape(objectData) {
        const graphics = new PIXI.Graphics();
        const color = objectData.color || 0x3b82f6;
        const w = objectData.width || 50;
        const h = objectData.height || 50;
        const kind = (objectData.properties && objectData.properties.kind) || objectData.shape || 'square';

        graphics.beginFill(color);
        switch (kind) {
            case 'circle': {
                const r = Math.min(w, h) / 2;
                graphics.drawCircle(w / 2, h / 2, r);
                break;
            }
            case 'rounded': {
                const r = (objectData.properties && objectData.properties.cornerRadius) || 10;
                graphics.drawRoundedRect(0, 0, w, h, r);
                break;
            }
            case 'triangle': {
                graphics.moveTo(w / 2, 0);
                graphics.lineTo(w, h);
                graphics.lineTo(0, h);
                graphics.lineTo(w / 2, 0);
                break;
            }
            case 'diamond': {
                graphics.moveTo(w / 2, 0);
                graphics.lineTo(w, h / 2);
                graphics.lineTo(w / 2, h);
                graphics.lineTo(0, h / 2);
                graphics.lineTo(w / 2, 0);
                break;
            }
            case 'parallelogram': {
                const skew = Math.min(w * 0.25, 20);
                graphics.moveTo(skew, 0);
                graphics.lineTo(w, 0);
                graphics.lineTo(w - skew, h);
                graphics.lineTo(0, h);
                graphics.lineTo(skew, 0);
                break;
            }
            case 'arrow': {
                // Прямоугольник + треугольник
                const shaftH = Math.max(6, h * 0.3);
                const shaftY = (h - shaftH) / 2;
                graphics.drawRect(0, shaftY, w * 0.6, shaftH);
                graphics.moveTo(w * 0.6, 0);
                graphics.lineTo(w, h / 2);
                graphics.lineTo(w * 0.6, h);
                graphics.lineTo(w * 0.6, 0);
                break;
            }
            case 'square':
            default: {
                graphics.drawRect(0, 0, w, h);
                break;
            }
        }
        graphics.endFill();
        return graphics;
    }

    createDrawing(objectData) {
        const graphics = new PIXI.Graphics();
        const color = objectData.properties?.strokeColor ?? 0x111827;
        const width = objectData.properties?.strokeWidth ?? 2;
        const pts = Array.isArray(objectData.properties?.points) ? objectData.properties.points : [];

        graphics.lineStyle(width, color, 1);
        if (pts.length > 0) {
            if (pts.length < 3) {
                graphics.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) graphics.lineTo(pts[i].x, pts[i].y);
            } else {
                graphics.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length - 1; i++) {
                    const cx = pts[i].x, cy = pts[i].y;
                    const nx = pts[i + 1].x, ny = pts[i + 1].y;
                    const mx = (cx + nx) / 2, my = (cy + ny) / 2;
                    graphics.quadraticCurveTo(cx, cy, mx, my);
                }
                const pen = pts[pts.length - 2];
                const last = pts[pts.length - 1];
                graphics.quadraticCurveTo(pen.x, pen.y, last.x, last.y);
            }
        }
        return graphics;
    }

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

        // Сохраняем позицию
        const position = { x: pixiObject.x, y: pixiObject.y };
        
        console.log(`🎨 Обновляем размер объекта ${objectId}, тип: ${objectType}`);
        
        // Для Graphics объектов (рамки, фигуры) нужно пересоздать геометрию
        if (pixiObject instanceof PIXI.Graphics) {
            this.recreateGraphicsObject(pixiObject, size, position, objectType);
        } 
        // Для Text объектов изменяем размер шрифта
        else if (pixiObject instanceof PIXI.Text) {
            this.updateTextObjectSize(pixiObject, size);
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
        if (objectType === 'frame') {
            // Рамка
            const borderWidth = 2;
            pixiObject.lineStyle(borderWidth, 0x333333, 1);
            pixiObject.beginFill(0xFFFFFF, 0.1);
            
            const halfBorder = borderWidth / 2;
            pixiObject.drawRect(halfBorder, halfBorder, size.width - borderWidth, size.height - borderWidth);
            pixiObject.endFill();
        } else if (objectType === 'shape') {
            // Фигура: сохраняем вид из _mb.properties.kind
            const meta = pixiObject._mb || {};
            const props = meta.properties || {};
            const color = 0x3b82f6;
            const w = size.width;
            const h = size.height;
            pixiObject.beginFill(color, 1);
            switch (props.kind) {
                case 'circle': {
                    const r = Math.min(w, h) / 2;
                    pixiObject.drawCircle(w / 2, h / 2, r);
                    break;
                }
                case 'rounded': {
                    const r = props.cornerRadius || 10;
                    pixiObject.drawRoundedRect(0, 0, w, h, r);
                    break;
                }
                case 'triangle': {
                    pixiObject.moveTo(w / 2, 0);
                    pixiObject.lineTo(w, h);
                    pixiObject.lineTo(0, h);
                    pixiObject.lineTo(w / 2, 0);
                    break;
                }
                case 'diamond': {
                    pixiObject.moveTo(w / 2, 0);
                    pixiObject.lineTo(w, h / 2);
                    pixiObject.lineTo(w / 2, h);
                    pixiObject.lineTo(0, h / 2);
                    pixiObject.lineTo(w / 2, 0);
                    break;
                }
                case 'parallelogram': {
                    const skew = Math.min(w * 0.25, 20);
                    pixiObject.moveTo(skew, 0);
                    pixiObject.lineTo(w, 0);
                    pixiObject.lineTo(w - skew, h);
                    pixiObject.lineTo(0, h);
                    pixiObject.lineTo(skew, 0);
                    break;
                }
                case 'arrow': {
                    const shaftH = Math.max(6, h * 0.3);
                    const shaftY = (h - shaftH) / 2;
                    pixiObject.drawRect(0, shaftY, w * 0.6, shaftH);
                    pixiObject.moveTo(w * 0.6, 0);
                    pixiObject.lineTo(w, h / 2);
                    pixiObject.lineTo(w * 0.6, h);
                    pixiObject.lineTo(w * 0.6, 0);
                    break;
                }
                case 'square':
                default: {
                    pixiObject.drawRect(0, 0, w, h);
                    break;
                }
            }
            pixiObject.endFill();
        } else if (objectType === 'drawing') {
            // Рисунок: перерисовываем по сохранённым точкам с масштабированием под новый size
            const meta = pixiObject._mb || {};
            const props = meta.properties || {};
            const color = props.strokeColor ?? 0x111827;
            const widthPx = props.strokeWidth ?? 2;
            const pts = Array.isArray(props.points) ? props.points : [];
            const baseW = props.baseWidth || size.width || 1;
            const baseH = props.baseHeight || size.height || 1;
            const scaleX = baseW ? (size.width / baseW) : 1;
            const scaleY = baseH ? (size.height / baseH) : 1;
            pixiObject.lineStyle(widthPx, color, 1);
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
        pixiObject.pivot.set(pivotX, pivotY);
        // Позицию не меняем здесь; она будет установлена вызывающей стороной
    }

    /**
     * Обновить размер текстового объекта
     */
    updateTextObjectSize(textObject, size) {
        // Для текстовых объектов адаптируем размер шрифта к новой высоте
        const fontSize = Math.max(12, Math.min(size.height / 2, size.width / 8));
        textObject.style.fontSize = fontSize;
        
        // Ограничиваем ширину текста
        textObject.style.wordWrap = true;
        textObject.style.wordWrapWidth = size.width - 10; // Небольшой отступ
    }

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
            }
        }
        
        return { type: 'empty' };
    }

    destroy() {
        this.app.destroy(true);
    }
}