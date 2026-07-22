import * as PIXI from 'pixi.js';
import { MINDMAP_LAYOUT } from '../ui/mindmap/MindmapLayoutConfig.js';

// Толщина обводки в экранных пикселях — совпадает с толщиной веток MindmapConnectionLayer.
const STROKE_SCREEN_PX = 1;

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
        // Форма рамки: 'none' (прозрачная, только текст) | 'pill' | 'rounded' | 'rect'.
        this.shape = MindmapObject._normalizeShape(props.shape);
        // Радиус скругления для shape === 'rounded' (мировые единицы).
        this.borderRadius = (typeof props.borderRadius === 'number') ? Math.max(0, props.borderRadius) : 32;
        // Тип линии обводки: 'solid' | 'dashed' | 'dotted'.
        this.lineType = MindmapObject._normalizeLineType(props.lineType);
        this.capsuleBaseHeight = (typeof props.capsuleBaseHeight === 'number')
            ? Math.max(1, Math.round(props.capsuleBaseHeight))
            : Math.max(1, Math.round(Math.min(this.height, MINDMAP_LAYOUT.height)));

        // Текущий масштаб мирового слоя; обновляется через redrawForZoom при каждом зуме.
        this._worldScale = 1;
        // Цвет фона холста — непрозрачная подложка капсулы, чтобы под ней не были
        // видны ветки/другие объекты. Обновляется движком через setBoardBackground().
        this._boardBackground = 0xFFFFFF;

        this.graphics = new PIXI.Graphics();
        this._draw();
    }

    static _normalizeShape(value) {
        return (value === 'none' || value === 'pill' || value === 'rounded' || value === 'rect')
            ? value
            : 'rounded';
    }

    static _normalizeLineType(value) {
        return (value === 'dashed' || value === 'dotted') ? value : 'solid';
    }

    getPixi() {
        return this.graphics;
    }

    /**
     * Применяет обновления стиля капсулы из панели свойств и перерисовывает,
     * сохраняя текущий трансформ. Принимает `updates.properties`-подобный объект.
     */
    setStyle(props = {}) {
        if (!props || typeof props !== 'object') {
            return;
        }
        if (Number.isFinite(props.strokeColor)) {
            this.strokeColor = Math.floor(Number(props.strokeColor));
        }
        if (Number.isFinite(props.fillColor)) {
            this.fillColor = Math.floor(Number(props.fillColor));
        }
        if (Number.isFinite(props.fillAlpha)) {
            this.fillAlpha = Math.min(1, Math.max(0, Number(props.fillAlpha)));
        }
        if (Number.isFinite(props.strokeWidth)) {
            this.strokeWidth = Math.max(1, Math.round(Number(props.strokeWidth)));
        }
        if (props.shape !== undefined) {
            this.shape = MindmapObject._normalizeShape(props.shape);
        }
        if (Number.isFinite(props.borderRadius)) {
            this.borderRadius = Math.max(0, Number(props.borderRadius));
        }
        if (props.lineType !== undefined) {
            this.lineType = MindmapObject._normalizeLineType(props.lineType);
        }
        this._redrawPreserveTransform();
    }

    setBoardBackground(color) {
        if (typeof color !== 'number' || !Number.isFinite(color)) {
            return;
        }
        const next = (color >>> 0) & 0xffffff;
        if (next === this._boardBackground) {
            return;
        }
        this._boardBackground = next;
        this._redrawPreserveTransform();
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

    _resolveRadius() {
        const maxRadius = Math.max(0, Math.floor(Math.min(this.width, this.height) / 2));
        if (this.shape === 'rect') {
            return 0;
        }
        if (this.shape === 'pill') {
            return maxRadius;
        }
        // 'rounded' (и 'none' — форма не рисуется, но радиус не важен).
        return Math.min(maxRadius, this.borderRadius);
    }

    _draw() {
        const g = this.graphics;
        g.clear();

        // Форма «нет рамки»: капсула полностью прозрачна — ни подложки, ни заливки,
        // ни обводки, остаётся только текст (HTML-слой рисуется отдельно).
        if (this.shape === 'none') {
            return;
        }

        const capsuleRadius = this._resolveRadius();

        // Толщина в мировых единицах: экранные пиксели ÷ масштаб — совпадает с ветками.
        const strokeW = Math.max(1, this.strokeWidth) * STROKE_SCREEN_PX / this._worldScale;

        // Непрозрачная подложка цветом фона холста: перекрывает ветки/объекты под
        // капсулой (иначе сквозь полупрозрачную заливку видна линия коннектора).
        g.beginFill(this._boardBackground, 1);
        g.drawRoundedRect(0, 0, this.width, this.height, capsuleRadius);
        g.endFill();

        g.beginFill(this.fillColor, this.fillAlpha);
        g.drawRoundedRect(0, 0, this.width, this.height, capsuleRadius);
        g.endFill();

        if (this.lineType === 'solid') {
            this._strokeSolid(g, capsuleRadius, strokeW);
        } else {
            this._strokeDashed(g, capsuleRadius, strokeW);
        }
    }

    _strokeSolid(g, radius, strokeW) {
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
        g.drawRoundedRect(0, 0, this.width, this.height, radius);
    }

    /**
     * Рисует пунктирную (dashed) или точечную (dotted) обводку скруглённого
     * прямоугольника: строит полилинию по периметру и проходит её штрихами.
     * PIXI не поддерживает dash-паттерн из коробки, поэтому режем вручную.
     */
    _strokeDashed(g, radius, strokeW) {
        const points = this._buildRoundedRectPerimeter(radius);
        if (points.length < 2) {
            return;
        }

        const scale = this._worldScale || 1;
        const dashLen = (this.lineType === 'dotted' ? strokeW * scale * 1.2 : 8) / scale;
        const gapLen = (this.lineType === 'dotted' ? 5 : 6) / scale;
        const cap = this.lineType === 'dotted' ? 'round' : 'butt';

        try {
            g.lineStyle({ width: strokeW, color: this.strokeColor, alpha: 1, alignment: 0, cap });
        } catch (_) {
            g.lineStyle(strokeW, this.strokeColor, 1, 0);
        }

        let drawing = true;
        let remaining = dashLen;
        let penDown = false;
        for (let i = 1; i < points.length; i += 1) {
            let ax = points[i - 1].x;
            let ay = points[i - 1].y;
            const bx = points[i].x;
            const by = points[i].y;
            let segLen = Math.hypot(bx - ax, by - ay);
            const dirX = segLen > 0 ? (bx - ax) / segLen : 0;
            const dirY = segLen > 0 ? (by - ay) / segLen : 0;

            while (segLen > 0) {
                const step = Math.min(remaining, segLen);
                const nx = ax + dirX * step;
                const ny = ay + dirY * step;
                if (drawing) {
                    if (!penDown) {
                        g.moveTo(ax, ay);
                        penDown = true;
                    }
                    g.lineTo(nx, ny);
                } else {
                    penDown = false;
                }
                ax = nx;
                ay = ny;
                segLen -= step;
                remaining -= step;
                if (remaining <= 1e-6) {
                    drawing = !drawing;
                    remaining = drawing ? dashLen : gapLen;
                    penDown = false;
                }
            }
        }
    }

    /** Плотная полилиния по периметру скруглённого прямоугольника (замкнутая). */
    _buildRoundedRectPerimeter(radius) {
        const w = this.width;
        const h = this.height;
        const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
        const pts = [];
        const ARC_STEPS = 6;

        const addArc = (cx, cy, start, end) => {
            for (let i = 0; i <= ARC_STEPS; i += 1) {
                const a = start + (end - start) * (i / ARC_STEPS);
                pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
            }
        };

        if (r <= 0) {
            pts.push({ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: 0 });
            return pts;
        }

        const HALF_PI = Math.PI / 2;
        pts.push({ x: r, y: 0 });
        pts.push({ x: w - r, y: 0 });
        addArc(w - r, r, -HALF_PI, 0);
        pts.push({ x: w, y: h - r });
        addArc(w - r, h - r, 0, HALF_PI);
        pts.push({ x: r, y: h });
        addArc(r, h - r, HALF_PI, Math.PI);
        pts.push({ x: 0, y: r });
        addArc(r, r, Math.PI, Math.PI + HALF_PI);
        pts.push({ x: r, y: 0 });
        return pts;
    }
}
