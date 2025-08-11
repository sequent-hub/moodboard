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
            default:
                console.warn(`Unknown object type: ${objectData.type}`);
                pixiObject = this.createDefaultObject(objectData);
        }

        if (pixiObject) {
            pixiObject.x = objectData.position.x;
            pixiObject.y = objectData.position.y;
            pixiObject.eventMode = 'static'; // Исправляем deprecation warning
            pixiObject.cursor = 'pointer';
            
            // Убеждаемся, что объект может участвовать в hit testing
            if (pixiObject.beginFill) {
                // Для Graphics объектов убеждаемся, что у них есть fill
    
            }

            this.app.stage.addChild(pixiObject);
            this.objects.set(objectData.id, pixiObject);


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
        
        // Цветной квадрат/круг
        graphics.beginFill(objectData.color || 0x3b82f6);
        
        if (objectData.shape === 'circle') {
            graphics.drawCircle(
                (objectData.width || 50) / 2, 
                (objectData.height || 50) / 2, 
                (objectData.width || 50) / 2
            );
        } else {
            graphics.drawRect(0, 0, objectData.width || 50, objectData.height || 50);
        }
        
        graphics.endFill();
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
            this.app.stage.removeChild(pixiObject);
            this.objects.delete(objectId);
        }
    }

    /**
     * Поиск объекта в указанной позиции
     */
    hitTest(x, y) {
        // Hit test at coordinates
        
        // Получаем все объекты в позиции (PIXI автоматически учитывает трансформации)
        const point = new PIXI.Point(x, y);
        
        // Проходим по всем объектам от верхних к нижним
        for (let i = this.app.stage.children.length - 1; i >= 0; i--) {
            const child = this.app.stage.children[i];
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