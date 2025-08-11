import { BaseTool } from '../BaseTool.js';
import { ResizeHandles } from '../ResizeHandles.js';
import * as PIXI from 'pixi.js';

/**
 * Инструмент выделения и работы с объектами
 * Основной инструмент для выделения, перемещения, изменения размера и поворота объектов
 */
export class SelectTool extends BaseTool {
    constructor(eventBus) {
        super('select', eventBus);
        this.cursor = 'default';
        this.hotkey = 'v';
        
        // Состояние выделения
        this.selectedObjects = new Set();
        this.isMultiSelect = false;
        
        // Состояние перетаскивания
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.dragTarget = null;
        
        // Состояние изменения размера
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.resizeStartMousePos = null;
        this.resizeStartPosition = null;
        
        // Система ручек изменения размера
        this.resizeHandles = null;
        
        // Текущие координаты мыши
        this.currentX = 0;
        this.currentY = 0;
        
        // Состояние поворота
        this.isRotating = false;
        this.rotateCenter = null;
        this.rotateStartAngle = 0;
        this.rotateCurrentAngle = 0;
        this.rotateStartMouseAngle = 0;
        
        // Состояние рамки выделения
        this.isBoxSelect = false;
        this.selectionBox = null;
    }
    
    /**
     * Активация инструмента
     */
    activate(app) {
        super.activate();
        console.log('🔧 SelectTool активирован, app:', !!app);
        
        // Инициализируем систему ручек изменения размера
        if (!this.resizeHandles && app) {
            console.log('✅ Создаем ResizeHandles');
            this.resizeHandles = new ResizeHandles(app);
        } else if (!app) {
            console.log('❌ PIXI app не передан в activate');
        } else {
            console.log('ℹ️ ResizeHandles уже созданы');
        }
    }
    
    /**
     * Деактивация инструмента
     */
    deactivate() {
        super.deactivate();
        
        // Очищаем выделение и ручки
        this.clearSelection();
        if (this.resizeHandles) {
            this.resizeHandles.hideHandles();
        }
    }
    
    /**
     * Нажатие кнопки мыши
     */
    onMouseDown(event) {
        super.onMouseDown(event);
        
        this.isMultiSelect = event.originalEvent.ctrlKey || event.originalEvent.metaKey;
        
        // Проверяем, что под курсором
        const hitResult = this.hitTest(event.x, event.y);
        
        if (hitResult.type === 'resize-handle') {
            this.startResize(hitResult.handle, hitResult.object);
        } else if (hitResult.type === 'rotate-handle') {
            this.startRotate(hitResult.object);
        } else if (hitResult.type === 'object') {
            console.log(`🎯 Клик по объекту: ${hitResult.object}`);
            this.handleObjectSelect(hitResult.object, event);
        } else {
            // Клик по пустому месту - начинаем рамку выделения
            this.startBoxSelect(event);
        }
    }
    
    /**
     * Перемещение мыши
     */
    onMouseMove(event) {
        super.onMouseMove(event);
        
        // Обновляем текущие координаты мыши
        this.currentX = event.x;
        this.currentY = event.y;
        
        if (this.isResizing) {
            this.updateResize(event);
        } else if (this.isRotating) {
            this.updateRotate(event);
        } else if (this.isDragging) {
            this.updateDrag(event);
        } else if (this.isBoxSelect) {
            this.updateBoxSelect(event);
        } else {
            // Обновляем курсор в зависимости от того, что под мышью
            this.updateCursor(event);
        }
    }
    
    /**
     * Отпускание кнопки мыши
     */
    onMouseUp(event) {
        if (this.isResizing) {
            this.endResize();
        } else if (this.isRotating) {
            this.endRotate();
        } else if (this.isDragging) {
            this.endDrag();
        } else if (this.isBoxSelect) {
            this.endBoxSelect();
        }
        
        super.onMouseUp(event);
    }
    
    /**
     * Двойной клик - переход в режим редактирования
     */
    onDoubleClick(event) {
        const hitResult = this.hitTest(event.x, event.y);
        
        if (hitResult.type === 'object') {
            this.editObject(hitResult.object);
        }
    }
    
