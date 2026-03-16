import { BaseGrid } from './BaseGrid.js';
import { getScreenAnchor } from './ScreenGridPhaseMachine.js';
import { resolveLineGridState } from './LineGridZoomPhases.js';

/**
 * Линейная прямоугольная сетка
 */
export class LineGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'line';

        // Жесткий Miro-профиль line-grid: не зависим от сохраненных override.
        this.showSubGrid = true;
        this.subGridDivisions = 5;
        this.subGridColor = 0xFEFEFE;
        this.subGridOpacity = 1;
        this.superGridColor = 0xECECEC;
        this.superGridOpacity = 1;
        this.lineWidth = 1;
        this.color = 0xF4F4F4;
        this.opacity = 1;

        this._majorAnchorX = null;
        this._majorAnchorY = null;
        this._majorStepX = null;
        this._majorStepY = null;
        this._minorAnchorX = null;
        this._minorAnchorY = null;
        this._minorStepX = null;
        this._minorStepY = null;
    }
    
    /**
     * Создает визуальное представление линейной сетки
     */
    createVisual() {
        // Применяем непрозрачность на графику (умножится на alpha линий)
        if (typeof this.opacity === 'number') {
            this.graphics.alpha = this.opacity;
        }
        const state = this.getScreenGridState();
        try {
            this.graphics.lineStyle({
                width: Math.max(1, Math.round(this.lineWidth || 1)),
                color: this.color,
                alpha: 1,
                alignment: 0
            });
        } catch (_) {
            this.graphics.lineStyle(Math.max(1, Math.round(this.lineWidth || 1)), this.color, 1);
        }
        
        // Основные линии сетки
        this.drawMainGrid();

        // Дополнительная крупная сетка (Miro-подобный второй уровень).
        if ((state.superMajorScreenStep || 0) > 0) {
            this.drawSuperGrid();
        }
        
        // Дополнительная подсетка
        if (this.showSubGrid && state.showSubGridByZoom && (state.minorScreenStep || 0) > 0) {
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
        const cursorX = this.viewportTransform?.zoomCursorX;
        const cursorY = this.viewportTransform?.zoomCursorY;
        const useCursorAnchor = this.viewportTransform?.useCursorAnchor === true;
        const anchorX = this._resolveScreenAnchor('x', worldX, step, cursorX, useCursorAnchor, 'major');
        const anchorY = this._resolveScreenAnchor('y', worldY, step, cursorY, useCursorAnchor, 'major');
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
            const px = Math.round(x);
            this.graphics.moveTo(px, b.top);
            this.graphics.lineTo(px, b.bottom);
        }
        // Горизонтальные линии
        for (let y = startY; y <= endY; y += step) {
            const py = Math.round(y);
            this.graphics.moveTo(b.left, py);
            this.graphics.lineTo(b.right, py);
        }
    }
    
    /**
     * Рисует подсетку (более мелкие линии)
     */
    drawSubGrid() {
        const { screenStep, minorScreenStep } = this.getScreenGridState();
        const subSize = Math.max(1, Math.round(minorScreenStep || (screenStep / this.subGridDivisions)));
        try {
            this.graphics.lineStyle({
                width: 1,
                color: this.subGridColor,
                alpha: this.subGridOpacity,
                alignment: 0
            });
        } catch (_) {
            this.graphics.lineStyle(1, this.subGridColor, this.subGridOpacity);
        }
        const b = this.getDrawBounds();
        const worldX = this.viewportTransform?.worldX || 0;
        const worldY = this.viewportTransform?.worldY || 0;
        const cursorX = this.viewportTransform?.zoomCursorX;
        const cursorY = this.viewportTransform?.zoomCursorY;
        const useCursorAnchor = this.viewportTransform?.useCursorAnchor === true;
        const anchorX = this._resolveScreenAnchor('x', worldX, subSize, cursorX, useCursorAnchor, 'minor');
        const anchorY = this._resolveScreenAnchor('y', worldY, subSize, cursorY, useCursorAnchor, 'minor');
        const alignStart = (min, anchor) => {
            const d = ((anchor - min) % subSize + subSize) % subSize;
            return min + d;
        };
        const startX = alignStart(b.left, anchorX);
        const endX = b.right + subSize;
        const startY = alignStart(b.top, anchorY);
        const endY = b.bottom + subSize;
        const majorStep = Math.max(1, screenStep);
        const majorAnchorX = this._resolveScreenAnchor('x', worldX, majorStep, cursorX, useCursorAnchor, 'major');
        const majorAnchorY = this._resolveScreenAnchor('y', worldY, majorStep, cursorY, useCursorAnchor, 'major');
        const isOnMajor = (value, major, anchor) => {
            const rel = (value - anchor) / major;
            return Math.abs(rel - Math.round(rel)) < 1e-4;
        };
        for (let x = startX; x <= endX; x += subSize) {
            if (!isOnMajor(x, majorStep, majorAnchorX)) {
                const px = Math.round(x);
                this.graphics.moveTo(px, b.top);
                this.graphics.lineTo(px, b.bottom);
            }
        }
        for (let y = startY; y <= endY; y += subSize) {
            if (!isOnMajor(y, majorStep, majorAnchorY)) {
                const py = Math.round(y);
                this.graphics.moveTo(b.left, py);
                this.graphics.lineTo(b.right, py);
            }
        }
    }

    drawSuperGrid() {
        const { superMajorScreenStep } = this.getScreenGridState();
        const step = Math.max(1, Math.round(superMajorScreenStep || 0));
        if (step <= 0) return;
        try {
            this.graphics.lineStyle({
                width: 1,
                color: this.superGridColor,
                alpha: this.superGridOpacity,
                alignment: 0
            });
        } catch (_) {
            this.graphics.lineStyle(1, this.superGridColor, this.superGridOpacity);
        }
        const b = this.getDrawBounds();
        const worldX = this.viewportTransform?.worldX || 0;
        const worldY = this.viewportTransform?.worldY || 0;
        const cursorX = this.viewportTransform?.zoomCursorX;
        const cursorY = this.viewportTransform?.zoomCursorY;
        const useCursorAnchor = this.viewportTransform?.useCursorAnchor === true;
        const anchorX = this._resolveScreenAnchor('x', worldX, step, cursorX, useCursorAnchor, 'major');
        const anchorY = this._resolveScreenAnchor('y', worldY, step, cursorY, useCursorAnchor, 'major');
        const alignStart = (min, anchor) => {
            const d = ((anchor - min) % step + step) % step;
            return min + d;
        };
        const startX = alignStart(b.left, anchorX);
        const endX = b.right + step;
        const startY = alignStart(b.top, anchorY);
        const endY = b.bottom + step;
        for (let x = startX; x <= endX; x += step) {
            const px = Math.round(x);
            this.graphics.moveTo(px, b.top);
            this.graphics.lineTo(px, b.bottom);
        }
        for (let y = startY; y <= endY; y += step) {
            const py = Math.round(y);
            this.graphics.moveTo(b.left, py);
            this.graphics.lineTo(b.right, py);
        }
    }

    _normalizeAnchor(anchor, stepPx) {
        const step = Math.max(1, Math.round(stepPx));
        return ((Math.round(anchor) % step) + step) % step;
    }

    _resolveScreenAnchor(axis, worldOffset, stepPx, cursorPx, useCursorAnchor, layer) {
        const step = Math.max(1, Math.round(stepPx));
        const anchorKey = `_${layer}Anchor${axis === 'x' ? 'X' : 'Y'}`;
        const stepKey = `_${layer}Step${axis === 'x' ? 'X' : 'Y'}`;
        const raw = this._normalizeAnchor(getScreenAnchor(worldOffset, step), step);
        if (useCursorAnchor && Number.isFinite(cursorPx)) {
            const locked = this._normalizeAnchor(Math.round(cursorPx), step);
            this[anchorKey] = locked;
            this[stepKey] = step;
            return locked;
        }
        this[anchorKey] = raw;
        this[stepKey] = step;
        return raw;
    }

    getScreenGridState() {
        return resolveLineGridState(this._zoom, {
            minScreenSpacing: this.minScreenSpacing,
            phases: this.screenPhases,
            subGridDivisions: this.subGridDivisions,
        });
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
            subGridOpacity: this.subGridOpacity,
            superGridColor: this.superGridColor,
            superGridOpacity: this.superGridOpacity
        };
    }
}
