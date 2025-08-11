/**
 * Базовый класс для всех инструментов MoodBoard
 */
export class BaseTool {
    constructor(name, eventBus) {
        this.name = name;
        this.eventBus = eventBus;
        this.isActive = false;
        this.cursor = 'default';
        this.hotkey = null;
        
        // Состояние инструмента
        this.isPressed = false;
        this.startPoint = null;
        this.currentPoint = null;
    }
    
    /**
     * Активация инструмента
     */
    activate() {
        this.isActive = true;
        this.onActivate();
        this.setCursor();
        this.eventBus.emit('tool:activated', { tool: this.name });
    }
    
    /**
     * Деактивация инструмента
     */
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
        this.eventBus.emit('tool:deactivated', { tool: this.name });
    }
    
    /**
     * Устанавливает курсор для инструмента
     */
    setCursor() {
        if (typeof document !== 'undefined' && document.body) {
            document.body.style.cursor = this.cursor;
        }
    }
    
    /**
     * Обработчики событий мыши - переопределяются в дочерних классах
     */
    
    /**
     * Нажатие кнопки мыши
     * @param {Object} event - событие мыши {x, y, button, target}
     */
    onMouseDown(event) {
        this.isPressed = true;
        this.startPoint = { x: event.x, y: event.y };
        this.currentPoint = { x: event.x, y: event.y };
    }
    
    /**
     * Перемещение мыши
     * @param {Object} event - событие мыши {x, y, target}
     */
    onMouseMove(event) {
        this.currentPoint = { x: event.x, y: event.y };
    }
    
    /**
     * Отпускание кнопки мыши
     * @param {Object} event - событие мыши {x, y, button, target}
     */
    onMouseUp(event) {
        this.isPressed = false;
        this.startPoint = null;
        this.currentPoint = null;
    }
    
    /**
     * Двойной клик
     * @param {Object} event - событие мыши {x, y, target}
     */
    onDoubleClick(event) {
        // Переопределяется в дочерних классах
    }
    
    /**
     * Колесико мыши
     * @param {Object} event - событие {x, y, delta, ctrlKey}
     */
    onMouseWheel(event) {
        // Переопределяется в дочерних классах
    }
    
    /**
     * Обработчики клавиатуры
     */
    
    /**
     * Нажатие клавиши
     * @param {Object} event - событие клавиатуры {key, ctrlKey, shiftKey, altKey}
     */
    onKeyDown(event) {
        // Переопределяется в дочерних классах
    }
    
    /**
     * Отпускание клавиши
     * @param {Object} event - событие клавиатуры {key}
     */
    onKeyUp(event) {
        // Переопределяется в дочерних классах
    }
    
    /**
     * Методы жизненного цикла инструмента
     */
    
    /**
     * Вызывается при активации инструмента
     */
    onActivate() {
        // Переопределяется в дочерних классах
    }
    
    /**
     * Вызывается при деактивации инструмента
     */
    onDeactivate() {
        // Переопределяется в дочерних классах
    }
    
    /**
     * Вспомогательные методы
     */
    
    /**
     * Вычисляет расстояние между двумя точками
     */
    getDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Проверяет, находится ли точка в пределах области
     */
    isPointInBounds(point, bounds) {
        return point.x >= bounds.x && 
               point.x <= bounds.x + bounds.width &&
               point.y >= bounds.y && 
               point.y <= bounds.y + bounds.height;
    }
    
    /**
     * Эмитит событие инструмента
     */
    emit(eventName, data) {
        // Для событий, которые ожидают изменения data по ссылке, передаем data напрямую
        if (eventName === 'hit:test' || eventName === 'get:object:position') {
            this.eventBus.emit(`tool:${eventName}`, data);
        } else {
            // Для остальных событий создаем новый объект с полем tool
            this.eventBus.emit(`tool:${eventName}`, {
                tool: this.name,
                ...data
            });
        }
    }
    
    /**
     * Получает настройки инструмента
     */
    getSettings() {
        return {
            name: this.name,
            cursor: this.cursor,
            hotkey: this.hotkey,
            isActive: this.isActive
        };
    }
    
    /**
     * Очистка ресурсов инструмента
     */
    destroy() {
        this.deactivate();
        this.eventBus = null;
    }
}
