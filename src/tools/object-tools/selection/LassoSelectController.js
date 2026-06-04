import * as PIXI from 'pixi.js';

/**
 * Проверяет, находится ли точка внутри полигона (алгоритм ray casting).
 */
function pointInPolygon(point, polygon) {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        if ((yi > point.y) !== (yj > point.y) &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Проверяет, пересекается ли полигон лассо с прямоугольником объекта (bounds).
 * Достаточно, что хотя бы один угол прямоугольника — внутри полигона.
 */
function lassoIntersectsRect(polygon, rect) {
    if (polygon.length < 3) return false;
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height },
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    ];
    return corners.some((c) => pointInPolygon(c, polygon));
}

/**
 * LassoSelectController — выделение объектов произвольным контуром.
 * Аналог BoxSelectController, но с polygon hit-test вместо AABB.
 */
export class LassoSelectController {
    constructor({ app, selection, emit, setSelection, clearSelection }) {
        this.app = app;
        this.selection = selection;
        this.emit = emit;
        this.setSelection = setSelection;
        this.clearSelection = clearSelection;

        this.isActive = false;
        this.points = [];
        this.lassoGraphics = null;
        this.initialSelection = null;
        this.isMultiSelect = false;
    }

    start(mouse, isMultiSelect) {
        this.isActive = true;
        this.isMultiSelect = !!isMultiSelect;
        this.points = [{ x: mouse.x, y: mouse.y }];
        this.initialSelection = this.selection.toArray();
        if (!this.isMultiSelect) this.clearSelection();

        if (this.app && this.app.stage) {
            this.app.stage.sortableChildren = true;
            this.lassoGraphics = new PIXI.Graphics();
            this.lassoGraphics.zIndex = 2000;
            this.lassoGraphics.name = 'lasso-select';
            this.app.stage.addChild(this.lassoGraphics);
        }
    }

    update(mouse) {
        if (!this.isActive) return;
        this.points.push({ x: mouse.x, y: mouse.y });
        this._redraw();
        this._updateSelection();
    }

    end() {
        if (!this.isActive) return;
        this._updateSelection();
        this.isActive = false;
        this.points = [];
        this._destroyGraphics();
    }

    _updateSelection() {
        if (this.points.length < 3) return;
        const request = { objects: [] };
        this.emit('get:all:objects', request);
        const matched = [];
        for (const item of request.objects) {
            if (lassoIntersectsRect(this.points, item.bounds)) matched.push(item.id);
        }
        let newSelection;
        if (this.isMultiSelect && this.initialSelection) {
            const base = new Set(this.initialSelection);
            for (const id of matched) base.add(id);
            newSelection = Array.from(base);
        } else {
            newSelection = matched;
        }
        this.setSelection(newSelection);
    }

    _redraw() {
        if (!this.lassoGraphics || this.points.length < 2) return;
        this.lassoGraphics.clear();
        this.lassoGraphics.lineStyle(2, 0x3b82f6, 0.9);
        this.lassoGraphics.beginFill(0x3b82f6, 0.08);
        this.lassoGraphics.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            this.lassoGraphics.lineTo(this.points[i].x, this.points[i].y);
        }
        this.lassoGraphics.closePath();
        this.lassoGraphics.endFill();
    }

    _destroyGraphics() {
        if (this.lassoGraphics) {
            if (this.lassoGraphics.parent) this.lassoGraphics.parent.removeChild(this.lassoGraphics);
            this.lassoGraphics.destroy();
            this.lassoGraphics = null;
        }
    }
}
