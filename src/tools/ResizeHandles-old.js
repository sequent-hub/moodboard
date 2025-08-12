/**
 * Система отображения ручек для изменения размера объектов
 */
import * as PIXI from 'pixi.js';

export class ResizeHandles {
    constructor(app) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.name = 'resize-handles';
        this.container.zIndex = 10000; // МАКСИМАЛЬНЫЙ zIndex - поверх всех объектов!
        this.container.sortableChildren = true; // Включаем сортировку И в самом контейнере ручек!
        this.app.stage.addChild(this.container);
        
        // Включаем сортировку по zIndex
        this.app.stage.sortableChildren = true;
        
        console.log(`🔧 Контейнер ручек создан: zIndex=${this.container.zIndex}, sortableChildren=${this.app.stage.sortableChildren}`);
        
        this.handles = [];
        this.selectionBorder = null; // Рамка выделения (всегда видима)
        this.targetObject = null;
        this.targetBounds = null;
        
        // Настройки внешнего вида ручек
        this.handleSize = 24; // УВЕЛИЧИВАЕМ размер ручек в 2 раза!
        this.handleColor = 0x007ACC;
        this.handleHoverColor = 0x0099FF;
        this.borderColor = 0x007ACC;
        this.borderWidth = 2; // И ширину границы тоже
        
