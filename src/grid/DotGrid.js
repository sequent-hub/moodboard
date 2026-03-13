import { BaseGrid } from './BaseGrid.js';
import { getActivePhases, getDotOpacity, getEffectiveSize, getScreenSpacing } from './DotGridZoomPhases.js';
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
        // Минимальный радиус точки на экране: 1px (диаметр 2px).
        this.minScreenDotRadius = Math.max(1, Math.round(options.minScreenDotRadius ?? 1));
        this.minScreenSpacing = options.minScreenSpacing ?? 8;
        this.maxDotsPerPhase = options.maxDotsPerPhase ?? 25000;
        this.intersectionSize = options.intersectionSize ?? this.dotSize;
        this.intersectionColor = options.intersectionColor ?? this.color;

        /** Текущий zoom (scale) для выбора фазы. 1 = 100%. */
        this._zoom = 1;

        // DotGrid всегда непрозрачный.
        this.opacity = 1;
        this.graphics.alpha = 1;

        // Cursor-centric anchor-контракт: при зуме точка под курсором фиксируется.
        this._anchorX = null;
        this._anchorY = null;
        this._lastStepPxX = null;
        this._lastStepPxY = null;
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
        const baseOpacity = 1;
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
        const stepPx = Math.max(1, Math.round(getScreenSpacing(this._zoom)));
        const zoomOpacity = getDotOpacity(this._zoom);

        const worldX = this.viewportTransform?.worldX || 0;
        const worldY = this.viewportTransform?.worldY || 0;
        const cursorX = this.viewportTransform?.zoomCursorX;
        const cursorY = this.viewportTransform?.zoomCursorY;
        const useCursorAnchor = this.viewportTransform?.useCursorAnchor === true;
        const anchorX = this._resolveScreenAnchor('x', worldX, stepPx, cursorX, useCursorAnchor);
        const anchorY = this._resolveScreenAnchor('y', worldY, stepPx, cursorY, useCursorAnchor);

        const alignStart = (min, anchor, step) => {
            const minInt = Math.round(min);
            const d = ((anchor - minInt) % step + step) % step;
            return minInt + d;
        };
        const startX = alignStart(b.left, anchorX, stepPx);
        const startY = alignStart(b.top, anchorY, stepPx);
        const endX = Math.round(b.right) + stepPx;
        const endY = Math.round(b.bottom) + stepPx;

        const phaseScreenRadius = phase.dotSize * scale;
        const roundedRadius = phaseScreenRadius < 2
            ? Math.floor(phaseScreenRadius)
            : Math.round(phaseScreenRadius);
        const dotSize = Math.max(this.minScreenDotRadius, roundedRadius);

        this.graphics.beginFill(this.color, alpha * zoomOpacity);
        for (let x = startX; x <= endX; x += stepPx) {
            for (let y = startY; y <= endY; y += stepPx) {
                this.drawDot(x, y, dotSize);
            }
        }
        this.graphics.endFill();
    }

    _normalizeAnchor(anchor, stepPx) {
        const step = Math.max(1, Math.round(stepPx));
        const normalized = ((Math.round(anchor) % step) + step) % step;
        return normalized;
    }

    _resolveScreenAnchor(axis, worldOffset, stepPx, cursorPx, useCursorAnchor) {
        const anchorKey = axis === 'x' ? '_anchorX' : '_anchorY';
        const lastStepKey = axis === 'x' ? '_lastStepPxX' : '_lastStepPxY';
        const step = Math.max(1, Math.round(stepPx));
        const rawAnchor = this._normalizeAnchor(getScreenAnchor(worldOffset, step), step);

        // Во время cursor-centric zoom привязываем сетку к экранной позиции курсора.
        // Это сохраняет точку под курсором на одном screen-пикселе при смене шага.
        if (useCursorAnchor && Number.isFinite(cursorPx)) {
            const cursorAnchor = this._normalizeAnchor(Math.round(cursorPx), step);
            this[anchorKey] = cursorAnchor;
            this[lastStepKey] = step;
            return cursorAnchor;
        }

        this[anchorKey] = rawAnchor;
        this[lastStepKey] = step;
        return rawAnchor;
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
        const px = Math.round(x);
        const py = Math.round(y);
        const r = Math.max(1, Math.round(size));
        if (this.dotStyle === 'circle') {
            this.graphics.drawCircle(px, py, r);
        } else if (this.dotStyle === 'square') {
            const half = r;
            this.graphics.drawRect(px - half, py - half, half * 2, half * 2);
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

    /**
     * DotGrid всегда непрозрачный: внешний вызов setOpacity игнорируем.
     */
    setOpacity() {
        this.opacity = 1;
        this.graphics.alpha = 1;
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
