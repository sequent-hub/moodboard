/**
 * Система отображения ручек для изменения размера объектов
 */
import * as PIXI from 'pixi.js';

export class ResizeHandles {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.name = 'resize-handles';
        this.container.zIndex = 1000; // Поверх всех объектов
        this.app.stage.addChild(this.container);
        
        // Включаем сортировку по zIndex
        this.app.stage.sortableChildren = true;
        
        this.handles = [];
        this.targetObject = null;
        this.targetBounds = null;
        
        // Настройки внешнего вида ручек
        this.handleSize = 12; // Увеличиваем размер для лучшего клика
        this.handleColor = 0x007ACC;
        this.handleHoverColor = 0x0099FF;
        this.borderColor = 0x007ACC;
        this.borderWidth = 1;
    }
    
    /**
     * Показать ручки для объекта
     */
    showHandles(pixiObject, objectId) {
        this.hideHandles();
        
        this.targetObject = pixiObject;
        this.targetObjectId = objectId;
        this.updateHandles();
        this.container.visible = true;
    }
    
    /**
     * Скрыть ручки
     */
    hideHandles() {
        this.container.visible = false;
        this.targetObject = null;
        this.targetObjectId = null;
        this.clearHandles();
    }
    
    /**
     * Обновить позицию ручек
     */
    updateHandles() {
        if (!this.targetObject) return;
        
        this.clearHandles();
        
        // Получаем границы объекта
        const bounds = this.targetObject.getBounds();
        this.targetBounds = bounds;
        
        // Создаем рамку выделения
        this.createSelectionBorder(bounds);
        
        // Создаем ручки по углам и сторонам
        const handlePositions = [
            { type: 'nw', x: bounds.x, y: bounds.y, cursor: 'nw-resize' },
            { type: 'n', x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'n-resize' },
            { type: 'ne', x: bounds.x + bounds.width, y: bounds.y, cursor: 'ne-resize' },
            { type: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'e-resize' },
            { type: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'se-resize' },
            { type: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 's-resize' },
            { type: 'sw', x: bounds.x, y: bounds.y + bounds.height, cursor: 'sw-resize' },
            { type: 'w', x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'w-resize' }
        ];
        
        handlePositions.forEach(pos => {
            const handle = this.createHandle(pos.type, pos.x, pos.y, pos.cursor);
            this.handles.push(handle);
            this.container.addChild(handle);
        });
    }
    
    /**
     * Создать рамку выделения
     */
    createSelectionBorder(bounds) {
        const border = new PIXI.Graphics();
        border.lineStyle(this.borderWidth, this.borderColor, 0.8);
        border.drawRect(0, 0, bounds.width, bounds.height);
        border.x = bounds.x;
        border.y = bounds.y;
        border.name = 'selection-border';
        
        this.container.addChild(border);
    }
    
    /**
     * Создать ручку изменения размера
     */
    createHandle(type, x, y, cursor) {
        const handle = new PIXI.Graphics();
        
        // Рисуем квадратную ручку
        handle.beginFill(this.handleColor);
        handle.lineStyle(1, 0xFFFFFF, 1);
        handle.drawRect(
            -this.handleSize / 2, 
            -this.handleSize / 2, 
            this.handleSize, 
            this.handleSize
        );
        handle.endFill();
        
        // Позиционируем
        handle.x = x;
        handle.y = y;
        
        // Настраиваем интерактивность
        handle.eventMode = 'static';
        handle.cursor = cursor;
        handle.name = `resize-handle-${type}`;
        handle.zIndex = 2000; // Еще выше чем контейнер
        
        // Сохраняем тип ручки
        handle.handleType = type;
        handle.targetObjectId = this.targetObjectId;
        
        // Эффекты при наведении
        handle.on('pointerover', () => {
            handle.clear();
            handle.beginFill(this.handleHoverColor);
            handle.lineStyle(1, 0xFFFFFF, 1);
            handle.drawRect(
                -this.handleSize / 2, 
                -this.handleSize / 2, 
                this.handleSize, 
                this.handleSize
            );
            handle.endFill();
        });
        
        handle.on('pointerout', () => {
            handle.clear();
            handle.beginFill(this.handleColor);
            handle.lineStyle(1, 0xFFFFFF, 1);
            handle.drawRect(
                -this.handleSize / 2, 
                -this.handleSize / 2, 
                this.handleSize, 
                this.handleSize
            );
            handle.endFill();
        });
        
        return handle;
    }
    
    /**
     * Очистить все ручки
     */
    clearHandles() {
        this.container.removeChildren();
        this.handles = [];
        this.targetBounds = null;
    }
    
    /**
     * Проверить, является ли объект ручкой изменения размера
     */
    isResizeHandle(pixiObject) {
        return pixiObject && pixiObject.name && pixiObject.name.startsWith('resize-handle-');
    }
    
    /**
     * Получить информацию о ручке
     */
    getHandleInfo(pixiObject) {
        if (!this.isResizeHandle(pixiObject)) {
            return null;
        }
        
        return {
            type: pixiObject.handleType,
            targetObjectId: pixiObject.targetObjectId,
            handle: pixiObject
        };
    }
    
    /**
     * Временно скрыть ручки (например, во время перетаскивания)
     */
    temporaryHide() {
        this.container.visible = false;
    }
    
    /**
     * Показать ручки снова
     */
    temporaryShow() {
        if (this.targetObject) {
            this.container.visible = true;
        }
    }
    
    /**
     * Уничтожить систему ручек
     */
    destroy() {
        this.hideHandles();
        if (this.container.parent) {
            this.container.parent.removeChild(this.container);
        }
        this.container.destroy();
    }
}
