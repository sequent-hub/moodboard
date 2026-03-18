import * as PIXI from 'pixi.js';
import { MINDMAP_LAYOUT } from '../ui/mindmap/MindmapLayoutConfig.js';

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
        this.strokeWidth = (typeof props.strokeWidth === 'number') ? props.strokeWidth : 2;
        this.capsuleBaseHeight = (typeof props.capsuleBaseHeight === 'number')
            ? Math.max(1, Math.round(props.capsuleBaseHeight))
            : Math.max(1, Math.round(Math.min(this.height, MINDMAP_LAYOUT.height)));

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

    _redrawPreserveTransform() {
        const g = this.graphics;
        const centerX = g.x;
        const centerY = g.y;
        const rot = g.rotation || 0;

        this._draw();
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

        g.beginFill(this.fillColor, this.fillAlpha);
        g.drawRoundedRect(0, 0, this.width, this.height, capsuleRadius);
        g.endFill();

        // Soft under-stroke visually reduces edge stair-stepping on capsule curves.
        try {
            g.lineStyle({
                width: this.strokeWidth + 1,
                color: this.strokeColor,
                alpha: 0.35,
                alignment: 0,
                cap: 'round',
                join: 'round',
                miterLimit: 2,
            });
        } catch (_) {
            g.lineStyle(this.strokeWidth + 1, this.strokeColor, 0.35, 0);
        }
        g.drawRoundedRect(0, 0, this.width, this.height, capsuleRadius);

        try {
            g.lineStyle({
                width: this.strokeWidth,
                color: this.strokeColor,
                alpha: 1,
                alignment: 0,
                cap: 'round',
                join: 'round',
                miterLimit: 2,
            });
        } catch (_) {
            g.lineStyle(this.strokeWidth, this.strokeColor, 1, 0);
        }
        g.drawRoundedRect(0, 0, this.width, this.height, capsuleRadius);
    }
}