    /**
     * Обработка клавиш
     */
    onKeyDown(event) {
        switch (event.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedObjects();
                break;
                
            case 'a':
                if (event.ctrlKey) {
                    this.selectAll();
                    event.originalEvent.preventDefault();
                }
                break;
                
            case 'Escape':
                this.clearSelection();
                break;
        }
    }
    
    /**
     * Тестирование попадания курсора
     */
    hitTest(x, y) {
        // Сначала проверяем ручки изменения размера (они имеют приоритет)
        if (this.resizeHandles) {
            const pixiObjectAtPoint = this.getPixiObjectAt(x, y);
            console.log(`🔍 getPixiObjectAt(${x}, ${y}) нашел:`, pixiObjectAtPoint ? pixiObjectAtPoint.name || 'unnamed' : 'null');
            
            const handleInfo = this.resizeHandles.getHandleInfo(pixiObjectAtPoint);
            if (handleInfo) {
                console.log(`✅ Найдена ручка:`, handleInfo.type);
                
                // Определяем тип ручки
                const hitType = handleInfo.type === 'rotate' ? 'rotate-handle' : 'resize-handle';
                
                return {
                    type: hitType,
                    handle: handleInfo.type,
                    object: handleInfo.targetObjectId,
                    pixiObject: handleInfo.handle
                };
            }
        }
        
        // Получаем объекты из системы через событие
        const hitTestData = { x, y, result: null };
        this.emit('hit:test', hitTestData);
        
        if (hitTestData.result && hitTestData.result.object) {
            return hitTestData.result;
        }
        
        return { type: 'empty' };
    }
    
    /**
     * Получить PIXI объект по координатам (для внутреннего использования)
     */
    getPixiObjectAt(x, y) {
        if (!this.resizeHandles || !this.resizeHandles.app) return null;
        
        const point = new PIXI.Point(x, y);
        
        // Сначала ищем в контейнере ручек (приоритет)
        if (this.resizeHandles.container.visible) {
            for (let i = this.resizeHandles.container.children.length - 1; i >= 0; i--) {
                const child = this.resizeHandles.container.children[i];
                
                // Проверяем обычные объекты
                if (child.containsPoint && child.containsPoint(point)) {
                    console.log(`🎯 Найдена ручка: ${child.name}`);
                    return child;
                }
                
                // Специальная проверка для контейнеров (ручка вращения)
                if (child instanceof PIXI.Container && child.children.length > 0) {
                    // Проверяем границы контейнера
                    const bounds = child.getBounds();
                    if (point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
                        point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
                        console.log(`🎯 Найден контейнер: ${child.name}`);
                        return child;
                    }
                }
            }
        }
        
        // Затем ищем в основной сцене
        const stage = this.resizeHandles.app.stage;
        for (let i = stage.children.length - 1; i >= 0; i--) {
            const child = stage.children[i];
            if (child !== this.resizeHandles.container && child.containsPoint && child.containsPoint(point)) {
                console.log(`🎯 Найден объект сцены: ${child.constructor.name}`);
                return child;
            }
        }
        
        console.log(`❌ Ничего не найдено под (${x}, ${y})`);
        return null;
    }
    
    /**
     * Обработка выделения объекта
     */
    handleObjectSelect(objectId, event) {
        if (!this.isMultiSelect) {
            this.clearSelection();
        }
        
        if (this.selectedObjects.has(objectId)) {
            if (this.isMultiSelect) {
                this.removeFromSelection(objectId);
            } else {
                // Начинаем перетаскивание
                this.startDrag(objectId, event);
            }
        } else {
            this.addToSelection(objectId);
            this.startDrag(objectId, event);
        }
    }
    
    /**
     * Начало перетаскивания
     */
    startDrag(objectId, event) {
        this.isDragging = true;
        this.dragTarget = objectId;
        
        // Получаем текущую позицию объекта
        const objectData = { objectId, position: null };
        this.emit('get:object:position', objectData);
        
        if (objectData.position) {
            this.dragOffset = {
                x: event.x - objectData.position.x,
                y: event.y - objectData.position.y
            };
        } else {
            this.dragOffset = { x: 0, y: 0 };
        }
        
        this.emit('drag:start', { object: objectId, position: { x: event.x, y: event.y } });
    }
    
