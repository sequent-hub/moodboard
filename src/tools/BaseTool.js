/**
 * Базовый класс для всех инструментов MoodBoard
 */
import { Events } from '../core/events/Events.js';

export class BaseTool {
    constructor(name, eventBus) {
        this.name = name;
        this.eventBus = eventBus;
        this.isActive = false;
        this.cursor = 'default';
        this.hotkey = null;
        
        // Флаг состояния объекта
        this.destroyed = false;
        
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
        this.eventBus.emit(Events.Tool.Activated, { tool: this.name });
    }
    
    /**
     * Деактивация инструмента
     */
    deactivate() {
        this.isActive = false;
        this.onDeactivate();
        this.eventBus.emit(Events.Tool.Deactivated, { tool: this.name });
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
     * Контекстное меню (правая кнопка)
     * @param {Object} event - событие мыши {x, y}
     */
    onContextMenu(event) {
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
        // Поддержка как коротких имён ('hit:test'), так и полных ('tool:hit:test')
        const isQualified = eventName.startsWith('tool:');
        const name = isQualified ? eventName.slice(5) : eventName;

        // События, ожидающие мутацию объекта (передаем data напрямую)
        const passThrough = new Set([
            'hit:test',
            'get:object:position',
            'get:object:pixi',
            'get:object:size',
            'get:object:rotation',
            'get:all:objects',
            'find:object:by:position'
        ]);

        if (passThrough.has(name)) {
            const map = new Map([
                ['hit:test', Events.Tool.HitTest],
                ['get:object:position', Events.Tool.GetObjectPosition],
                ['get:object:pixi', Events.Tool.GetObjectPixi],
                ['get:object:size', Events.Tool.GetObjectSize],
                ['get:object:rotation', Events.Tool.GetObjectRotation],
                ['get:all:objects', Events.Tool.GetAllObjects],
                ['find:object:by:position', Events.Tool.FindObjectByPosition],
            ]);
            const evt = map.get(name) || `tool:${name}`;
            this.eventBus.emit(evt, data);
            return;
        }

        // Для остальных событий добавляем контекст инструмента
        const eventData = { tool: this.name, ...data };
        if (name.includes('rotate')) {
            console.log(`📡 BaseTool отправляет событие tool:${name}:`, eventData);
        }
        const map2 = new Map([
            ['drag:start', Events.Tool.DragStart],
            ['drag:update', Events.Tool.DragUpdate],
            ['drag:end', Events.Tool.DragEnd],
            ['group:drag:start', Events.Tool.GroupDragStart],
            ['group:drag:update', Events.Tool.GroupDragUpdate],
            ['group:drag:end', Events.Tool.GroupDragEnd],
            ['resize:start', Events.Tool.ResizeStart],
            ['resize:update', Events.Tool.ResizeUpdate],
            ['resize:end', Events.Tool.ResizeEnd],
            ['group:resize:start', Events.Tool.GroupResizeStart],
            ['group:resize:update', Events.Tool.GroupResizeUpdate],
            ['group:resize:end', Events.Tool.GroupResizeEnd],
            ['rotate:update', Events.Tool.RotateUpdate],
            ['rotate:end', Events.Tool.RotateEnd],
            ['group:rotate:start', Events.Tool.GroupRotateStart],
            ['group:rotate:update', Events.Tool.GroupRotateUpdate],
            ['group:rotate:end', Events.Tool.GroupRotateEnd],
            ['duplicate:request', Events.Tool.DuplicateRequest],
            ['context:menu:show', Events.Tool.ContextMenuShow],
            ['objects:delete', Events.Tool.ObjectsDelete],
            		['object:edit', Events.Tool.ObjectEdit],
		['update:object:content', Events.Tool.UpdateObjectContent],
		['hide:object:text', Events.Tool.HideObjectText],
		['show:object:text', Events.Tool.ShowObjectText],
            ['selection:add', Events.Tool.SelectionAdd],
            ['selection:remove', Events.Tool.SelectionRemove],
            ['selection:clear', Events.Tool.SelectionClear],
            ['selection:all', Events.Tool.SelectionAll],
        ]);
        const evt2 = map2.get(name) || `tool:${name}`;
        this.eventBus.emit(evt2, eventData);
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
        if (this.destroyed) {
            return;
        }
        
        this.destroyed = true;
        this.deactivate();
        this.eventBus = null;
    }
}
