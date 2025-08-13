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
        // Прозрачность задаем через graphics.alpha из BaseGrid; штрих рисуем с полным альфа
        g.lineStyle(this.crossLineWidth, this.color, 1);

        const hs = this.crossHalfSize;

        for (let x = 0; x <= this.width; x += this.size) {
            for (let y = 0; y <= this.height; y += this.size) {
                // Горизонтальная часть креста
                g.moveTo(x - hs, y);
                g.lineTo(x + hs, y);
                // Вертикальная часть креста
                g.moveTo(x, y - hs);
                g.lineTo(x, y + hs);
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