    /**
     * Обновление перетаскивания
     */
    updateDrag(event) {
        if (!this.dragTarget) return;
        
        const newX = event.x - this.dragOffset.x;
        const newY = event.y - this.dragOffset.y;
        
        this.emit('drag:update', { 
            object: this.dragTarget, 
            position: { x: newX, y: newY } 
        });
        
        // Обновляем ручки во время перетаскивания
        if (this.resizeHandles && this.selectedObjects.has(this.dragTarget)) {
            this.resizeHandles.updateHandles();
        }
    }
    
    /**
     * Завершение перетаскивания
     */
    endDrag() {
        if (this.dragTarget) {
            this.emit('drag:end', { object: this.dragTarget });
        }
        
        this.isDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
    }
    
    /**
     * Начало изменения размера
     */
    startResize(handle, objectId) {
        console.log(`🔧 Начинаем resize: ручка ${handle}, объект ${objectId}`);
        
        this.isResizing = true;
        this.resizeHandle = handle;
        this.dragTarget = objectId; // Используем dragTarget для совместимости
        
        // Получаем данные объекта для сохранения начального состояния
        const sizeData = { objectId, size: null };
        this.emit('get:object:size', sizeData);
        
        // Получаем начальную позицию объекта
        const positionData = { objectId, position: null };
        this.emit('get:object:position', positionData);
        
        this.resizeStartBounds = sizeData.size || { width: 100, height: 100 };
        this.resizeStartMousePos = { x: this.currentX, y: this.currentY };
        this.resizeStartPosition = positionData.position || { x: 0, y: 0 };
        
        console.log(`📐 Начальный размер:`, this.resizeStartBounds);
        console.log(`📍 Начальная позиция мыши:`, this.resizeStartMousePos);
        console.log(`📍 Начальная позиция объекта:`, this.resizeStartPosition);
        
        // Временно скрываем ручки во время resize
        if (this.resizeHandles) {
            this.resizeHandles.temporaryHide();
        }
        
        this.emit('resize:start', { object: objectId, handle });
    }
    
    /**
     * Обновление изменения размера
     */
    updateResize(event) {
        if (!this.isResizing || !this.resizeStartBounds || !this.resizeStartMousePos) return;
        
        // Вычисляем изменение позиции мыши
        const deltaX = event.x - this.resizeStartMousePos.x;
        const deltaY = event.y - this.resizeStartMousePos.y;
        
        // Проверяем, зажат ли Shift для пропорционального изменения размера
        const maintainAspectRatio = event.originalEvent.shiftKey;
        
        // Вычисляем новые размеры в зависимости от типа ручки
        const newSize = this.calculateNewSize(
            this.resizeHandle, 
            this.resizeStartBounds, 
            deltaX, 
            deltaY, 
            maintainAspectRatio
        );
        
        // Ограничиваем минимальный размер
        newSize.width = Math.max(20, newSize.width);
        newSize.height = Math.max(20, newSize.height);
        
        // Вычисляем новую абсолютную позицию для левых/верхних ручек
        const positionOffset = this.calculatePositionOffset(
            this.resizeHandle, 
            this.resizeStartBounds, 
            newSize
        );
        
        // Вычисляем абсолютную позицию относительно начальной позиции
        const newPosition = {
            x: this.resizeStartPosition.x + positionOffset.x,
            y: this.resizeStartPosition.y + positionOffset.y
        };
        
        this.emit('resize:update', { 
            object: this.dragTarget,
            handle: this.resizeHandle,
            size: newSize,
            position: newPosition
        });
    }
    
