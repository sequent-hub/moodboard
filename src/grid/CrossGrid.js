import * as PIXI from 'pixi.js';
import { BaseGrid } from './BaseGrid.js';
import { getScreenAnchor } from './ScreenGridPhaseMachine.js';

/**
 * Сетка с крестиками (плюсами) в узлах
 */
export class CrossGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'cross';

        // Размер половины креста от центра до конца линии
        this.crossHalfSize = options.crossHalfSize || 4;
        this.crossLineWidth = options.crossLineWidth || this.lineWidth || 1;

        // По умолчанию делаем цвет крестиков серым
        if (options.color == null) {
            this.color = 0xB0B0B0;
        }
    }

    /**
     * Рендер сетки — рисуем крестики по узлам
     */
    createVisual() {
        const g = this.graphics;
        // Прозрачность — через alpha графики (как у линейной сетки)
        g.alpha = this.opacity;
        try {
            g.lineStyle({
                width: Math.max(1, Math.round(this.crossLineWidth || 1)),
                color: this.color,
                alpha: 1,
                alignment: 0
            });
        } catch (_) {
            g.lineStyle(Math.max(1, Math.round(this.crossLineWidth || 1)), this.color, 1);
        }

        const hs = this.crossHalfSize;
        const b = this.getDrawBounds();
        const { screenStep } = this.getScreenGridState();
        const step = Math.max(1, screenStep);
        const worldX = this.viewportTransform?.worldX || 0;
        const worldY = this.viewportTransform?.worldY || 0;
        const anchorX = getScreenAnchor(worldX, step);
        const anchorY = getScreenAnchor(worldY, step);
        const alignStart = (min, anchor) => {
            const d = ((anchor - min) % step + step) % step;
            return min + d;
        };
        const startX = alignStart(b.left, anchorX);
        const startY = alignStart(b.top, anchorY);
        const endX = b.right + step;
        const endY = b.bottom + step;
        for (let x = startX; x <= endX; x += step) {
            for (let y = startY; y <= endY; y += step) {
                const px = Math.round(x);
                const py = Math.round(y);
                g.moveTo(px - hs, py);
                g.lineTo(px + hs, py);
                g.moveTo(px, py - hs);
                g.lineTo(px, py + hs);
            }
        }
    }

    /**
     * Привязка — как у линейной/точечной сетки: к ближайшему узлу
     */
    calculateSnapPoint(x, y) {
        const snapX = Math.round(x / this.size) * this.size;
        const snapY = Math.round(y / this.size) * this.size;
        return { x: snapX, y: snapY };
    }

    /**
     * Изменение размеров креста
     */
    setCrossHalfSize(halfSize) {
        this.crossHalfSize = Math.max(1, halfSize);
        this.updateVisual();
    }

    setCrossLineWidth(w) {
        this.crossLineWidth = Math.max(1, w);
        this.updateVisual();
    }

    serialize() {
        return {
            ...super.serialize(),
            crossHalfSize: this.crossHalfSize,
            crossLineWidth: this.crossLineWidth
        };
    }
}


