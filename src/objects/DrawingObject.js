import * as PIXI from 'pixi.js';
import { GeometryUtils } from '../core/rendering/GeometryUtils.js';

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

        // PIXI v7 Graphics.containsPoint учитывает только заливку (fillStyle),
        // а рисунок состоит лишь из обводки (lineStyle) — поэтому штатный hit-test
        // линии всегда «мимо», и событийная система не шлёт pointerover/pointerout
        // (от них зависит hover-подсветка). Переопределяем containsPoint на проверку
        // расстояния до сегментов, чтобы наведение ловилось на любом участке линии.
        this.graphics.containsPoint = (globalPoint) => this._containsPoint(globalPoint);

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

    /**
     * Hit-test линии по расстоянию до её сегментов.
     * Вызывается событийной системой PIXI с ГЛОБАЛЬНОЙ точкой.
     * @param {PIXI.IPointData} globalPoint
     * @returns {boolean}
     */
    _containsPoint(globalPoint) {
        const g = this.graphics;
        const pts = this.points;
        if (!pts || pts.length < 2 || !g.toLocal) return false;

        // Локальные координаты курсора в системе геометрии линии.
        const local = g.toLocal(globalPoint);

        // Геометрия могла быть перерисована под новый размер (updateSize),
        // тогда как this.points хранит базовые точки. Масштаб берём из
        // ЛОКАЛЬНЫХ границ (не зависят от zoom), чтобы совпасть с local.
        const lb = g.getLocalBounds();
        const baseW = this.baseWidth || 1;
        const baseH = this.baseHeight || 1;
        const scaleX = baseW ? (lb.width / baseW) : 1;
        const scaleY = baseH ? (lb.height / baseH) : 1;

        // Полоса попадания: половина толщины линии + запас на «любой участок».
        const lineWidth = this.mode === 'marker' ? this.strokeWidth * 2 : this.strokeWidth;
        const threshold = Math.max(8, lineWidth / 2 + 6);

        for (let j = 0; j < pts.length - 1; j++) {
            const ax = pts[j].x * scaleX;
            const ay = pts[j].y * scaleY;
            const bx = pts[j + 1].x * scaleX;
            const by = pts[j + 1].y * scaleY;
            if (GeometryUtils.distancePointToSegment(local.x, local.y, ax, ay, bx, by) <= threshold) {
                return true;
            }
        }
        return false;
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

        // После перерисовки выставляем pivot по ЦЕНТРУ ЛОКАЛЬНЫХ границ,
        // чтобы поворот происходил вокруг геометрического центра без диагонального смещения
        const lb = g.getLocalBounds();
        const pX = (lb.x || 0) + Math.max(0, lb.width / 2);
        const pY = (lb.y || 0) + Math.max(0, lb.height / 2);
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

