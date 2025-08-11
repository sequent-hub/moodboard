import { BaseTool } from '../BaseTool.js';

/**
 * Инструмент панорамирования (перемещения) по доске
 */
export class PanTool extends BaseTool {
    constructor(eventBus) {
        super('pan', eventBus);
        this.cursor = 'grab';
        this.hotkey = ' '; // Пробел
        
        // Состояние панорамирования
        this.isPanning = false;
        this.lastPosition = null;
        this.totalDelta = { x: 0, y: 0 };
        
        // Настройки панорамирования
        this.panSpeed = 1.0;
        this.inertia = false;
        this.inertiaDecay = 0.95;
        this.minInertiaSpeed = 0.1;
    }
    
    /**
     * Начало панорамирования
     */
    onMouseDown(event) {
        super.onMouseDown(event);
        
        if (event.button === 0) { // Левая кнопка мыши
            this.startPanning(event);
        }
    }
    
    /**
     * Перемещение во время панорамирования
     */
    onMouseMove(event) {
        super.onMouseMove(event);
        
        if (this.isPanning) {
            this.updatePanning(event);
        }
    }
    
    /**
     * Завершение панорамирования
     */
    onMouseUp(event) {
        if (this.isPanning) {
            this.endPanning(event);
        }
        
        super.onMouseUp(event);
    }
    
    /**
     * Обработка колесика мыши для панорамирования
     */
    onMouseWheel(event) {
        // Панорамирование колесиком с зажатым Shift
        if (event.shiftKey) {
            const delta = {
                x: event.delta * 0.5,
                y: 0
            };
            
            this.panBy(delta);
            event.originalEvent.preventDefault();
        }
        // Вертикальное панорамирование обычным колесиком (если не зажат Ctrl)
        else if (!event.ctrlKey) {
            const delta = {
                x: 0,
                y: event.delta * 0.5
            };
            
            this.panBy(delta);
            event.originalEvent.preventDefault();
        }
    }
    
    /**
     * Обработка клавиш для панорамирования стрелками
     */
    onKeyDown(event) {
        const panStep = event.shiftKey ? 50 : 10; // Больший шаг с Shift
        
        switch (event.key) {
            case 'ArrowLeft':
                this.panBy({ x: panStep, y: 0 });
                event.originalEvent.preventDefault();
                break;
                
            case 'ArrowRight':
                this.panBy({ x: -panStep, y: 0 });
                event.originalEvent.preventDefault();
                break;
                
            case 'ArrowUp':
                this.panBy({ x: 0, y: panStep });
                event.originalEvent.preventDefault();
                break;
                
            case 'ArrowDown':
                this.panBy({ x: 0, y: -panStep });
                event.originalEvent.preventDefault();
                break;
                
            case 'Home':
                this.resetPan();
                event.originalEvent.preventDefault();
                break;
        }
    }
    
    /**
     * Начинает панорамирование
     */
    startPanning(event) {
        this.isPanning = true;
        this.lastPosition = { x: event.x, y: event.y };
        this.totalDelta = { x: 0, y: 0 };
        this.cursor = 'grabbing';
        this.setCursor();
        
        this.emit('pan:start', {
            startPosition: { ...this.lastPosition }
        });
    }
    
    /**
     * Обновляет панорамирование
     */
    updatePanning(event) {
        if (!this.lastPosition) return;
        
        const delta = {
            x: (event.x - this.lastPosition.x) * this.panSpeed,
            y: (event.y - this.lastPosition.y) * this.panSpeed
        };
        
        this.totalDelta.x += delta.x;
        this.totalDelta.y += delta.y;
        
        this.panBy(delta);
        
        this.lastPosition = { x: event.x, y: event.y };
    }
    
    /**
     * Завершает панорамирование
     */
    endPanning(event) {
        this.isPanning = false;
        this.cursor = 'grab';
        this.setCursor();
        
        this.emit('pan:end', {
            totalDelta: { ...this.totalDelta },
            endPosition: { x: event.x, y: event.y }
        });
        
        // Запускаем инерцию если включена
        if (this.inertia && this.lastPosition) {
            this.startInertia(event);
        }
        
        this.lastPosition = null;
        this.totalDelta = { x: 0, y: 0 };
    }
    
    /**
     * Панорамирование на указанное смещение
     */
    panBy(delta) {
        this.emit('pan:update', {
            delta: { ...delta }
        });
    }
    
    /**
     * Панорамирование к указанной точке
     */
    panTo(x, y, animated = false) {
        this.emit('pan:to', {
            position: { x, y },
            animated
        });
    }
    
    /**
     * Сброс панорамирования к начальной позиции
     */
    resetPan(animated = true) {
        this.emit('pan:reset', { animated });
    }
    
    /**
     * Центрирование доски
     */
    centerBoard(animated = true) {
        this.emit('pan:center', { animated });
    }
    
    /**
     * Подгонка доски под размер экрана
     */
    fitToScreen(animated = true) {
        this.emit('pan:fit', { animated });
    }
    
    /**
     * Запуск инерции панорамирования
     */
    startInertia(event) {
        if (!this.lastPosition) return;
        
        // Вычисляем скорость на основе последнего движения
        const velocity = {
            x: (event.x - this.lastPosition.x) * 0.1,
            y: (event.y - this.lastPosition.y) * 0.1
        };
        
        // Запускаем анимацию инерции
        this.animateInertia(velocity);
    }
    
    /**
     * Анимация инерции
     */
    animateInertia(velocity) {
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        
        if (speed < this.minInertiaSpeed) {
            return; // Останавливаем инерцию
        }
        
        // Применяем текущую скорость
        this.panBy(velocity);
        
        // Уменьшаем скорость
        velocity.x *= this.inertiaDecay;
        velocity.y *= this.inertiaDecay;
        
        // Продолжаем анимацию на следующем фрейме
        requestAnimationFrame(() => this.animateInertia(velocity));
    }
    
    /**
     * Включение/выключение инерции
     */
    setInertia(enabled) {
        this.inertia = enabled;
    }
    
    /**
     * Установка скорости панорамирования
     */
    setPanSpeed(speed) {
        this.panSpeed = Math.max(0.1, Math.min(5.0, speed));
    }
    
    /**
     * Проверка, идет ли панорамирование
     */
    isPanningActive() {
        return this.isPanning;
    }
    
    /**
     * Получение текущих настроек
     */
    getSettings() {
        return {
            ...super.getSettings(),
            panSpeed: this.panSpeed,
            inertia: this.inertia,
            inertiaDecay: this.inertiaDecay
        };
    }
    
    /**
     * Активация инструмента
     */
    onActivate() {
        super.onActivate();
        
        // Показываем подсказку при активации
        this.emit('tool:hint', {
            message: 'Drag to pan • Arrow keys to move • Home to reset • Shift+Wheel for horizontal pan'
        });
    }
    
    /**
     * Деактивация инструмента
     */
    onDeactivate() {
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPosition = null;
        }
        
        super.onDeactivate();
    }
}