    /**
     * Завершение изменения размера
     */
    endResize() {
        if (this.dragTarget && this.resizeStartBounds) {
            // Получаем финальный размер
            const finalSizeData = { objectId: this.dragTarget, size: null };
            this.emit('get:object:size', finalSizeData);
            
            // Получаем финальную позицию
            const finalPositionData = { objectId: this.dragTarget, position: null };
            this.emit('get:object:position', finalPositionData);
            
            this.emit('resize:end', { 
                object: this.dragTarget,
                oldSize: this.resizeStartBounds,
                newSize: finalSizeData.size || this.resizeStartBounds,
                oldPosition: this.resizeStartPosition,
                newPosition: finalPositionData.position || this.resizeStartPosition
            });
        }
        
        // Показываем ручки снова
        if (this.resizeHandles) {
            this.resizeHandles.temporaryShow();
            this.resizeHandles.updateHandles(); // Обновляем позицию ручек
        }
        
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.resizeStartMousePos = null;
        this.resizeStartPosition = null;
    }
    
    /**
     * Начало поворота
     */
    startRotate(objectId) {
        console.log(`🔄 Начинаем вращение объекта ${objectId}`);
        
        this.isRotating = true;
        this.dragTarget = objectId; // Используем dragTarget для совместимости
        
        // Получаем текущий угол объекта
        const rotationData = { objectId, rotation: 0 };
        this.emit('get:object:rotation', rotationData);
        this.rotateStartAngle = rotationData.rotation || 0;
        this.rotateCurrentAngle = this.rotateStartAngle;
        
        // Получаем позицию объекта для вычисления центра вращения
        const positionData = { objectId, position: null };
        this.emit('get:object:position', positionData);
        
        const sizeData = { objectId, size: null };
        this.emit('get:object:size', sizeData);
        
        if (positionData.position && sizeData.size) {
            // Центр объекта = позиция + половина размера
            this.rotateCenter = {
                x: positionData.position.x + sizeData.size.width / 2,
                y: positionData.position.y + sizeData.size.height / 2
            };
            
            // Вычисляем начальный угол мыши относительно центра
            this.rotateStartMouseAngle = Math.atan2(
                this.currentY - this.rotateCenter.y,
                this.currentX - this.rotateCenter.x
            );
            
            console.log(`📐 Центр вращения:`, this.rotateCenter);
            console.log(`📐 Начальный угол объекта: ${this.rotateStartAngle}°`);
            console.log(`📐 Начальный угол мыши: ${this.rotateStartMouseAngle * 180 / Math.PI}°`);
        }
        
        // Временно скрываем ручки во время вращения
        if (this.resizeHandles) {
            this.resizeHandles.temporaryHide();
        }
        
        this.emit('rotate:start', { object: objectId });
    }
    
    /**
     * Обновление поворота
     */
    updateRotate(event) {
        if (!this.isRotating || !this.rotateCenter) return;
        
        // Вычисляем текущий угол мыши относительно центра объекта
        const currentMouseAngle = Math.atan2(
            event.y - this.rotateCenter.y,
            event.x - this.rotateCenter.x
        );
        
        // Вычисляем разность углов (сколько повернула мышь)
        let deltaAngle = currentMouseAngle - this.rotateStartMouseAngle;
        
        // Нормализуем угол в диапазон -π до π
        while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        
        // Конвертируем в градусы
        let deltaAngleDegrees = deltaAngle * 180 / Math.PI;
        
        // Если зажат Shift - ступенчатое вращение (15° шаги)
        if (event.originalEvent.shiftKey) {
            deltaAngleDegrees = Math.round(deltaAngleDegrees / 15) * 15;
        }
        
        // Вычисляем финальный угол объекта
        this.rotateCurrentAngle = this.rotateStartAngle + deltaAngleDegrees;
        
        // Нормализуем угол объекта в диапазон 0-360°
        while (this.rotateCurrentAngle < 0) this.rotateCurrentAngle += 360;
        while (this.rotateCurrentAngle >= 360) this.rotateCurrentAngle -= 360;
        
        console.log(`🔄 Угол вращения: ${this.rotateCurrentAngle.toFixed(1)}° (delta: ${deltaAngleDegrees.toFixed(1)}°)`);
        
        this.emit('rotate:update', { 
            object: this.dragTarget,
            angle: this.rotateCurrentAngle
        });
    }
    
