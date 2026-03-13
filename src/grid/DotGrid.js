import { BaseGrid } from './BaseGrid.js';
import { getActivePhases, getEffectiveSize, getScreenSpacing } from './DotGridZoomPhases.js';
import { getScreenAnchor } from './ScreenGridPhaseMachine.js';

/**
 * Точечная сетка с фазовым переключением при зуме (как в Miro).
 * При переходе между фазами точки затухают, на смену приходит другой набор.
 */
export class DotGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'dot';
        
        this.dotStyle = options.dotStyle || 'circle'; // 'circle' | 'square'
        this.highlightIntersections = options.highlightIntersections ?? true;
        this.dotSize = options.dotSize ?? 1; // для serialize/setDotSize; фазы переопределяют при отрисовке
        this.snapSize = options.snapSize ?? 20; // фиксированный шаг привязки в world-координатах
        // Порог видимости точки на экране и лимит плотности отрисовки.
        this.minScreenDotRadius = options.minScreenDotRadius ?? 0.45;
        this.minScreenSpacing = options.minScreenSpacing ?? 8;
        this.maxDotsPerPhase = options.maxDotsPerPhase ?? 25000;
        this.intersectionSize = options.intersectionSize ?? this.dotSize;
        this.intersectionColor = options.intersectionColor ?? this.color;

        /** Текущий zoom (scale) для выбора фазы. 1 = 100%. */
        this._zoom = 1;
    }

    /**
     * Устанавливает текущий масштаб (для фазового переключения).
     * @param {number} scale - world.scale.x (1 = 100%)
     */
    setZoom(scale) {
        this._zoom = Math.max(0.02, Math.min(5, scale));
    }

    /** @returns {Array<{ phase: object, alpha: number }>} */
    _getActivePhases() {
        return getActivePhases(this._zoom);
    }

    /** @returns {number} */
    _getEffectiveSize() {
        return getEffectiveSize(this._zoom);
    }
    
    /**
     * Создает визуальное представление точечной сетки
     */
    createVisual() {
        this.size = this._getEffectiveSize();
        const phases = this._getActivePhases();
        const baseOpacity = this.opacity ?? 0.7;
        for (const { phase, alpha } of phases) {
            this._drawPhaseDots(phase, baseOpacity * alpha);
        }
    }

    /**
     * Рисует точки одной фазы с заданной прозрачностью.
     */
    _drawPhaseDots(phase, alpha) {
        const b = this.getDrawBounds();
        const scale = Math.max(0.001, this.viewportTransform?.scale || this._zoom || 1);
        let stepPx = getScreenSpacing(this._zoom, this.minScreenSpacing);

        const widthPx = Math.max(0, b.right - b.left);
        const heightPx = Math.max(0, b.bottom - b.top);
        const estimateDots = () => {
            const nx = Math.floor(widthPx / stepPx) + 3;
            const ny = Math.floor(heightPx / stepPx) + 3;
            return nx * ny;
        };
        const dots = estimateDots();
        if (dots > this.maxDotsPerPhase) {
            const densityFactor = Math.sqrt(dots / this.maxDotsPerPhase);
            stepPx *= Math.max(1, densityFactor);
        }

        const worldX = this.viewportTransform?.worldX || 0;
        const worldY = this.viewportTransform?.worldY || 0;
        const anchorX = getScreenAnchor(worldX, stepPx);
        const anchorY = getScreenAnchor(worldY, stepPx);

        const alignStart = (min, anchor, step) => {
            const d = ((anchor - min) % step + step) % step;
            return min + d;
        };
        const startX = alignStart(b.left, anchorX, stepPx);
        const startY = alignStart(b.top, anchorY, stepPx);
        const endX = b.right + stepPx;
        const endY = b.bottom + stepPx;

        const phaseScreenRadius = phase.dotSize * scale;
        const maxScreenRadius = stepPx * 0.2;
        const dotSize = Math.min(
            Math.max(phaseScreenRadius, this.minScreenDotRadius),
            maxScreenRadius
        );

        this.graphics.beginFill(this.color, alpha);
        for (let x = startX; x <= endX; x += stepPx) {
            for (let y = startY; y <= endY; y += stepPx) {
                this.drawDot(x, y, dotSize);
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
        const step = this.snapSize || this.size;
        const snapX = Math.round(x / step) * step;
        const snapY = Math.round(y / step) * step;
        
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
     * Устанавливает размер точек (для совместимости; при фазовом зуме фазы переопределяют размер).
     */
    setDotSize(size) {
        this.dotSize = Math.max(0.5, size);
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
            snapSize: this.snapSize,
            minScreenDotRadius: this.minScreenDotRadius,
            minScreenSpacing: this.minScreenSpacing,
            maxDotsPerPhase: this.maxDotsPerPhase,
            highlightIntersections: this.highlightIntersections,
            intersectionSize: this.intersectionSize,
            intersectionColor: this.intersectionColor
        };
    }
}
