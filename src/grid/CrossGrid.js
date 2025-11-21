import * as PIXI from 'pixi.js';
import { BaseGrid } from './BaseGrid.js';

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
        // Тонкие чёткие линии как у линейной сетки: alignment = 0.5
        try {
            g.lineStyle({ width: Math.max(0.5, this.crossLineWidth), color: this.color, alpha: 1, alignment: 0.5 });
        } catch (_) {
            g.lineStyle(Math.max(0.5, this.crossLineWidth), this.color, 1);
        }

        const hs = this.crossHalfSize;

        for (let x = 0; x <= this.width; x += this.size) {
            for (let y = 0; y <= this.height; y += this.size) {
                // Выравниваем к полу-пикселю для чётких 1px линий
                const px = Math.round(x) + 0.5;
                const py = Math.round(y) + 0.5;
                // Горизонтальная часть креста
                g.moveTo(px - hs, py);
                g.lineTo(px + hs, py);
                // Вертикальная часть креста
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


