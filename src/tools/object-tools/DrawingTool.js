import { BaseTool } from '../BaseTool.js';
import { Events } from '../../core/events/Events.js';
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

        // Набор уже удалённых объектов в текущем мазке ластика
        this._eraserDeleted = new Set();
        this._eraserIdleTimer = null;

        // Подписка на изменения кисти (резерв на будущее)
        if (this.eventBus) {
            this.eventBus.on(Events.Draw.BrushSet, (data) => {
                if (!data) return;
                const patch = {};
                if (typeof data.width === 'number') patch.width = data.width;
                if (typeof data.color === 'number') patch.color = data.color;
                if (typeof data.mode === 'string') patch.mode = data.mode;
                this.brush = { ...this.brush, ...patch };
            });
            // Удаление объектов ластиком: кликаем по объекту — если попали, удаляем
            this.eventBus.on(Events.Tool.HitTest, (data) => {
                // Прокси для совместимости, не используем здесь
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
        if (this._eraserIdleTimer) {
            clearTimeout(this._eraserIdleTimer);
            this._eraserIdleTimer = null;
        }
        this.app = null;
        this.world = null;
    }

    onMouseDown(event) {
        super.onMouseDown(event);
        if (!this.world) this.world = this._getWorldLayer();
        if (!this.world) return;

        // Если режим ластика — попробуем удалить объект под курсором и показать временный след
        if (this.brush.mode === 'eraser') {
            const hitData = { x: event.x, y: event.y, result: null };
            this.emit(Events.Tool.HitTest, hitData);
            if (hitData.result && hitData.result.object) {
                // Проверяем, что это именно нарисованный объект (drawing)
                const pixReq = { objectId: hitData.result.object, pixiObject: null };
                this.emit(Events.Tool.GetObjectPixi, pixReq);
                const pixObj = pixReq.pixiObject;
                const isDrawing = !!(pixObj && pixObj._mb && pixObj._mb.type === 'drawing');
                if (isDrawing) {
                    this.eventBus.emit(Events.UI.ToolbarAction, { type: 'delete-object', id: hitData.result.object });
                }
            }
            // Рисуем временный след ластика
            this.isDrawing = true;
            this.points = [];
            this.tempGraphics = new PIXI.Graphics();
            this.world.addChild(this.tempGraphics);
            const p = this._toWorld(event.x, event.y);
            this.points.push(p);
            this._redrawTemporary();
            return;
        }

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
            // Ластик: при движении удаляем все фигуры, пересекаемые текущим сегментом
            if (this.brush.mode === 'eraser' && prev) {
                this._eraserSweep(prev, p);
            }
            this._redrawTemporary();
            // Переход в режим круга при остановке курсора
            if (this.brush.mode === 'eraser') {
                if (this._eraserIdleTimer) clearTimeout(this._eraserIdleTimer);
                this._eraserIdleTimer = setTimeout(() => {
                    if (!this.isDrawing || !this.tempGraphics) return;
                    // Форсируем перерисовку в режиме «стоит на месте»
                    this._redrawTemporary(true);
                }, 150);
            }
        }
    }

    onMouseUp(event) {
        super.onMouseUp(event);
        this._finishAndCommit();
    }

    _finishAndCommit() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Если ластик — чистим временную линию и выходим (удаление уже произошло onMouseDown)
        if (this.brush.mode === 'eraser') {
            if (this.tempGraphics && this.tempGraphics.parent) this.tempGraphics.parent.removeChild(this.tempGraphics);
            this.tempGraphics?.destroy();
            this.tempGraphics = null;
            this.points = [];
            this._eraserDeleted.clear();
            return;
        }

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
        this.eventBus.emit(Events.UI.ToolbarAction, { type: 'drawing', id: 'drawing', position, properties });

        // Чистим временную графику
        if (this.tempGraphics && this.tempGraphics.parent) this.tempGraphics.parent.removeChild(this.tempGraphics);
        this.tempGraphics?.destroy();
        this.tempGraphics = null;
        this.points = [];
    }

    _redrawTemporary(forceCircle = false) {
        if (!this.tempGraphics) return;
        const g = this.tempGraphics;
        g.clear();
        const pts = this.points;
        if (pts.length === 0) return;

        // Особая визуализация для ластика: кружок под курсором + короткий «хвост»
        if (this.brush.mode === 'eraser') {
            const color = 0x6B7280; // слегка светлее серый
            const maxAlpha = 0.6;
            const radius = 7; // базовая толщина = radius*2
            const tailMaxLen = 70; // чуть меньшая длина хвоста
            const last = pts[pts.length - 1];

            if (forceCircle || pts.length < 2) {
                // Кружок под курсором, когда стоим на месте
                g.beginFill(color, maxAlpha);
                g.drawCircle(last.x, last.y, radius);
                g.endFill();
            } else {
                // Формируем полилинию хвоста из последних точек так, чтобы суммарная длина ≤ tailMaxLen
                const tailPoints = [last];
                let acc = 0;
                for (let i = pts.length - 2; i >= 0; i--) {
                    const a = pts[i + 1];
                    const b = pts[i];
                    const dl = Math.hypot(a.x - b.x, a.y - b.y);
                    acc += dl;
                    tailPoints.push(b);
                    if (acc >= tailMaxLen) break;
                }
                tailPoints.reverse(); // от старых к новым

                // Пересэмплируем хвост равномерно для большей плотности (чтобы не было «бусинок»)
                const targetStep = 3; // px между соседними сэмплами
                const samples = [];
                // Накопитель вдоль полилинии
                let cursor = 0;
                let segIdx = 0;
                let segPos = 0; // позиция внутри сегмента
                // Считаем длины сегментов
                const segLens = [];
                for (let i = 0; i < tailPoints.length - 1; i++) {
                    const a = tailPoints[i];
                    const b = tailPoints[i + 1];
                    segLens.push(Math.hypot(b.x - a.x, b.y - a.y));
                }
                const totalLen = segLens.reduce((s, v) => s + v, 0);
                const sampleCount = Math.max(2, Math.floor(totalLen / targetStep));
                // Добавляем первый
                samples.push({ x: tailPoints[0].x, y: tailPoints[0].y });
                for (let k = 1; k < sampleCount; k++) {
                    const dist = k * (totalLen / (sampleCount - 1));
                    // Ищем сегмент, в котором находится эта дистанция
                    let d = 0;
                    let idx = 0;
                    while (idx < segLens.length && d + segLens[idx] < dist) {
                        d += segLens[idx++];
                    }
                    if (idx >= segLens.length) {
                        samples.push({ x: tailPoints[tailPoints.length - 1].x, y: tailPoints[tailPoints.length - 1].y });
                        continue;
                    }
                    const a = tailPoints[idx];
                    const b = tailPoints[idx + 1];
                    const t = (dist - d) / (segLens[idx] || 1);
                    samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
                }

                // Рисуем одну непрерывную ломаную, нарезанную на короткие штрихи с плавным альфа-градиентом
                const segCount = samples.length - 1;
                for (let i = 0; i < segCount; i++) {
                    const a = samples[i];
                    const b = samples[i + 1];
                    const t = (i + 1) / segCount; // 0..1, ближе к концу — плотнее
                    const alpha = Math.max(0.03, Math.pow(t, 1.2) * maxAlpha);
                    g.lineStyle({ width: radius * 2, color, alpha, cap: 'round', join: 'round' });
                    g.moveTo(a.x, a.y);
                    g.lineTo(b.x, b.y);
                }
            }
            return;
        }

        // Карандаш/маркер: сглаженная кривая
        const alpha = this.brush.mode === 'marker' ? 0.6 : 1;
        const lineWidth = this.brush.mode === 'marker' ? this.brush.width * 2 : this.brush.width;
        g.lineStyle({ width: lineWidth, color: this.brush.color, alpha, cap: 'round', join: 'round', miterLimit: 2, alignment: 0.5 });
        g.blendMode = this.brush.mode === 'marker' ? PIXI.BLEND_MODES.LIGHTEN : PIXI.BLEND_MODES.NORMAL;

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

    // Удаляет все объекты, пересекаемые сегментом ластика prev→p
    _eraserSweep(prev, p) {
        const req = { objects: [] };
        this.emit('get:all:objects', req);
        const objects = req.objects || [];
        // Радиус воздействия ластика (связан с отображаемой толщиной)
        const radius = 8;
        const segMinX = Math.min(prev.x, p.x) - radius;
        const segMaxX = Math.max(prev.x, p.x) + radius;
        const segMinY = Math.min(prev.y, p.y) - radius;
        const segMaxY = Math.max(prev.y, p.y) + radius;

        for (const item of objects) {
            const id = item.id;
            if (this._eraserDeleted.has(id)) continue;
            const pixi = item.pixi;
            if (!pixi) continue;

            // Быстрая проверка по bbox объекта
            const b = item.bounds;
            if (!b) continue;
            if (b.x > segMaxX || b.x + b.width < segMinX || b.y > segMaxY || b.y + b.height < segMinY) {
                continue;
            }

            const meta = pixi._mb || {};
            const type = meta.type;
            let intersects = false;

            if (type === 'drawing') {
                const props = meta.properties || {};
                const pts = Array.isArray(props.points) ? props.points : [];
                if (pts.length >= 2) {
                    // Оценка масштабов
                    const baseW = props.baseWidth || 1;
                    const baseH = props.baseHeight || 1;
                    const scaleX = baseW ? (b.width / baseW) : 1;
                    const scaleY = baseH ? (b.height / baseH) : 1;
                    const eraserThresh = Math.max(6, (props.strokeWidth || 2) / 2 + radius);
                    // трансформируем сегмент ластика в локальные координаты фигуры
                    const localPrev = pixi.toLocal(new PIXI.Point(prev.x, prev.y));
                    const localCurr = pixi.toLocal(new PIXI.Point(p.x, p.y));
                    // Проверяем пересечение с каждым отрезком рисунка
                    for (let i = 0; i < pts.length - 1 && !intersects; i++) {
                        const ax = pts[i].x * scaleX;
                        const ay = pts[i].y * scaleY;
                        const bx = pts[i + 1].x * scaleX;
                        const by = pts[i + 1].y * scaleY;
                        const d = this._distancePointToSegment(localPrev.x, localPrev.y, ax, ay, bx, by);
                        const d2 = this._distancePointToSegment(localCurr.x, localCurr.y, ax, ay, bx, by);
                        if (Math.min(d, d2) <= eraserThresh) intersects = true;
                    }
                }
            }

            if (intersects) {
                this._eraserDeleted.add(id);
                this.eventBus.emit(Events.UI.ToolbarAction, { type: 'delete-object', id });
            }
        }
    }

    _distancePointToSegment(px, py, ax, ay, bx, by) {
        const abx = bx - ax;
        const aby = by - ay;
        const apx = px - ax;
        const apy = py - ay;
        const ab2 = abx * abx + aby * aby;
        if (ab2 === 0) return Math.hypot(px - ax, py - ay);
        let t = (apx * abx + apy * aby) / ab2;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * abx;
        const cy = ay + t * aby;
        return Math.hypot(px - cx, py - cy);
    }
}


