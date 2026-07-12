import * as PIXI from 'pixi.js';
import { MINDMAP_LAYOUT } from '../ui/mindmap/MindmapLayoutConfig.js';

// Толщина обводки в экранных пикселях — совпадает с толщиной веток MindmapConnectionLayer.
const STROKE_SCREEN_PX = 2;

/**
 * Простой объект mindmap: прямоугольник с синей обводкой и полупрозрачной синей заливкой.
 */
export class MindmapObject {
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.width = objectData.width || objectData.properties?.width || MINDMAP_LAYOUT.width;
        this.height = objectData.height || objectData.properties?.height || MINDMAP_LAYOUT.height;
        const props = objectData.properties || {};
        this.strokeColor = (typeof props.strokeColor === 'number') ? props.strokeColor : 0x2563EB;
        this.fillColor = (typeof props.fillColor === 'number') ? props.fillColor : 0x3B82F6;
        this.fillAlpha = (typeof props.fillAlpha === 'number') ? props.fillAlpha : 0.25;
        this.strokeWidth = (typeof props.strokeWidth === 'number') ? props.strokeWidth : 1;
        this.capsuleBaseHeight = (typeof props.capsuleBaseHeight === 'number')
            ? Math.max(1, Math.round(props.capsuleBaseHeight))
            : Math.max(1, Math.round(Math.min(this.height, MINDMAP_LAYOUT.height)));

        // Текущий масштаб мирового слоя; обновляется через redrawForZoom при каждом зуме.
        this._worldScale = 1;

        this.graphics = new PIXI.Graphics();
        this._draw();
    }

    getPixi() {
        return this.graphics;
    }

    updateSize(size) {
        if (!size) return;
        this.width = Math.max(1, size.width || this.width);
        this.height = Math.max(1, size.height || this.height);
        this._redrawPreserveTransform();
    }

    /**
     * Перерисовать пилюлю под текущий масштаб мира.
     * Вызывается из PixiEngine на каждый зум — пересчитывает толщину обводки и
     * число сегментов дуги, чтобы фаски оставались гладкими без зазубрин.
     */
    redrawForZoom(worldScale) {
        this._worldScale = Math.max(0.01, worldScale || 1);
        this._redrawPreserveTransform();
    }

    _redrawPreserveTransform() {
        const g = this.graphics;
        const centerX = g.x;
        const centerY = g.y;
        const rot = g.rotation || 0;

        this._draw();
        // Точный pivot (size/2, без floor) и точный центр: при нечётной ширине/высоте
        // floor терял 0.5px, из-за чего капсула смещалась вниз-вправо относительно
        // бокса объекта (position — целые числа). Рамка выделения строится по боксу
        // объекта, поэтому во время резайза/редактирования её верх уходил выше капсулы.
        // top-left = center - pivot = position (целое) → грани попадают в целый пиксель.
        g.pivot.set(this.width / 2, this.height / 2);
        g.x = centerX;
        g.y = centerY;
        g.rotation = rot;
    }

    _draw() {
        const g = this.graphics;
        g.clear();
        const dynamicRadius = Math.max(0, Math.floor(Math.min(this.width, this.height) / 2));
        const fixedBaseRadius = Math.max(0, Math.floor(this.capsuleBaseHeight / 2));
        const capsuleRadius = Math.min(dynamicRadius, fixedBaseRadius);

        // Толщина в мировых единицах: 3 экранных пикселя ÷ масштаб — совпадает с ветками.
        const strokeW = STROKE_SCREEN_PX / this._worldScale;

        g.beginFill(this.fillColor, this.fillAlpha);
        g.drawRoundedRect(0, 0, this.width, this.height, capsuleRadius);
        g.endFill();

        try {
            g.lineStyle({
                width: strokeW,
                color: this.strokeColor,
                alpha: 1,
                alignment: 0,
                cap: 'round',
                join: 'round',
                miterLimit: 2,
            });
        } catch (_) {
            g.lineStyle(strokeW, this.strokeColor, 1, 0);
        }
        g.drawRoundedRect(0, 0, this.width, this.height, capsuleRadius);
    }
}
