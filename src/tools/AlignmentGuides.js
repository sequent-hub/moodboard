import * as PIXI from 'pixi.js';
import { Events } from '../core/events/Events.js';

/**
 * AlignmentGuides - система направляющих линий для выравнивания объектов
 * Показывает пунктирные линии когда объекты выравниваются друг с другом при перетаскивании
 */
export class AlignmentGuides {
    constructor(eventBus, pixiApp, getObjectsFunction) {
        this.eventBus = eventBus;
        this.pixiApp = pixiApp;
        this.getObjects = getObjectsFunction; // Функция для получения всех объектов
        
        // Контейнер для направляющих линий
        this.guidesContainer = new PIXI.Container();
        this.guidesContainer.name = 'alignmentGuides';
        this.guidesContainer.zIndex = 1000; // Выше остальных объектов
        
        // Добавляем в слой мира
        if (this.pixiApp.stage.getChildByName('worldLayer')) {
            this.pixiApp.stage.getChildByName('worldLayer').addChild(this.guidesContainer);
        } else {
            this.pixiApp.stage.addChild(this.guidesContainer);
        }
        
        // Текущие направляющие
        this.activeGuides = [];
        
        // Порог срабатывания (пиксели)
        this.snapThreshold = 3;
        
        // Состояние перетаскивания
        this.isDragging = false;
        this.currentDragObject = null;
        this.currentDragObjects = [];
        
        this._attachEvents();
        
        console.log('AlignmentGuides: Инициализированы направляющие линии выравнивания');
    }

    _attachEvents() {
        // Одиночное перетаскивание
        this.eventBus.on(Events.Tool.DragStart, (data) => {
            console.log('AlignmentGuides: Начало перетаскивания объекта:', data.object);
            this.isDragging = true;
            this.currentDragObject = data.object;
            this.currentDragObjects = [];
        });

        this.eventBus.on(Events.Tool.DragUpdate, (data) => {
            if (this.isDragging && this.currentDragObject) {
                this._updateGuides(data.object, data.position);
            }
        });

        this.eventBus.on(Events.Tool.DragEnd, () => {
            this.isDragging = false;
            this.currentDragObject = null;
            this.currentDragObjects = [];
            this._clearGuides();
        });

        // Групповое перетаскивание
        this.eventBus.on(Events.Tool.GroupDragStart, (data) => {
            this.isDragging = true;
            this.currentDragObject = null;
            this.currentDragObjects = data.objects || [];
        });

        this.eventBus.on(Events.Tool.GroupDragUpdate, (data) => {
            if (this.isDragging && this.currentDragObjects.length > 0) {
                this._updateGroupGuides(data.objects, data.delta);
            }
        });

        this.eventBus.on(Events.Tool.GroupDragEnd, () => {
            this.isDragging = false;
            this.currentDragObject = null;
            this.currentDragObjects = [];
            this._clearGuides();
        });
    }

    _updateGuides(dragObjectId, newPosition) {
        // Очищаем старые направляющие
        this._clearGuides();
        
        if (!this.getObjects) return;
        
        const allObjects = this.getObjects();
        const dragObject = allObjects.find(obj => obj.id === dragObjectId);
        if (!dragObject) {
            console.warn('AlignmentGuides: Перетаскиваемый объект не найден:', dragObjectId);
            return;
        }

        // Вычисляем границы перетаскиваемого объекта
        const dragBounds = this._getObjectBounds(dragObject, newPosition);
        if (!dragBounds) {
            console.warn('AlignmentGuides: Не удалось получить границы перетаскиваемого объекта');
            return;
        }
        
        // Ищем совпадения с другими объектами
        const guides = [];
        
        for (const obj of allObjects) {
            if (obj.id === dragObjectId) continue; // Пропускаем сам перетаскиваемый объект
            
            const objBounds = this._getObjectBounds(obj);
            if (!objBounds) continue;
            
            // Проверяем совпадения по горизонтали
            const horizontalGuides = this._checkHorizontalAlignment(dragBounds, objBounds);
            guides.push(...horizontalGuides);
            
            // Проверяем совпадения по вертикали  
            const verticalGuides = this._checkVerticalAlignment(dragBounds, objBounds);
            guides.push(...verticalGuides);
        }
        
        // Отображаем найденные направляющие
        if (guides.length > 0) {
            console.log('AlignmentGuides: Найдено направляющих:', guides.length);
            this._showGuides(guides);
        }
    }

    _updateGroupGuides(dragObjectIds, delta) {
        // Для группового перетаскивания пока упрощенная логика
        // TODO: Реализовать более сложную логику для групп
        this._clearGuides();
    }

    _getObjectBounds(objectData, customPosition = null) {
        try {
            const position = customPosition || objectData.position || { x: 0, y: 0 };
            
            // Размеры могут быть на верхнем уровне объекта или в properties
            const width = objectData.width || 
                         (objectData.properties && objectData.properties.width) || 
                         100;
            const height = objectData.height || 
                          (objectData.properties && objectData.properties.height) || 
                          100;
            
            return {
                left: position.x,
                right: position.x + width,
                top: position.y,
                bottom: position.y + height,
                centerX: position.x + width / 2,
                centerY: position.y + height / 2,
                width: width,
                height: height
            };
        } catch (error) {
            console.warn('AlignmentGuides: Не удалось получить границы объекта:', objectData);
            return null;
        }
    }

