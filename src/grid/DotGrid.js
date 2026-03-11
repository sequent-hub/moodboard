import { BaseGrid } from './BaseGrid.js';

/**
 * Фазы сетки: zoom (0-1 = 0-100%) → { size, dotSize }.
 * Размеры гармоничные (96→48→24→12): меньший делит больший без остатка,
 * узлы совпадают при crossfade, нет moiré.
 */
const PHASES = [
    { zoomMin: 0.1, zoomMax: 0.45, size: 96, dotSize: 2 },    // 10–45%
    { zoomMin: 0.35, zoomMax: 0.9, size: 48, dotSize: 1.5 },   // 35–90%
    { zoomMin: 0.75, zoomMax: 1.8, size: 24, dotSize: 1 },     // 75–180%
    { zoomMin: 1.5, zoomMax: 5, size: 12, dotSize: 0.6 }     // 150–500%
];

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

    /**
     * Возвращает активные фазы и их alpha для crossfade.
     * В зоне перекрытия двух фаз: старая затухает, новая проявляется.
     * @returns {Array<{ phase: object, alpha: number }>}
     */
    _getActivePhases() {
        const z = this._zoom;
        const result = [];
        for (let i = 0; i < PHASES.length; i++) {
            const p = PHASES[i];
            if (z < p.zoomMin || z > p.zoomMax) continue;
            const next = PHASES[i + 1];
            const prev = PHASES[i - 1];
            let alpha = 1;
            if (next && z >= next.zoomMin && p.zoomMax > next.zoomMin) {
                alpha = (p.zoomMax - z) / (p.zoomMax - next.zoomMin);
            } else if (prev && z <= prev.zoomMax && prev.zoomMax > p.zoomMin) {
                alpha = (z - p.zoomMin) / (prev.zoomMax - p.zoomMin);
            }
            if (alpha > 0.01) result.push({ phase: p, alpha });
        }
        if (result.length === 0) {
            const nearest = PHASES.reduce((a, b) =>
                Math.abs(z - (a.zoomMin + a.zoomMax) / 2) < Math.abs(z - (b.zoomMin + b.zoomMax) / 2) ? a : b);
            result.push({ phase: nearest, alpha: 1 });
        }
        return result;
    }

    /**
     * Эффективный size для snap (доминирующая фаза).
     */
    _getEffectiveSize() {
        const phases = this._getActivePhases();
        const dominant = phases.reduce((a, b) => (a.alpha >= b.alpha ? a : b));
        return dominant.phase.size;
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
        const { size, dotSize } = phase;
        const startX = Math.floor(b.left / size) * size;
        const startY = Math.floor(b.top / size) * size;
        const endX = Math.ceil(b.right / size) * size;
        const endY = Math.ceil(b.bottom / size) * size;
        this.graphics.beginFill(this.color, alpha);
        for (let x = startX; x <= endX; x += size) {
            for (let y = startY; y <= endY; y += size) {
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
            highlightIntersections: this.highlightIntersections,
            intersectionSize: this.intersectionSize,
            intersectionColor: this.intersectionColor
        };
    }
}
