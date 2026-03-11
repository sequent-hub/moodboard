import { BaseGrid } from './BaseGrid.js';

/**
 * Линейная прямоугольная сетка
 */
export class LineGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'line';
        
        // Дополнительные настройки для линейной сетки
        // Параметры не задаём по умолчанию здесь — их поставляет GridFactory.
        this.showSubGrid = options.showSubGrid;
        this.subGridDivisions = options.subGridDivisions;
        this.subGridColor = options.subGridColor;
        this.subGridOpacity = options.subGridOpacity;
        this.lineWidth = options.lineWidth;
        this.color = options.color;
        this.opacity = options.opacity;
    }
    
    /**
     * Создает визуальное представление линейной сетки
     */
    createVisual() {
        // Применяем непрозрачность на графику (умножится на alpha линий)
        if (typeof this.opacity === 'number') {
            this.graphics.alpha = this.opacity;
        }
        try {
            // В новых версиях можно указать alignment для большей чёткости
            this.graphics.lineStyle({ width: this.lineWidth, color: this.color, alpha: 1, alignment: 0.5 });
        } catch (_) {
            this.graphics.lineStyle(this.lineWidth, this.color, 1);
        }
        
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
        const b = this.getDrawBounds();
        const step = this.size;
        const half = this.lineWidth / 2;
        const startX = Math.floor(b.left / step) * step;
        const endX = Math.ceil(b.right / step) * step;
        const startY = Math.floor(b.top / step) * step;
        const endY = Math.ceil(b.bottom / step) * step;
        // Вертикальные линии
        for (let x = startX; x <= endX; x += step) {
            const px = Math.round(x) + (Number.isFinite(half) ? 0.5 : 0);
            this.graphics.moveTo(px, b.top);
            this.graphics.lineTo(px, b.bottom);
        }
        // Горизонтальные линии
        for (let y = startY; y <= endY; y += step) {
            const py = Math.round(y) + (Number.isFinite(half) ? 0.5 : 0);
            this.graphics.moveTo(b.left, py);
            this.graphics.lineTo(b.right, py);
        }
    }
    
    /**
     * Рисует подсетку (более мелкие линии)
     */
    drawSubGrid() {
        const subSize = this.size / this.subGridDivisions;
        try {
            this.graphics.lineStyle({ width: 0.5, color: this.subGridColor, alpha: this.subGridOpacity, alignment: 0.5 });
        } catch (_) {
            this.graphics.lineStyle(0.5, this.subGridColor, this.subGridOpacity);
        }
        const b = this.getDrawBounds();
        const startX = Math.floor(b.left / subSize) * subSize;
        const endX = Math.ceil(b.right / subSize) * subSize;
        const startY = Math.floor(b.top / subSize) * subSize;
        const endY = Math.ceil(b.bottom / subSize) * subSize;
        for (let x = startX; x <= endX; x += subSize) {
            if (x % this.size !== 0) {
                const px = Math.round(x) + 0.5;
                this.graphics.moveTo(px, b.top);
                this.graphics.lineTo(px, b.bottom);
            }
        }
        for (let y = startY; y <= endY; y += subSize) {
            if (y % this.size !== 0) {
                const py = Math.round(y) + 0.5;
                this.graphics.moveTo(b.left, py);
                this.graphics.lineTo(b.right, py);
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
