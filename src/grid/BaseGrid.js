import * as PIXI from 'pixi.js';

/**
 * Базовый класс для всех типов сеток
 */
export class BaseGrid {
    constructor(options = {}) {
        this.type = 'base';
        this.enabled = options.enabled ?? false;
        // Значения параметров визуала не задаём по умолчанию здесь.
        // Они должны приходить из GridFactory.getDefaultOptions(type).
        this.size = options.size;
        this.color = options.color;
        this.opacity = options.opacity;
        this.lineWidth = options.lineWidth;
        
        // Размеры области отрисовки
        this.width = options.width || 1920;
        this.height = options.height || 1080;
        
        // PIXI графика
        this.graphics = new PIXI.Graphics();
        if (typeof this.opacity === 'number') {
            this.graphics.alpha = this.opacity;
        }
        
        // Настройки привязки
        this.snapEnabled = options.snapEnabled ?? true;
        this.snapTolerance = options.snapTolerance || 10;
    }
    
    /**
     * Создает визуальное представление сетки
     * Должен быть переопределен в дочерних классах
     */
    createVisual() {
        throw new Error('createVisual() должен быть реализован в дочернем классе');
    }
    
    /**
     * Обновляет визуальное представление
     */
    updateVisual() {
        this.graphics.clear();
        if (this.enabled) {
            this.createVisual();
        }
    }
    
    /**
     * Привязывает точку к сетке
     * @param {number} x - координата X
     * @param {number} y - координата Y
     * @returns {Object} - новые координаты {x, y}
     */
    snapToGrid(x, y) {
        if (!this.snapEnabled) {
            return { x, y };
        }
        
        return this.calculateSnapPoint(x, y);
    }
    
    /**
     * Вычисляет точку привязки к сетке
     * Должен быть переопределен в дочерних классах
     */
    calculateSnapPoint(x, y) {
        return { x, y };
    }
    
    /**
     * Находит ближайшие линии сетки
     * @param {number} x - координата X
     * @param {number} y - координата Y
     * @returns {Object} - информация о ближайших линиях
     */
    findNearestGridLines(x, y) {
        return {
            vertical: Math.round(x / this.size) * this.size,
            horizontal: Math.round(y / this.size) * this.size,
            distance: {
                x: Math.abs(x % this.size),
                y: Math.abs(y % this.size)
            }
        };
    }
    
    /**
     * Проверяет, находится ли точка в зоне привязки
     */
    isInSnapZone(x, y) {
        const nearest = this.findNearestGridLines(x, y);
        return nearest.distance.x <= this.snapTolerance || 
               nearest.distance.y <= this.snapTolerance;
    }
    
    /**
     * Включает/выключает сетку
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.updateVisual();
    }
    
    /**
     * Устанавливает размер сетки
     */
    setSize(size) {
        this.size = Math.max(1, size);
        this.updateVisual();
    }
    
    /**
     * Устанавливает цвет сетки
     */
    setColor(color) {
        this.color = color;
        this.updateVisual();
    }
    
    /**
     * Устанавливает прозрачность
     */
    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
        this.graphics.alpha = this.opacity;
    }
    
    /**
     * Изменяет размеры области отрисовки
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.updateVisual();
    }
    
    /**
     * Возвращает PIXI объект для рендеринга
     */
    getPixiObject() {
        return this.graphics;
    }
    
    /**
     * Сериализует настройки сетки
     */
    serialize() {
        return {
            type: this.type,
            enabled: this.enabled,
            size: this.size,
            color: this.color,
            opacity: this.opacity,
            lineWidth: this.lineWidth,
            snapEnabled: this.snapEnabled,
            snapTolerance: this.snapTolerance
        };
    }
    
    /**
     * Очищает ресурсы
     */
    destroy() {
        this.graphics.destroy();
    }
}
