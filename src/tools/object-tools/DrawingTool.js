import { BaseTool } from '../BaseTool.js';
import * as PIXI from 'pixi.js';

/**
 * Инструмент рисования (карандаш)
 */
export class DrawingTool extends BaseTool {
    constructor(eventBus) {
        super('draw', eventBus);
        this.cursor = 'crosshair';
        this.hotkey = 'd';

        // Состояние рисования
        this.isDrawing = false;
        this.points = [];
        this.tempGraphics = null;
        this.app = null;
        this.world = null;

        // Параметры кисти по умолчанию
        this.brush = {
            color: 0x111827, // чёрный
            width: 2,
            mode: 'pencil'
        };

        // Подписка на изменения кисти (резерв на будущее)
        if (this.eventBus) {
            this.eventBus.on('draw:brush:set', (data) => {
                if (!data) return;
                const patch = {};
                if (typeof data.width === 'number') patch.width = data.width;
                if (typeof data.color === 'number') patch.color = data.color;
                if (typeof data.mode === 'string') patch.mode = data.mode;
                this.brush = { ...this.brush, ...patch };
            });
        }
    }

    activate(app) {
        super.activate();
        this.app = app;
        this.world = this._getWorldLayer();
        // Кастомный курсор-карандаш (SVG)
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M4 20 L20 4 L28 12 L12 28 L4 28 Z' fill='black'/></svg>`;
        const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 0 16, crosshair`;
        if (this.app && this.app.view) this.app.view.style.cursor = url;
    }

    deactivate() {
        super.deactivate();
        if (this.app && this.app.view) this.app.view.style.cursor = '';
        this._finishAndCommit();
        this.app = null;
        this.world = null;
    }

    onMouseDown(event) {
        super.onMouseDown(event);
        if (!this.world) this.world = this._getWorldLayer();
        if (!this.world) return;

        this.isDrawing = true;
        this.points = [];
        this.tempGraphics = new PIXI.Graphics();
        this.world.addChild(this.tempGraphics);

        const p = this._toWorld(event.x, event.y);
        this.points.push(p);
        this._redrawTemporary();
    }

    onMouseMove(event) {
        super.onMouseMove(event);
        if (!this.isDrawing) return;
        const p = this._toWorld(event.x, event.y);
        const prev = this.points[this.points.length - 1];
        // Фильтр слишком частых точек
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) >= 1) {
            this.points.push(p);
            this._redrawTemporary();
        }
    }

    onMouseUp(event) {
        super.onMouseUp(event);
        this._finishAndCommit();
    }

    _finishAndCommit() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Если слишком мало точек — удаляем временную графику
        if (!this.points || this.points.length < 2) {
            if (this.tempGraphics && this.tempGraphics.parent) this.tempGraphics.parent.removeChild(this.tempGraphics);
            this.tempGraphics?.destroy();
            this.tempGraphics = null;
            this.points = [];
            return;
        }

        // Рассчитываем bbox в мировых координатах
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pt of this.points) {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        }
        const width = Math.max(1, Math.round(maxX - minX));
        const height = Math.max(1, Math.round(maxY - minY));

        // Нормализуем точки относительно левого-верхнего угла
        const normPoints = this.points.map(pt => ({ x: pt.x - minX, y: pt.y - minY }));

        // Создаем объект типа drawing через существующий пайплайн
        const position = { x: Math.round(minX), y: Math.round(minY) };
        const properties = {
            points: normPoints,
            strokeColor: this.brush.color,
            strokeWidth: this.brush.width,
            mode: this.brush.mode,
            // Базовые размеры для масштабирования при ресайзе
            baseWidth: width,
            baseHeight: height,
            // Передаём стартовый размер, чтобы ядро установило width/height у объекта
            width: width,
            height: height
        };

        // Важно: отправляем глобальное событие без префикса tool:
        this.eventBus.emit('toolbar:action', { type: 'drawing', id: 'drawing', position, properties });

        // Чистим временную графику
        if (this.tempGraphics && this.tempGraphics.parent) this.tempGraphics.parent.removeChild(this.tempGraphics);
        this.tempGraphics?.destroy();
        this.tempGraphics = null;
        this.points = [];
    }

    _redrawTemporary() {
        if (!this.tempGraphics) return;
        const g = this.tempGraphics;
        g.clear();
        const alpha = this.brush.mode === 'marker' ? 0.35 : 1;
        const lineWidth = this.brush.mode === 'marker' ? this.brush.width * 2 : this.brush.width;
        g.lineStyle(lineWidth, this.brush.color, alpha);
        const pts = this.points;
        if (pts.length === 0) return;
        // Рисуем сглаженную кривую с quadraticCurveTo
        if (pts.length < 3) {
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
            return;
        }
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
            const cx = pts[i].x;
            const cy = pts[i].y;
            const nx = pts[i + 1].x;
            const ny = pts[i + 1].y;
            const mx = (cx + nx) / 2;
            const my = (cy + ny) / 2;
            g.quadraticCurveTo(cx, cy, mx, my);
        }
        // Последний сегмент к конечной точке
        const pen = pts[pts.length - 2];
        const last = pts[pts.length - 1];
        g.quadraticCurveTo(pen.x, pen.y, last.x, last.y);
    }

    _toWorld(x, y) {
        if (!this.world) return { x, y };
        const global = new PIXI.Point(x, y);
        const local = this.world.toLocal(global);
        return { x: local.x, y: local.y };
    }

    _getWorldLayer() {
        if (!this.app || !this.app.stage) return null;
        const world = this.app.stage.getChildByName && this.app.stage.getChildByName('worldLayer');
        return world || this.app.stage; // фолбэк на stage
    }
}


