import { BaseTool } from '../BaseTool.js';

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
        this.originalBounds = null;
        
        // Состояние поворота
        this.isRotating = false;
        this.rotateCenter = null;
        this.originalAngle = 0;
        
        // Состояние рамки выделения
        this.isBoxSelect = false;
        this.selectionBox = null;
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
        // Получаем объекты из системы через событие
        const hitTestData = { x, y, result: null };
        this.emit('hit:test', hitTestData);
        
        if (hitTestData.result) {
            return hitTestData.result;
        }
        
        return { type: 'empty' };
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
        
        // TODO: Применить к объекту новые координаты
        // this.dragTarget.setPosition(newX, newY);
        
        this.emit('drag:update', { 
            object: this.dragTarget, 
            position: { x: newX, y: newY } 
        });
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
    startResize(handle, object) {
        this.isResizing = true;
        this.resizeHandle = handle;
        // TODO: Сохранить исходные размеры объекта
        
        this.emit('resize:start', { object, handle });
    }
    
    /**
     * Обновление изменения размера
     */
    updateResize(event) {
        // TODO: Вычислить новые размеры на основе handle и позиции мыши
        this.emit('resize:update', { 
            object: this.dragTarget,
            handle: this.resizeHandle,
            position: { x: event.x, y: event.y }
        });
    }
    
    /**
     * Завершение изменения размера
     */
    endResize() {
        this.emit('resize:end', { object: this.dragTarget });
        this.isResizing = false;
        this.resizeHandle = null;
    }
    
    /**
     * Начало поворота
     */
    startRotate(object) {
        this.isRotating = true;
        // TODO: Сохранить центр поворота и исходный угол
        
        this.emit('rotate:start', { object });
    }
    
    /**
     * Обновление поворота
     */
    updateRotate(event) {
        // TODO: Вычислить угол поворота
        this.emit('rotate:update', { 
            object: this.dragTarget,
            angle: 0 // TODO: вычислить угол
        });
    }
    
    /**
     * Завершение поворота
     */
    endRotate() {
        this.emit('rotate:end', { object: this.dragTarget });
        this.isRotating = false;
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
        this.selectedObjects.add(object);
        this.emit('selection:add', { object });
    }

    removeFromSelection(object) {
        this.selectedObjects.delete(object);
        this.emit('selection:remove', { object });
    }

    clearSelection() {
        const objects = Array.from(this.selectedObjects);
        this.selectedObjects.clear();
        this.emit('selection:clear', { objects });
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
}
