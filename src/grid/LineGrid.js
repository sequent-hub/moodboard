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
        this.subGridColor = options.subGridColor || 0xE3E3E3;
        this.subGridOpacity = options.subGridOpacity || 0.45;
        // Более тонкие основные линии и более контрастные
        this.lineWidth = Math.max(0.5, (options.lineWidth || this.lineWidth) / 2);
        this.color = options.color || 0xB0B0B0;
        this.opacity = options.opacity || 0.9;
    }
    
    /**
     * Создает визуальное представление линейной сетки
     */
    createVisual() {
        // Применяем непрозрачность на графику (умножится на alpha линий)
        this.graphics.alpha = this.opacity;
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
        const w = this.width;
        const h = this.height;
        const step = this.size;
        const half = this.lineWidth / 2;
        // Выравниваем к половине пикселя для чётких линий на любых DPI
        // Вертикальные линии
        for (let x = 0; x <= w; x += step) {
            const px = Math.round(x) + (Number.isFinite(half) ? 0.5 : 0);
            this.graphics.moveTo(px, 0);
            this.graphics.lineTo(px, h);
        }
        
        // Горизонтальные линии
        for (let y = 0; y <= h; y += step) {
            const py = Math.round(y) + (Number.isFinite(half) ? 0.5 : 0);
            this.graphics.moveTo(0, py);
            this.graphics.lineTo(w, py);
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
        const w = this.width;
        const h = this.height;
        // Вертикальные подлинии
        for (let x = subSize; x < w; x += subSize) {
            if (x % this.size !== 0) {
                const px = Math.round(x) + 0.5;
                this.graphics.moveTo(px, 0);
                this.graphics.lineTo(px, h);
            }
        }
        
        // Горизонтальные подлинии
        for (let y = subSize; y < h; y += subSize) {
            if (y % this.size !== 0) {
                const py = Math.round(y) + 0.5;
                this.graphics.moveTo(0, py);
                this.graphics.lineTo(w, py);
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
