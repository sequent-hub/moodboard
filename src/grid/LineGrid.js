import { BaseGrid } from './BaseGrid.js';

/**
 * Линейная прямоугольная сетка
 */
export class LineGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'line';
        
        // Дополнительные настройки для линейной сетки
        this.showSubGrid = options.showSubGrid ?? false;
        this.subGridDivisions = options.subGridDivisions || 4;
        this.subGridColor = options.subGridColor || 0xF0F0F0;
        this.subGridOpacity = options.subGridOpacity || 0.3;
    }
    
    /**
     * Создает визуальное представление линейной сетки
     */
    createVisual() {
        this.graphics.lineStyle(this.lineWidth, this.color, 1);
        
        // Основные линии сетки
        this.drawMainGrid();
        
        // Дополнительная подсетка
        if (this.showSubGrid) {
            this.drawSubGrid();
        }
    }
    
    /**
     * Рисует основную сетку
     */
    drawMainGrid() {
        // Вертикальные линии
        for (let x = 0; x <= this.width; x += this.size) {
            this.graphics.moveTo(x, 0);
            this.graphics.lineTo(x, this.height);
        }
        
        // Горизонтальные линии
        for (let y = 0; y <= this.height; y += this.size) {
            this.graphics.moveTo(0, y);
            this.graphics.lineTo(this.width, y);
        }
    }
    
    /**
     * Рисует подсетку (более мелкие линии)
     */
    drawSubGrid() {
        const subSize = this.size / this.subGridDivisions;
        
        this.graphics.lineStyle(1, this.subGridColor, this.subGridOpacity);
        
        // Вертикальные подлинии
        for (let x = subSize; x < this.width; x += subSize) {
            // Пропускаем основные линии
            if (x % this.size !== 0) {
                this.graphics.moveTo(x, 0);
                this.graphics.lineTo(x, this.height);
            }
        }
        
        // Горизонтальные подлинии
        for (let y = subSize; y < this.height; y += subSize) {
            // Пропускаем основные линии
            if (y % this.size !== 0) {
                this.graphics.moveTo(0, y);
                this.graphics.lineTo(this.width, y);
            }
        }
    }
    
    /**
     * Вычисляет точку привязки для линейной сетки
     */
    calculateSnapPoint(x, y) {
        const snapX = Math.round(x / this.size) * this.size;
        const snapY = Math.round(y / this.size) * this.size;
        
        return { x: snapX, y: snapY };
    }
    
    /**
     * Включает/выключает подсетку
     */
    setSubGridEnabled(enabled) {
        this.showSubGrid = enabled;
        this.updateVisual();
    }
    
    /**
     * Устанавливает количество делений подсетки
     */
    setSubGridDivisions(divisions) {
        this.subGridDivisions = Math.max(2, divisions);
        this.updateVisual();
    }
    
    /**
     * Сериализует настройки линейной сетки
     */
    serialize() {
        return {
            ...super.serialize(),
            showSubGrid: this.showSubGrid,
            subGridDivisions: this.subGridDivisions,
            subGridColor: this.subGridColor,
            subGridOpacity: this.subGridOpacity
        };
    }
}
