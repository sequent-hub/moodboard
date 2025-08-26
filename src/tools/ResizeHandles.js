/**
 * Система отображения ручек для изменения размера объектов
 * 
 * ⚠️ ВНИМАНИЕ: ДАННЫЙ МОМЕНТ НЕ ИСПОЛЬЗУЕТСЯ ⚠️
 * Сейчас используются HTML-ручки из HtmlHandlesLayer.js
 * Этот файл оставлен для совместимости и возможного использования в будущем
 */
import * as PIXI from 'pixi.js';

export class ResizeHandles {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.name = 'resize-handles';
        this.container.zIndex = 100000; // Поверх всех объектов в worldLayer
        // Размещаем контейнер ручек в worldLayer, чтобы он масштабировался вместе с доской
        const worldLayer = this.app.stage.getChildByName && this.app.stage.getChildByName('worldLayer');
        if (worldLayer) {
            worldLayer.addChild(this.container);
            worldLayer.sortableChildren = true;
        } else {
            this.app.stage.addChild(this.container);
            this.app.stage.sortableChildren = true;
        }
        
        this.handles = [];
        this.targetObject = null;
        this.targetBounds = null;
        
        // Настройки внешнего вида ручек
        this.handleSize = 12; // Увеличиваем размер для лучшего клика
        this.handleColor = 0x007ACC;
        this.handleHoverColor = 0x0099FF;
        this.borderColor = 0x007ACC;
        this.borderWidth = 1;
        