    /**
     * Завершение поворота
     */
    endRotate() {
        if (this.dragTarget && this.rotateStartAngle !== undefined) {
            console.log(`🏁 Завершаем вращение: ${this.rotateStartAngle}° → ${this.rotateCurrentAngle}°`);
            
            this.emit('rotate:end', { 
                object: this.dragTarget,
                oldAngle: this.rotateStartAngle,
                newAngle: this.rotateCurrentAngle
            });
        }
        
        // Показываем ручки снова
        if (this.resizeHandles) {
            this.resizeHandles.temporaryShow();
            this.resizeHandles.updateHandles(); // Обновляем позицию ручек
        }
        
        this.isRotating = false;
        this.rotateCenter = null;
        this.rotateStartAngle = 0;
        this.rotateCurrentAngle = 0;
        this.rotateStartMouseAngle = 0;
    }
    
    /**
     * Начало рамки выделения
     */
    startBoxSelect(event) {
        this.isBoxSelect = true;
        this.selectionBox = {
            startX: event.x,
            startY: event.y,
            endX: event.x,
            endY: event.y
        };
        
        if (!this.isMultiSelect) {
            this.clearSelection();
        }
    }
    
    /**
     * Обновление рамки выделения
     */
    updateBoxSelect(event) {
        if (!this.selectionBox) return;
        
        this.selectionBox.endX = event.x;
        this.selectionBox.endY = event.y;
        
        // TODO: Отрисовать рамку выделения
        // TODO: Выделить объекты, попадающие в рамку
    }
    
    /**
     * Завершение рамки выделения
     */
    endBoxSelect() {
        // TODO: Финализировать выделение объектов в рамке
        this.isBoxSelect = false;
        this.selectionBox = null;
    }
    
    /**
     * Обновление курсора
     */
    updateCursor(event) {
        const hitResult = this.hitTest(event.x, event.y);
        
        switch (hitResult.type) {
            case 'resize-handle':
                this.cursor = this.getResizeCursor(hitResult.handle);
                break;
            case 'rotate-handle':
                this.cursor = 'grab';
                break;
            case 'object':
                this.cursor = 'move';
                break;
            default:
                this.cursor = 'default';
        }
        
        this.setCursor();
    }
    
    /**
     * Получение курсора для ресайз-хендла
     */
    getResizeCursor(handle) {
        const cursors = {
            'nw': 'nw-resize',
            'n': 'n-resize',
            'ne': 'ne-resize',
            'e': 'e-resize',
            'se': 'se-resize',
            's': 's-resize',
            'sw': 'sw-resize',
            'w': 'w-resize'
        };
        
        return cursors[handle] || 'default';
    }
    
    /**
     * Управление выделением
     */
    
        addToSelection(object) {
        console.log(`➕ Добавляем в выделение: ${object}`);
        this.selectedObjects.add(object);
        this.emit('selection:add', { object });
        this.updateResizeHandles();
    }

    removeFromSelection(object) {
        this.selectedObjects.delete(object);
        this.emit('selection:remove', { object });
        this.updateResizeHandles();
    }

    clearSelection() {
        const objects = Array.from(this.selectedObjects);
        this.selectedObjects.clear();
        this.emit('selection:clear', { objects });
        this.updateResizeHandles();
    }
    
    selectAll() {
        // TODO: Выделить все объекты на доске
        this.emit('selection:all');
    }
    
    deleteSelectedObjects() {
        const objects = Array.from(this.selectedObjects);
        this.clearSelection();
        this.emit('objects:delete', { objects });
    }
    
    editObject(object) {
        this.emit('object:edit', { object });
    }
    
    /**
     * Получение информации о выделении
     */
    getSelection() {
        return Array.from(this.selectedObjects);
    }
    
    hasSelection() {
        return this.selectedObjects.size > 0;
    }
    
    /**
     * Обновление ручек изменения размера
     */
    updateResizeHandles() {
        if (!this.resizeHandles) {
            console.log('❌ ResizeHandles не инициализированы');
            return;
        }
        
        // Показываем ручки только для одного выделенного объекта
        if (this.selectedObjects.size === 1) {
            const objectId = Array.from(this.selectedObjects)[0];
            const pixiObjectData = { objectId, pixiObject: null };
            
            // Получаем PIXI объект
            this.emit('get:object:pixi', pixiObjectData);
            
            if (pixiObjectData.pixiObject) {
                this.resizeHandles.showHandles(pixiObjectData.pixiObject, objectId);
            }
        } else {
            this.resizeHandles.hideHandles();
        }
    }
    
