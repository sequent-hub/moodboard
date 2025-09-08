import * as PIXI from 'pixi.js';

/**
 * Класс объекта «Рисунок» (карандаш/маркер)
 * Хранит точки и настраивает отрисовку с учётом режима, толщины, цвета.
 */
export class DrawingObject {
    /**
     * @param {Object} objectData
     *  - properties.mode: 'pencil' | 'marker'
     *  - properties.strokeColor: number
     *  - properties.strokeWidth: number
     *  - properties.points: Array<{x:number,y:number}>
     *  - width/height: габариты для первичного масштаба (base)
     */
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.mode = objectData.properties?.mode || 'pencil';
        this.color = objectData.properties?.strokeColor ?? 0x111827;
        this.strokeWidth = objectData.properties?.strokeWidth ?? 2;
        this.points = Array.isArray(objectData.properties?.points) ? objectData.properties.points : [];

        // Базовые размеры для последующего масштабирования
        this.baseWidth = objectData.properties?.baseWidth || objectData.width || 1;
        this.baseHeight = objectData.properties?.baseHeight || objectData.height || 1;

        this.graphics = new PIXI.Graphics();
        this._draw(this.points, this.color, this.strokeWidth, this.mode);

        // Сохраняем мета для hit-test/resize
        this.graphics._mb = {
            ...(this.graphics._mb || {}),
            type: 'drawing',
            properties: {
                mode: this.mode,
                strokeColor: this.color,
                strokeWidth: this.strokeWidth,
                points: this.points,
                baseWidth: this.baseWidth,
                baseHeight: this.baseHeight
            }
        };
    }

    getPixi() {
        return this.graphics;
    }

    /** Обновить визуал без изменения точек */
    setStyle({ mode, strokeColor, strokeWidth } = {}) {
        if (mode) this.mode = mode;
        if (typeof strokeColor === 'number') this.color = strokeColor;
        if (typeof strokeWidth === 'number') this.strokeWidth = strokeWidth;
        this._redrawPreserveTransform(this.points);
    }

    /** Обновить точки (после дорисовки) */
    setPoints(points) {
        this.points = Array.isArray(points) ? points : [];
        this._redrawPreserveTransform(this.points);
    }

    /** Изменение габаритов — масштабируем визуал относительно базовых размеров */
    updateSize(size) {
        if (!size) return;
        const w = Math.max(1, size.width || 1);
        const h = Math.max(1, size.height || 1);
        const scaleX = w / (this.baseWidth || 1);
        const scaleY = h / (this.baseHeight || 1);
        const scaled = this.points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
        this._redrawPreserveTransform(scaled);
    }

    _redrawPreserveTransform(points) {
        const g = this.graphics;
        // Сохраняем текущий центр и поворот
        const centerX = g.x;
        const centerY = g.y;
        const rot = g.rotation || 0;

        // Перерисовываем геометрию
        this._draw(points, this.color, this.strokeWidth, this.mode);

        // После перерисовки выставляем pivot по центру новой геометрии,
        // чтобы ядро корректно сопоставляло левый-верх и центр при ресайзе
        const b = g.getBounds();
        const pX = Math.max(0, b.width / 2);
        const pY = Math.max(0, b.height / 2);
        g.pivot.set(pX, pY);

        // Восстанавливаем центр и поворот
        g.x = centerX;
        g.y = centerY;
        g.rotation = rot;
    }

    _draw(points, color, strokeWidth, mode) {
        const g = this.graphics;
        g.clear();
        const isMarker = mode === 'marker';
        const lineWidth = isMarker ? strokeWidth * 2 : strokeWidth;
        const alpha = isMarker ? 0.6 : 1;
        g.lineStyle({ width: lineWidth, color, alpha, cap: 'round', join: 'round', miterLimit: 2, alignment: 0.5 });
        g.blendMode = isMarker ? PIXI.BLEND_MODES.LIGHTEN : PIXI.BLEND_MODES.NORMAL;
        if (!points || points.length === 0) return;
        if (points.length < 3) {
            g.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
        } else {
            g.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length - 1; i++) {
                const cx = points[i].x, cy = points[i].y;
                const nx = points[i + 1].x, ny = points[i + 1].y;
                const mx = (cx + nx) / 2, my = (cy + ny) / 2;
                g.quadraticCurveTo(cx, cy, mx, my);
            }
            const pen = points[points.length - 2];
            const last = points[points.length - 1];
            g.quadraticCurveTo(pen.x, pen.y, last.x, last.y);
        }
    }
}

