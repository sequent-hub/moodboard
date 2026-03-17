import { BaseGrid } from './BaseGrid.js';
import { getScreenAnchor } from './ScreenGridPhaseMachine.js';
import { getCrossCheckpointForZoom, getCrossColor } from './CrossGridZoomPhases.js';

/**
 * Сетка с крестиками (плюсами) в узлах
 */
export class CrossGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'cross';

        // Размер половины креста от центра до конца линии
        this.crossHalfSize = options.crossHalfSize || 4;
        this.crossLineWidth = 1;

        // По умолчанию делаем цвет крестиков серым
        if (options.color == null) {
            this.color = 0xB0B0B0;
        }
        // CrossGrid всегда непрозрачный, независимо от входящих настроек.
        this.opacity = 1;
        this.graphics.alpha = 1;
    }

    /**
     * Рендер сетки — рисуем крестики по узлам
     */
    createVisual() {
        const g = this.graphics;
        // Строго без прозрачности.
        g.alpha = 1;
        const lineColor = getCrossColor(this._zoom, this.color);
        g.beginFill(lineColor, 1);

        const checkpoint = getCrossCheckpointForZoom(this._zoom);
        const hs = Math.max(1, Math.round(checkpoint.crossHalfSize || this.crossHalfSize || 1));
        const b = this.getDrawBounds();
        const step = Math.max(1, Math.round(checkpoint.spacing || 20));
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
                const ray = hs * 2 + 1;
                // Строгий 1px-контракт: рисуем пиксельные прямоугольники вместо stroke-линий.
                g.drawRect(px - hs, py, ray, 1);
                g.drawRect(px, py - hs, 1, ray);
            }

        }
        g.endFill();
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
        void w;
        this.crossLineWidth = 1;
        this.updateVisual();
    }

    /**
     * CrossGrid всегда непрозрачный: внешний setOpacity игнорируется.
     */
    setOpacity() {
        this.opacity = 1;
        this.graphics.alpha = 1;
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


