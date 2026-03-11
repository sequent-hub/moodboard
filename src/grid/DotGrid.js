import { BaseGrid } from './BaseGrid.js';

/**
 * Точечная сетка
 */
export class DotGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'dot';
        
        // Настройки точек
        this.dotSize = options.dotSize || 2;
        this.dotStyle = options.dotStyle || 'circle'; // 'circle' | 'square'
        this.highlightIntersections = options.highlightIntersections ?? true;
        // Пересечения делаем такими же, как обычные точки по умолчанию
        this.intersectionSize = options.intersectionSize || this.dotSize;
        this.intersectionColor = options.intersectionColor || this.color;
    }
    
    /**
     * Создает визуальное представление точечной сетки
     */
    createVisual() {
        // Рисуем обычные точки
        this.drawDots();
        
        // Выделение пересечений отключено для равномерного тона точек (как в Miro)
        // if (this.highlightIntersections) {
        //     this.drawIntersections();
        // }
    }
    
    /**
     * Рисует основные точки сетки
     */
    drawDots() {
        const b = this.getDrawBounds();
        const startX = Math.floor(b.left / this.size) * this.size;
        const startY = Math.floor(b.top / this.size) * this.size;
        const endX = Math.ceil(b.right / this.size) * this.size;
        const endY = Math.ceil(b.bottom / this.size) * this.size;
        this.graphics.beginFill(this.color);
        for (let x = startX; x <= endX; x += this.size) {
            for (let y = startY; y <= endY; y += this.size) {
                this.drawDot(x, y, this.dotSize);
            }
        }
        this.graphics.endFill();
    }
    
    /**
     * Рисует выделенные пересечения (каждые 5 точек)
     */
    drawIntersections() {
        const intersectionStep = this.size * 5;
        const b = this.getDrawBounds();
        const startX = Math.floor(b.left / intersectionStep) * intersectionStep;
        const startY = Math.floor(b.top / intersectionStep) * intersectionStep;
        const endX = Math.ceil(b.right / intersectionStep) * intersectionStep;
        const endY = Math.ceil(b.bottom / intersectionStep) * intersectionStep;
        this.graphics.beginFill(this.color);
        for (let x = startX; x <= endX; x += intersectionStep) {
            for (let y = startY; y <= endY; y += intersectionStep) {
                this.drawDot(x, y, this.dotSize);
            }
        }
        this.graphics.endFill();
    }
    
    /**
     * Рисует одну точку
     */
    drawDot(x, y, size) {
        if (this.dotStyle === 'circle') {
            this.graphics.drawCircle(x, y, size);
        } else if (this.dotStyle === 'square') {
            const half = size;
            this.graphics.drawRect(x - half, y - half, half * 2, half * 2);
        }
    }
    
    /**
     * Вычисляет точку привязки для точечной сетки
     */
    calculateSnapPoint(x, y) {
        const snapX = Math.round(x / this.size) * this.size;
        const snapY = Math.round(y / this.size) * this.size;
        
        return { x: snapX, y: snapY };
    }
    
    /**
     * Проверяет, находится ли точка рядом с точкой сетки
     */
    isNearGridPoint(x, y) {
        const nearest = this.calculateSnapPoint(x, y);
        const distance = Math.sqrt(
            Math.pow(x - nearest.x, 2) + Math.pow(y - nearest.y, 2)
        );
        
        return distance <= this.snapTolerance;
    }
    
    /**
     * Устанавливает размер точек
     */
    setDotSize(size) {
        this.dotSize = Math.max(1, size);
        // Синхронизируем размер точек пересечений
        this.intersectionSize = this.dotSize;
        this.updateVisual();
    }
    
    /**
     * Устанавливает стиль точек
     */
    setDotStyle(style) {
        if (['circle', 'square'].includes(style)) {
            this.dotStyle = style;
            this.updateVisual();
        }
    }
    
    /**
     * Включает/выключает выделение пересечений
     */
    setHighlightIntersections(enabled) {
        this.highlightIntersections = enabled;
        this.updateVisual();
    }

    // Делаем цвет пересечений таким же, как основной цвет
    setColor(color) {
        super.setColor(color);
        this.intersectionColor = this.color;
        this.updateVisual();
    }
    
    /**
     * Сериализует настройки точечной сетки
     */
    serialize() {
        return {
            ...super.serialize(),
            dotSize: this.dotSize,
            dotStyle: this.dotStyle,
            highlightIntersections: this.highlightIntersections,
            intersectionSize: this.intersectionSize,
            intersectionColor: this.intersectionColor
        };
    }
}
