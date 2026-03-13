import { BaseGrid } from './BaseGrid.js';
import { getScreenAnchor } from './ScreenGridPhaseMachine.js';

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
        const { screenStep } = this.getScreenGridState();
        const step = Math.max(1, screenStep);
        const worldX = this.viewportTransform?.worldX || 0;
        const worldY = this.viewportTransform?.worldY || 0;
        const anchorX = getScreenAnchor(worldX, step);
        const anchorY = getScreenAnchor(worldY, step);
        const half = this.lineWidth / 2;
        const alignStart = (min, anchor) => {
            const d = ((anchor - min) % step + step) % step;
            return min + d;
        };
        const startX = alignStart(b.left, anchorX);
        const endX = b.right + step;
        const startY = alignStart(b.top, anchorY);
        const endY = b.bottom + step;
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
        const { screenStep } = this.getScreenGridState();
        const subSize = Math.max(1, screenStep / this.subGridDivisions);
        try {
            this.graphics.lineStyle({ width: 0.5, color: this.subGridColor, alpha: this.subGridOpacity, alignment: 0.5 });
        } catch (_) {
            this.graphics.lineStyle(0.5, this.subGridColor, this.subGridOpacity);
        }
        const b = this.getDrawBounds();
        const worldX = this.viewportTransform?.worldX || 0;
        const worldY = this.viewportTransform?.worldY || 0;
        const anchorX = getScreenAnchor(worldX, subSize);
        const anchorY = getScreenAnchor(worldY, subSize);
        const alignStart = (min, anchor) => {
            const d = ((anchor - min) % subSize + subSize) % subSize;
            return min + d;
        };
        const startX = alignStart(b.left, anchorX);
        const endX = b.right + subSize;
        const startY = alignStart(b.top, anchorY);
        const endY = b.bottom + subSize;
        const majorStep = Math.max(1, screenStep);
        const majorAnchorX = getScreenAnchor(worldX, majorStep);
        const majorAnchorY = getScreenAnchor(worldY, majorStep);
        const isOnMajor = (value, major, anchor) => {
            const rel = (value - anchor) / major;
            return Math.abs(rel - Math.round(rel)) < 1e-4;
        };
        for (let x = startX; x <= endX; x += subSize) {
            if (!isOnMajor(x, majorStep, majorAnchorX)) {
                const px = Math.round(x) + 0.5;
                this.graphics.moveTo(px, b.top);
                this.graphics.lineTo(px, b.bottom);
            }
        }
        for (let y = startY; y <= endY; y += subSize) {
            if (!isOnMajor(y, majorStep, majorAnchorY)) {
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