        // Настройки ручки вращения
        this.rotateHandleSize = 40; // УВЕЛИЧИВАЕМ размер ручки вращения в 2 раза!
        this.rotateHandleColor = 0x28A745; // Зеленый цвет
        this.rotateHandleHoverColor = 0x34CE57;
        this.rotateHandleOffset = 25; // Смещение от угла объекта
    }
    
    /**
     * Показать ручки для объекта
     */
    showHandles(pixiObject, objectId) {
        console.log(`🔧 ResizeHandles.showHandles для ${objectId}`);
        console.log(`👁️ ПЕРЕД hideHandles: container.visible = ${this.container.visible}`);
        // ТЕСТ: Отключаем hideHandles() чтобы контейнер не скрывался!
        // this.hideHandles();
        this.clearHandles(); // Только очищаем ручки, но не скрываем контейнер
        console.log(`👁️ ПОСЛЕ clearHandles: container.visible = ${this.container.visible}`);
        
        this.targetObject = pixiObject;
        this.targetObjectId = objectId;
        
        // Показываем встроенную рамку объекта
        if (pixiObject && pixiObject._selectionBorder) {
            console.log(`✅ Показываем встроенную рамку для ${objectId}`);
            pixiObject._selectionBorder.visible = true;
        } else {
            console.log(`❌ Встроенная рамка не найдена для ${objectId}`);
        }
        
        console.log(`👁️ ПЕРЕД updateHandles: container.visible = ${this.container.visible}`);
        this.updateHandles();
        console.log(`👁️ ПОСЛЕ updateHandles: container.visible = ${this.container.visible}`);
        this.container.visible = true;
        
        // ТЕСТ: Принудительно делаем контейнер всегда видимым!
        setTimeout(() => {
            this.container.visible = true;
            console.log(`🔄 TIMEOUT: Принудительно показали контейнер: visible = ${this.container.visible}`);
        }, 100);
        console.log(`👁️ ФИНАЛ showHandles: container.visible = ${this.container.visible}`);
        console.log(`📦 Контейнер ручек: visible=${this.container.visible}, children=${this.container.children.length}`);
    }
    
    /**
     * Скрыть ручки
     */
    hideHandles() {
        // Скрываем встроенную рамку предыдущего объекта
        if (this.targetObject && this.targetObject._selectionBorder) {
            this.targetObject._selectionBorder.visible = false;
        }
        
        this.container.visible = false;
        this.targetObject = null;
        this.targetObjectId = null;
        this.clearHandles();
    }
    
    /**
     * Обновить позицию ручек
     */
    updateHandles() {
        if (!this.targetObject) {
            console.log(`❌ updateHandles: targetObject не установлен`);
            return;
        }
        
        console.log(`🔧 updateHandles для объекта ${this.targetObjectId}`);
        this.clearHandles();
        
        // Получаем границы объекта (контейнера)
        const globalBounds = this.targetObject.getBounds();
        this.targetBounds = globalBounds;
        console.log(`📏 Границы объекта:`, globalBounds);
        console.log(`🎯 Координаты объекта: x=${this.targetObject.x}, y=${this.targetObject.y}, pivot.x=${this.targetObject.pivot?.x}, pivot.y=${this.targetObject.pivot?.y}`);
        
        // Синхронизируем контейнер ручек с контейнером объекта
        this.container.rotation = this.targetObject.rotation || 0;
        
        // ИСПОЛЬЗУЕМ КООРДИНАТЫ ГРАНИЦ объекта для правильного позиционирования!
        // Контейнер ручек должен быть в верхнем левом углу границ объекта
        this.container.x = globalBounds.x;
        this.container.y = globalBounds.y;
        this.container.pivot.set(0, 0); // Контейнер ручек без pivot - ручки в абсолютных координатах
        
        console.log(`📍 СИНХРОНИЗАЦИЯ: Объект(${this.targetObject.x}, ${this.targetObject.y}) -> Контейнер(${this.container.x}, ${this.container.y})`);
        
        // Получаем размеры для создания ручек (в локальных координатах)
        // Контейнер ручек теперь позиционирован в верхнем левом углу границ объекта
        const width = globalBounds.width;
        const height = globalBounds.height;
        
        this.workingBounds = {
            x: 0,           // Ручки начинаются с (0,0) в контейнере
            y: 0,           // Ручки начинаются с (0,0) в контейнере
            width: width,   // Ширина из границ объекта
            height: height  // Высота из границ объекта
        };
        
        console.log(`📐 Рабочие границы:`, this.workingBounds);
        
        // Рамка выделения теперь встроена в объект
        
        // Создаем ручки по углам и сторонам
        const bounds = this.workingBounds;
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
        
        console.log(`🔧 Создаем ${handlePositions.length} ручек resize`);
        console.log(`📍 Позиции ручек:`, handlePositions.map(p => `${p.type}:(${p.x},${p.y})`).join(', '));
        handlePositions.forEach(pos => {
            const handle = this.createHandle(pos.type, pos.x, pos.y, pos.cursor);
            this.handles.push(handle);
            this.container.addChild(handle);
        });
        
        // Создаем ручку вращения возле левого нижнего угла (вращается с объектом)
        console.log(`🔄 Создаем ручку вращения`);
        const rotateHandle = this.createRotateHandle(
            bounds.x - this.rotateHandleOffset, 
            bounds.y + bounds.height + this.rotateHandleOffset
        );
        this.handles.push(rotateHandle);
        this.container.addChild(rotateHandle);
        
        console.log(`✅ Создано ручек: ${this.handles.length}, контейнер детей: ${this.container.children.length}`);
        console.log(`📍 Позиция контейнера ручек: x=${this.container.x}, y=${this.container.y}, rotation=${this.container.rotation}`);
        console.log(`📍 Pivot контейнера ручек: x=${this.container.pivot.x}, y=${this.container.pivot.y}`);
        console.log(`📍 Контейнер ручек на сцене:`, this.container.parent ? 'ДА' : 'НЕТ');
        console.log(`🎭 zIndex контейнера ручек: ${this.container.zIndex}`);
        
        // ПРОВЕРИМ ВСЕ ОБЪЕКТЫ НА СЦЕНЕ и их zIndex
        if (this.container.parent) {
            console.log(`🎭 Объекты на сцене:`);
            this.container.parent.children.forEach((child, index) => {
                console.log(`  ${index}: ${child.name || 'unnamed'} - zIndex: ${child.zIndex || 0}, visible: ${child.visible}`);
            });
                }
        
        console.log(`👁️ КОНЕЦ updateHandles: container.visible = ${this.container.visible}`);
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
        
        // Сохраняем ссылку на рамку
        this.selectionBorder = border;
        
        this.container.addChild(border);
    }
    
    /**
     * Создать ручку изменения размера
     */
    createHandle(type, x, y, cursor) {
        console.log(`🔧 Создаем ручку ${type} в позиции (${x}, ${y})`);
        const handle = new PIXI.Graphics();
        
        // ТЕСТ: Создаем ОЧЕНЬ ЯРКУЮ и БОЛЬШУЮ ручку для видимости!
        handle.beginFill(0xFF0000); // КРАСНЫЙ цвет!
        handle.lineStyle(3, 0x00FF00, 1); // ЗЕЛЕНАЯ граница!
        handle.drawRect(
            -this.handleSize / 2, 
            -this.handleSize / 2, 
            this.handleSize, 
            this.handleSize
        );
        handle.endFill();
        
        // ДОПОЛНИТЕЛЬНО: Добавим желтый круг в центре
        handle.beginFill(0xFFFF00); // ЖЕЛТЫЙ!
        handle.drawCircle(0, 0, 4);
        handle.endFill();
        
        // Позиционируем
        handle.x = x;
        handle.y = y;
        
        // Настраиваем интерактивность
        handle.eventMode = 'static';
        handle.cursor = cursor;
        handle.name = `resize-handle-${type}`;
        handle.zIndex = 20000; // МАКСИМАЛЬНЫЙ zIndex для ручек
        
        console.log(`✅ Ручка ${type} создана: размер=${this.handleSize}, цвет=${this.handleColor.toString(16)}`);
        
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
     * Создать ручку вращения с иконкой круговой стрелки
     */
    createRotateHandle(x, y) {
        console.log(`🔄 Создаем ручку вращения в позиции (${x}, ${y})`);
        
        // ТЕСТ: Создаем ПРОСТУЮ ручку без контейнера!
        const handle = new PIXI.Graphics();
        
        // ОЧЕНЬ ЯРКИЙ круг!
        handle.beginFill(0xFF00FF); // МАГЕНТА!
        handle.lineStyle(5, 0x000000, 1); // ЧЕРНАЯ жирная граница!
        handle.drawCircle(0, 0, this.rotateHandleSize / 2);
        handle.endFill();
        
        // Позиционируем
        handle.x = x;
        handle.y = y;
        
        // Настраиваем интерактивность
        handle.eventMode = 'static';
        handle.cursor = 'grab';
        handle.name = 'rotate-handle';
        handle.zIndex = 20000; // МАКСИМАЛЬНЫЙ zIndex для ручки вращения
        
        // Сохраняем тип ручки
        handle.handleType = 'rotate';
        handle.targetObjectId = this.targetObjectId;
        
        console.log(`✅ Ручка вращения создана: размер=${this.rotateHandleSize}, цвет=ff00ff`);
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
     * Обновить только рамку выделения (без пересоздания ручек)
     * Используется во время вращения для обновления рамки в реальном времени
     */
    updateSelectionBorderOnly() {
        // Рамка теперь встроена в объект и автоматически вращается с ним
        // Ничего делать не нужно!
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