    /**
     * Вычисляет новые размеры объекта на основе типа ручки и смещения мыши
     */
    calculateNewSize(handleType, startBounds, deltaX, deltaY, maintainAspectRatio) {
        let newWidth = startBounds.width;
        let newHeight = startBounds.height;
        
        // Вычисляем изменения в зависимости от типа ручки
        switch (handleType) {
            case 'nw': // Северо-запад - левый верхний угол
                newWidth = startBounds.width - deltaX;  // влево = меньше ширина
                newHeight = startBounds.height - deltaY; // вверх = меньше высота
                break;
            case 'n': // Север - верхняя сторона
                newHeight = startBounds.height - deltaY; // вверх = меньше высота
                break;
            case 'ne': // Северо-восток - правый верхний угол
                newWidth = startBounds.width + deltaX;   // вправо = больше ширина
                newHeight = startBounds.height - deltaY; // вверх = меньше высота
                break;
            case 'e': // Восток - правая сторона
                newWidth = startBounds.width + deltaX;   // вправо = больше ширина
                break;
            case 'se': // Юго-восток - правый нижний угол
                newWidth = startBounds.width + deltaX;   // вправо = больше ширина
                newHeight = startBounds.height + deltaY; // вниз = больше высота
                break;
            case 's': // Юг - нижняя сторона
                newHeight = startBounds.height + deltaY; // вниз = больше высота
                break;
            case 'sw': // Юго-запад - левый нижний угол
                newWidth = startBounds.width - deltaX;   // влево = меньше ширина
                newHeight = startBounds.height + deltaY; // вниз = больше высота
                break;
            case 'w': // Запад - левая сторона
                newWidth = startBounds.width - deltaX;   // влево = меньше ширина
                break;
        }
        

        
        // Поддержка пропорционального изменения размера (Shift)
        if (maintainAspectRatio) {
            const aspectRatio = startBounds.width / startBounds.height;
            
            // Определяем, какую сторону использовать как основную
            if (['nw', 'ne', 'sw', 'se'].includes(handleType)) {
                // Угловые ручки - используем большее изменение
                const widthChange = Math.abs(newWidth - startBounds.width);
                const heightChange = Math.abs(newHeight - startBounds.height);
                
                if (widthChange > heightChange) {
                    newHeight = newWidth / aspectRatio;
                } else {
                    newWidth = newHeight * aspectRatio;
                }
            } else if (['e', 'w'].includes(handleType)) {
                // Горизонтальные ручки
                newHeight = newWidth / aspectRatio;
            } else if (['n', 's'].includes(handleType)) {
                // Вертикальные ручки
                newWidth = newHeight * aspectRatio;
            }
        }
        
        return {
            width: Math.round(newWidth),
            height: Math.round(newHeight)
        };
    }
    
    /**
     * Вычисляет смещение позиции при изменении размера через левые/верхние ручки
     */
    calculatePositionOffset(handleType, startBounds, newSize) {
        let offsetX = 0;
        let offsetY = 0;
        
        // При изменении размера через левые ручки объект должен сдвинуться 
        // так, чтобы правый край остался на месте
        if (['nw', 'w', 'sw'].includes(handleType)) {
            // Если размер уменьшился, объект сдвигается вправо
            // Если размер увеличился, объект сдвигается влево
            offsetX = -(newSize.width - startBounds.width);
        }
        
        // При изменении размера через верхние ручки объект должен сдвинуться
        // так, чтобы нижний край остался на месте  
        if (['nw', 'n', 'ne'].includes(handleType)) {
            // Если размер уменьшился, объект сдвигается вниз
            // Если размер увеличился, объект сдвигается вверх
            offsetY = -(newSize.height - startBounds.height);
        }
        
        console.log(`📍 Position offset для ручки ${handleType}: (${offsetX}, ${offsetY})`);
        console.log(`📊 Размер изменился с (${startBounds.width}, ${startBounds.height}) на (${newSize.width}, ${newSize.height})`);
        
        return { x: offsetX, y: offsetY };
    }
}