    _checkHorizontalAlignment(dragBounds, objBounds) {
        const guides = [];
        
        // Проверяем выравнивание по левому краю
        if (Math.abs(dragBounds.left - objBounds.left) <= this.snapThreshold) {
            guides.push({
                type: 'vertical',
                x: objBounds.left,
                y1: Math.min(dragBounds.top, objBounds.top) - 20,
                y2: Math.max(dragBounds.bottom, objBounds.bottom) + 20
            });
        }
        
        // Проверяем выравнивание по правому краю
        if (Math.abs(dragBounds.right - objBounds.right) <= this.snapThreshold) {
            guides.push({
                type: 'vertical',
                x: objBounds.right,
                y1: Math.min(dragBounds.top, objBounds.top) - 20,
                y2: Math.max(dragBounds.bottom, objBounds.bottom) + 20
            });
        }
        
        // Проверяем выравнивание по центру по горизонтали
        if (Math.abs(dragBounds.centerX - objBounds.centerX) <= this.snapThreshold) {
            guides.push({
                type: 'vertical',
                x: objBounds.centerX,
                y1: Math.min(dragBounds.top, objBounds.top) - 20,
                y2: Math.max(dragBounds.bottom, objBounds.bottom) + 20
            });
        }
        
        return guides;
    }

    _checkVerticalAlignment(dragBounds, objBounds) {
        const guides = [];
        
        // Проверяем выравнивание по верхнему краю
        if (Math.abs(dragBounds.top - objBounds.top) <= this.snapThreshold) {
            guides.push({
                type: 'horizontal',
                y: objBounds.top,
                x1: Math.min(dragBounds.left, objBounds.left) - 20,
                x2: Math.max(dragBounds.right, objBounds.right) + 20
            });
        }
        
        // Проверяем выравнивание по нижнему краю
        if (Math.abs(dragBounds.bottom - objBounds.bottom) <= this.snapThreshold) {
            guides.push({
                type: 'horizontal',
                y: objBounds.bottom,
                x1: Math.min(dragBounds.left, objBounds.left) - 20,
                x2: Math.max(dragBounds.right, objBounds.right) + 20
            });
        }
        
        // Проверяем выравнивание по центру по вертикали
        if (Math.abs(dragBounds.centerY - objBounds.centerY) <= this.snapThreshold) {
            guides.push({
                type: 'horizontal',
                y: objBounds.centerY,
                x1: Math.min(dragBounds.left, objBounds.left) - 20,
                x2: Math.max(dragBounds.right, objBounds.right) + 20
            });
        }
        
        return guides;
    }

    _showGuides(guides) {
        // Ограничиваем количество направляющих для производительности
        const maxGuides = 10;
        const guidesToShow = guides.slice(0, maxGuides);
        
        for (const guide of guidesToShow) {
            const line = this._createGuideLine(guide);
            if (line) {
                this.guidesContainer.addChild(line);
                this.activeGuides.push(line);
            }
        }
    }

    _createGuideLine(guide) {
        const graphics = new PIXI.Graphics();
        
        // Стиль пунктирной линии
        const color = 0xFF6B6B; // Красноватый цвет как в Figma
        const alpha = 0.8;
        const lineWidth = 1;
        
        graphics.lineStyle(lineWidth, color, alpha);
        
        if (guide.type === 'vertical') {
            // Вертикальная линия
            this._drawDashedLine(graphics, guide.x, guide.y1, guide.x, guide.y2);
        } else if (guide.type === 'horizontal') {
            // Горизонтальная линия
            this._drawDashedLine(graphics, guide.x1, guide.y, guide.x2, guide.y);
        }
        
        return graphics;
    }

    _drawDashedLine(graphics, x1, y1, x2, y2) {
        const dashLength = 5;
        const gapLength = 3;
        
        const totalLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        let currentLength = 0;
        let isDash = true;
        
        while (currentLength < totalLength) {
            const segmentLength = isDash ? dashLength : gapLength;
            const endLength = Math.min(currentLength + segmentLength, totalLength);
            
            const startX = x1 + currentLength * Math.cos(angle);
            const startY = y1 + currentLength * Math.sin(angle);
            const endX = x1 + endLength * Math.cos(angle);
            const endY = y1 + endLength * Math.sin(angle);
            
            if (isDash) {
                graphics.moveTo(startX, startY);
                graphics.lineTo(endX, endY);
            }
            
            currentLength = endLength;
            isDash = !isDash;
        }
    }

    _clearGuides() {
        // Удаляем все активные направляющие
        for (const guide of this.activeGuides) {
            if (guide.parent) {
                guide.parent.removeChild(guide);
            }
            guide.destroy();
        }
        this.activeGuides = [];
    }

    destroy() {
        this._clearGuides();
        
        if (this.guidesContainer && this.guidesContainer.parent) {
            this.guidesContainer.parent.removeChild(this.guidesContainer);
        }
        
        // Отписываемся от событий
        this.eventBus.off(Events.Tool.DragStart);
        this.eventBus.off(Events.Tool.DragUpdate);
        this.eventBus.off(Events.Tool.DragEnd);
        this.eventBus.off(Events.Tool.GroupDragStart);
        this.eventBus.off(Events.Tool.GroupDragUpdate);
        this.eventBus.off(Events.Tool.GroupDragEnd);
    }
}