        // Настройки ручки вращения
        this.rotateHandleSize = 20; // Увеличиваем размер фона
        this.rotateHandleColor = 0x28A745; // Зеленый цвет
        this.rotateHandleHoverColor = 0x34CE57;
        this.rotateHandleOffset = 25; // Смещение от угла объекта
    }
    
    /**
     * Показать ручки для объекта
     */
    showHandles(pixiObject, objectId) {
        console.log(`👁️ showHandles вызван для ${objectId}`);
        this.hideHandles();
        
        this.targetObject = pixiObject;
        this.targetObjectId = objectId;
        this.updateHandles();
        this.container.visible = true;
        console.log(`👁️ Контейнер установлен как visible: ${this.container.visible}`);
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
        
        // Получаем локальные границы объекта (без учета трансформации)
        const localBounds = this.targetObject.getLocalBounds();
        
        // Синхронизируем поворот контейнера ручек с объектом
        if (this.targetObject.rotation !== undefined && this.targetObject.rotation !== 0) {
            this.container.rotation = this.targetObject.rotation;
            
            // Вычисляем позицию левого верхнего угла объекта в мировых координатах
            // Учитываем, что объект имеет pivot в центре
            const objectCenterX = this.targetObject.x;
            const objectCenterY = this.targetObject.y;
            const objectPivotX = this.targetObject.pivot ? this.targetObject.pivot.x : 0;
            const objectPivotY = this.targetObject.pivot ? this.targetObject.pivot.y : 0;
            
            // Позиция левого верхнего угла объекта = центр - pivot
            const objectTopLeftX = objectCenterX - objectPivotX;
            const objectTopLeftY = objectCenterY - objectPivotY;
            
            // Устанавливаем контейнер ручек так, чтобы он поворачивался вокруг центра объекта
            this.container.x = objectCenterX;
            this.container.y = objectCenterY;
            this.container.pivot.set(objectPivotX, objectPivotY);
            
            console.log(`🔄 Поворот ручек: ${(this.targetObject.rotation * 180 / Math.PI).toFixed(1)}°, центр: (${objectCenterX}, ${objectCenterY}), pivot: (${objectPivotX}, ${objectPivotY})`);
            
            // Используем локальные границы для создания ручек
            this.workingBounds = {
                x: localBounds.x,
                y: localBounds.y,
                width: localBounds.width,
                height: localBounds.height
            };
        } else {
            // Сбрасываем поворот если объект не повернут
            this.container.rotation = 0;
            const pivotX = this.targetObject.pivot ? this.targetObject.pivot.x : 0;
            const pivotY = this.targetObject.pivot ? this.targetObject.pivot.y : 0;
            // Если это специальная рамка группы — её x/y уже заданы как левый-верх в worldLayer
            if (this.targetObject.name === 'group-bounds') {
                this.container.x = this.targetObject.x;
                this.container.y = this.targetObject.y;
                this.container.pivot.set(0, 0);
                this.workingBounds = {
                    x: 0,
                    y: 0,
                    width: localBounds.width,
                    height: localBounds.height
                };
            } else {
                // Обычный объект: левый-верх = центр - pivot (в координатах worldLayer)
                const topLeftX = this.targetObject.x - pivotX;
                const topLeftY = this.targetObject.y - pivotY;
                this.container.x = topLeftX;
                this.container.y = topLeftY;
                this.container.pivot.set(0, 0);
                // Рабочие границы начинаются от (0,0) контейнера, размеры из локальных границ
                this.workingBounds = {
                    x: 0,
                    y: 0,
                    width: localBounds.width,
                    height: localBounds.height
                };
            }
        }
        
        // Создаем рамку выделения
        this.createSelectionBorder(this.workingBounds);
        
        // Создаем ручки по углам и сторонам относительно workingBounds (локальные координаты контейнера)
        const bounds = this.workingBounds;
        const x0 = bounds.x;
        const y0 = bounds.y;
        const x1 = bounds.x + bounds.width;
        const y1 = bounds.y + bounds.height;
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const handlePositions = [
            { type: 'nw', x: x0, y: y0, cursor: 'nw-resize' },
            { type: 'n',  x: cx, y: y0, cursor: 'n-resize' },
            { type: 'ne', x: x1, y: y0, cursor: 'ne-resize' },
            { type: 'e',  x: x1, y: cy, cursor: 'e-resize' },
            { type: 'se', x: x1, y: y1, cursor: 'se-resize' },
            { type: 's',  x: cx, y: y1, cursor: 's-resize' },
            { type: 'sw', x: x0, y: y1, cursor: 'sw-resize' },
            { type: 'w',  x: x0, y: cy, cursor: 'w-resize' }
        ];
        
        handlePositions.forEach(pos => {
            const handle = this.createHandle(pos.type, pos.x, pos.y, pos.cursor);
            this.handles.push(handle);
            this.container.addChild(handle);
        });
        
        // Создаем ручку вращения возле левого НИЖНЕГО угла рамки
        const rotateHandle = this.createRotateHandle(
            bounds.x, 
            bounds.y + bounds.height + this.rotateHandleOffset
        );
        this.handles.push(rotateHandle);
        this.container.addChild(rotateHandle);
        
        console.log(`🔄 Ручка вращения создана: x=${rotateHandle.x}, y=${rotateHandle.y}, visible=${rotateHandle.visible}, eventMode=${rotateHandle.eventMode}`);
        console.log(`📦 Контейнер ручек: zIndex=${this.container.zIndex}, visible=${this.container.visible}, children=${this.container.children.length}`);
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
        
        // Рисуем круглую ручку - синий круг с белой серединой
        this.drawCircularHandle(handle, this.handleColor);
        
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
            this.drawCircularHandle(handle, this.handleHoverColor);
        });
        
        handle.on('pointerout', () => {
            handle.clear();
            this.drawCircularHandle(handle, this.handleColor);
        });
        
        return handle;
    }
    
    /**
     * Рисует круглую ручку с синей обводкой и белой серединой
     */
    drawCircularHandle(graphics, outerColor) {
        const radius = this.handleSize / 2;
        const innerRadius = radius - 2; // Внутренний радиус меньше на 2 пикселя
        
        // Рисуем внешний синий круг
        graphics.beginFill(outerColor);
        graphics.drawCircle(0, 0, radius);
        graphics.endFill();
        
        // Рисуем внутренний белый круг
        graphics.beginFill(0xFFFFFF);
        graphics.drawCircle(0, 0, innerRadius);
        graphics.endFill();
    }
    
    /**
     * Создать ручку вращения с иконкой круговой стрелки
     */
    createRotateHandle(x, y) {
        const container = new PIXI.Container();
        
        // Создаем круглый фон
        const background = new PIXI.Graphics();
        background.beginFill(this.rotateHandleColor);
        background.lineStyle(1, 0xFFFFFF, 1);
        background.drawCircle(0, 0, this.rotateHandleSize / 2);
        background.endFill();
        
        // Создаем текстовую иконку (Unicode символ)
        const icon = new PIXI.Text('↻', {
            fontFamily: 'Arial, sans-serif',
            fontSize: this.rotateHandleSize - 4,
            fill: 0xFFFFFF,
            align: 'center'
        });
        
        // Центрируем иконку
        icon.anchor.set(0.5, 0.5);
        icon.x = 0;
        icon.y = 0;
        
        // Добавляем элементы в контейнер
        container.addChild(background);
        container.addChild(icon);
        
        // Позиционируем
        container.x = x;
        container.y = y;
        
        // Настраиваем интерактивность
        container.eventMode = 'static';
        container.cursor = 'grab';
        container.name = 'rotate-handle';
        container.zIndex = 2000;
        
        // Сохраняем тип ручки
        container.handleType = 'rotate';
        container.targetObjectId = this.targetObjectId;
        
        // Сохраняем ссылки на элементы для изменения цвета
        container._background = background;
        container._icon = icon;
        
        // Эффекты при наведении
        container.on('pointerover', () => {
            background.clear();
            background.beginFill(this.rotateHandleHoverColor);
            background.lineStyle(1, 0xFFFFFF, 1);
            background.drawCircle(0, 0, this.rotateHandleSize / 2);
            background.endFill();
            container.cursor = 'grab';
        });
        
        container.on('pointerout', () => {
            background.clear();
            background.beginFill(this.rotateHandleColor);
            background.lineStyle(1, 0xFFFFFF, 1);
            background.drawCircle(0, 0, this.rotateHandleSize / 2);
            background.endFill();
        });
        
        return container;
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
     * Проверить, является ли объект ручкой изменения размера или вращения
     */
    isResizeHandle(pixiObject) {
        return pixiObject && pixiObject.name && 
               (pixiObject.name.startsWith('resize-handle-') || pixiObject.name === 'rotate-handle');
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
        console.log(`🙈 temporaryHide вызван`);
        this.container.visible = false;
    }
    
    /**
     * Показать ручки снова
     */
    temporaryShow() {
        console.log(`👁️ temporaryShow вызван, targetObject: ${!!this.targetObject}`);
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
