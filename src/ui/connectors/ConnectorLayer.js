import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { ConnectorBindingResolver, distanceToSegment } from '../../services/ConnectorBindingResolver.js';
import { buildPath, bezierControlPoints, sampleBezier, BEZIER_SAMPLES } from '../../services/ConnectorRouter.js';
import { routeElbowAvoiding } from '../../services/ConnectorObstacleRouter.js';
import { drawHead, getLineTrim, trimPolylineEnd } from './connectorHeadGeometry.js';

const HIT_TEST_SCREEN_PX = 8;
const DASH_LEN       = 8;
const GAP_LEN        = 5;
const ELBOW_RADIUS   = 14;

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

/** Возвращает центр объекта (world) или свободную точку терминала. */
function getObjectCenter(terminal, target) {
    if (!terminal?.boundId) {
        return { x: terminal?.point?.x ?? 0, y: terminal?.point?.y ?? 0 };
    }
    if (!target) return { x: 0, y: 0 };
    const left = target.position?.x ?? 0;
    const top  = target.position?.y ?? 0;
    const w    = target.width  ?? target.properties?.width  ?? 0;
    const h    = target.height ?? target.properties?.height ?? 0;
    return { x: left + w / 2, y: top + h / 2 };
}

/** Нормализует HeadKind: boolean (обратная совместимость) → строка. */
function normalizeHeadKind(value) {
    if (value === true)  return 'arrow';
    if (value === false) return 'none';
    return typeof value === 'string' ? value : 'none';
}

function normalizeHead(head) {
    if (!head) return { start: 'none', end: 'arrow' };
    return {
        start: normalizeHeadKind(head.start),
        end:   normalizeHeadKind(head.end),
    };
}

/**
 * Пунктирная линия по одному отрезку.
 * @param {PIXI.Graphics} g
 */
function drawDashedLine(g, x1, y1, x2, y2) {
    const dx  = x2 - x1;
    const dy  = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    let dist    = 0;
    let drawing = true;
    g.moveTo(Math.round(x1), Math.round(y1));
    while (dist < len) {
        const step = drawing ? DASH_LEN : GAP_LEN;
        const next = Math.min(dist + step, len);
        const px   = x1 + ux * next;
        const py   = y1 + uy * next;
        if (drawing) {
            g.lineTo(Math.round(px), Math.round(py));
        } else {
            g.moveTo(Math.round(px), Math.round(py));
        }
        dist    = next;
        drawing = !drawing;
    }
}

/**
 * Сплошная ломаная; для elbow скругляет углы дугой quadraticCurveTo.
 *
 * @param {PIXI.Graphics} g
 * @param {Array<{x:number,y:number}>} pts
 * @param {boolean} isElbow  включить скругление углов
 */
function drawPolylineSolid(g, pts, isElbow) {
    if (pts.length < 2) return;
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const next = pts[i + 1];
        if (!isElbow) {
            g.lineTo(curr.x, curr.y);
            continue;
        }
        const dxIn  = curr.x - prev.x;
        const dyIn  = curr.y - prev.y;
        const lenIn = Math.hypot(dxIn, dyIn);
        const dxOut  = next.x - curr.x;
        const dyOut  = next.y - curr.y;
        const lenOut = Math.hypot(dxOut, dyOut);
        if (lenIn < 1e-6 || lenOut < 1e-6) {
            g.lineTo(curr.x, curr.y);
            continue;
        }
        const r   = Math.min(ELBOW_RADIUS, lenIn / 2, lenOut / 2);
        const iux = dxIn  / lenIn;
        const iuy = dyIn  / lenIn;
        const oux = dxOut / lenOut;
        const ouy = dyOut / lenOut;
        g.lineTo(Math.round(curr.x - iux * r), Math.round(curr.y - iuy * r));
        g.quadraticCurveTo(curr.x, curr.y,
            Math.round(curr.x + oux * r), Math.round(curr.y + ouy * r));
    }
    g.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

/** Пунктирная ломаная по массиву точек. */
function drawPolylineDash(g, pts) {
    for (let i = 1; i < pts.length; i++) {
        drawDashedLine(g, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
}

/** Рисует кубическую кривую Безье через bezierCurveTo (или пунктирную аппроксимацию). */
function drawBezierCurve(g, start, end, isDash, startDir = null, endDir = null) {
    const { cp1, cp2 } = bezierControlPoints(start, end, startDir, endDir);
    if (isDash) {
        const pts = [];
        for (let i = 0; i <= BEZIER_SAMPLES; i++) {
            pts.push(sampleBezier(start, cp1, cp2, end, i / BEZIER_SAMPLES));
        }
        drawPolylineDash(g, pts);
        return;
    }
    g.moveTo(start.x, start.y);
    g.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
}

/**
 * ConnectorLayer — слой рендера универсальных коннекторов.
 *
 * Паттерн: один PIXI.Graphics, полная перерисовка на события.
 * Рисует connector-объекты из state.objects в worldLayer.
 * Резолвинг end-point: ConnectorBindingResolver.resolve() двумя проходами
 * (грубый → точный) для корректной проекции на кромку при isExact=false.
 */
export class ConnectorLayer {
    /**
     * @param {Object} eventBus  Экземпляр EventBus
     * @param {Object} core      Экземпляр CoreMoodBoard
     */
    constructor(eventBus, core) {
        this.eventBus        = eventBus;
        this.core            = core;
        this.graphics        = null;
        this.subscriptions   = [];
        this._eventsAttached = false;
        /** @type {Array<{ id: string, points: Array<{x:number,y:number}> }>} */
        this._lastSegments   = [];
    }

    /** Инициализирует слой: подписки на события и первый рендер. */
    attach() {
        if (!this.core?.pixi) return;
        if (!this._eventsAttached) {
            this._attachEvents();
        }
        this.updateAll();
    }

    /** Уничтожает слой: отписка от событий и очистка PIXI-объектов. */
    destroy() {
        this._detachEvents();
        if (this.graphics) {
            this.graphics.clear();
            this.graphics.removeFromParent();
            this.graphics.destroy();
            this.graphics = null;
        }
        this._lastSegments = [];
        this.eventBus = null;
        this.core     = null;
    }

    _attachEvents() {
        if (this._eventsAttached) return;
        const bindings = [
            [Events.Object.Created,          () => this.updateAll()],
            [Events.Object.Deleted,          () => this.updateAll()],
            [Events.Object.Updated,          () => this.updateAll()],
            [Events.Object.StateChanged,     () => this.updateAll()],
            [Events.Tool.DragUpdate,         () => this.updateAll()],
            [Events.Tool.DragEnd,            () => this.updateAll()],
            [Events.Tool.ResizeUpdate,       () => this.updateAll()],
            [Events.Tool.ResizeEnd,          () => this.updateAll()],
            [Events.Tool.GroupDragUpdate,    () => this.updateAll()],
            [Events.Tool.GroupResizeUpdate,  () => this.updateAll()],
            [Events.Tool.RotateUpdate,       () => this.updateAll()],
            [Events.Tool.PanUpdate,          () => this.updateAll()],
            [Events.Viewport.Changed,        () => this.updateAll()],
            [Events.UI.ZoomPercent,          () => this.updateAll()],
            [Events.History.Changed,         () => this.updateAll()],
            [Events.Board.Loaded,            () => this.updateAll()],
        ];
        bindings.forEach(([event, handler]) => {
            this.eventBus.on(event, handler);
            this.subscriptions.push([event, handler]);
        });
        this._eventsAttached = true;
    }

    _detachEvents() {
        if (typeof this.eventBus?.off !== 'function') {
            this.subscriptions   = [];
            this._eventsAttached = false;
            return;
        }
        this.subscriptions.forEach(([event, handler]) => this.eventBus.off(event, handler));
        this.subscriptions   = [];
        this._eventsAttached = false;
    }

    /** Перерисовывает все коннекторы из state. */
    updateAll() {
        const objects    = asArray(this.core?.state?.state?.objects);
        const connectors = objects.filter((o) => o?.type === 'connector');

        if (connectors.length === 0) {
            if (this.graphics) this.graphics.clear();
            this._lastSegments = [];
            return;
        }

        if (!this.graphics) {
            this.graphics        = new PIXI.Graphics();
            this.graphics.name   = 'connector-layer';
            this.graphics.zIndex = 3;
            const world = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
            world?.addChild?.(this.graphics);
        }

        const byId = new Map(objects.map((o) => [o.id, o]));
        const g    = this.graphics;
        g.clear();
        this._lastSegments = [];

        connectors.forEach((connector) => {
            const style     = connector?.properties?.style ?? {};
            const startTerm = connector?.properties?.start;
            const endTerm   = connector?.properties?.end;
            if (!startTerm || !endTerm) return;

            const startTarget = startTerm.boundId ? (byId.get(startTerm.boundId) ?? null) : null;
            const endTarget   = endTerm.boundId   ? (byId.get(endTerm.boundId)   ?? null) : null;

            const color  = style.stroke ?? 0x2563EB;
            const width  = style.width  ?? 2;
            const isDash = !!style.dash;
            const route  = style.route  ?? 'straight';
            const head   = normalizeHead(style.head);

            let sx, sy, ex, ey, startDir = null, endDir = null;

            if (route === 'elbow' || route === 'bezier') {
                // Для elbow/bezier — резолв через грань с перпендикулярным выходом
                const startCenter = getObjectCenter(startTerm, startTarget);
                const endCenter   = getObjectCenter(endTerm,   endTarget);
                const startDesc   = ConnectorBindingResolver.resolveWithSide(startTerm, startTarget, endCenter);
                const endDesc     = ConnectorBindingResolver.resolveWithSide(endTerm,   endTarget,   startCenter);
                sx       = Math.round(startDesc.point.x);
                sy       = Math.round(startDesc.point.y);
                ex       = Math.round(endDesc.point.x);
                ey       = Math.round(endDesc.point.y);
                startDir = startDesc.dir;
                endDir   = endDesc.dir;
            } else {
                // straight: двухпроходный резолв (кромочная проекция по лучу центр-центр)
                const roughStart = ConnectorBindingResolver.resolve(startTerm, startTarget, null);
                const roughEnd   = ConnectorBindingResolver.resolve(endTerm,   endTarget,   null);
                const start      = ConnectorBindingResolver.resolve(startTerm, startTarget, roughEnd);
                const end        = ConnectorBindingResolver.resolve(endTerm,   endTarget,   start);
                sx = Math.round(start.x);
                sy = Math.round(start.y);
                ex = Math.round(end.x);
                ey = Math.round(end.y);
            }

            try {
                g.lineStyle({ width, color, alpha: 1, alignment: 0.5, cap: 'round', join: 'round' });
            } catch (_) {
                g.lineStyle(width, color, 1, 0.5);
            }

            let pts;
            if (route === 'elbow' && startDir && endDir) {
                const obstacles = this._collectObstacles(objects, [startTerm.boundId, endTerm.boundId]);
                pts = routeElbowAvoiding({ x: sx, y: sy }, startDir, { x: ex, y: ey }, endDir, obstacles);
            } else {
                pts = buildPath({ x: sx, y: sy }, { x: ex, y: ey }, route, startDir, endDir);
            }

            // Для рисования линии: укорачиваем концы на длину маркера плюс просвет,
            // чтобы stroke не заходил внутрь наконечника и не сливался с его крыльями.
            // Оригинальный pts используется только для drawHead (кончик остаётся точным).
            let drawPts = pts.slice();
            if (head.end !== 'none') {
                drawPts = trimPolylineEnd(drawPts, getLineTrim(head.end));
            }
            if (head.start !== 'none') {
                drawPts = trimPolylineEnd(drawPts.slice().reverse(), getLineTrim(head.start)).reverse();
            }

            const drawStart = drawPts[0];
            const drawEnd   = drawPts[drawPts.length - 1];

            if (route === 'bezier') {
                drawBezierCurve(g, drawStart, drawEnd, isDash, startDir, endDir);
            } else if (isDash) {
                drawPolylineDash(g, drawPts);
            } else {
                drawPolylineSolid(g, drawPts, route === 'elbow');
            }

            if (head.end !== 'none' && pts.length >= 2) {
                drawHead(g, pts[pts.length - 2], pts[pts.length - 1], color, head.end, width);
            }
            if (head.start !== 'none' && pts.length >= 2) {
                drawHead(g, pts[1], pts[0], color, head.start, width);
            }

            this._lastSegments.push({ id: connector.id, points: pts });
        });
    }

    /**
     * Собирает bbox-препятствия для обхода elbow-коннектором.
     * Исключаются объекты-коннекторы и оба конца текущего коннектора.
     *
     * @param {Array<Object>} objects все объекты доски
     * @param {Array<string|undefined>} excludeIds id объектов-концов
     * @returns {Array<{x:number,y:number,width:number,height:number}>}
     */
    _collectObstacles(objects, excludeIds) {
        const exclude = new Set((excludeIds || []).filter(Boolean));
        const rects = [];
        for (const o of objects) {
            if (!o || o.type === 'connector') continue;
            if (exclude.has(o.id)) continue;
            const x = o.position?.x;
            const y = o.position?.y;
            const w = o.width ?? o.properties?.width;
            const h = o.height ?? o.properties?.height;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !(w > 0) || !(h > 0)) continue;
            rects.push({ x, y, width: w, height: h });
        }
        return rects;
    }

    /**
     * Возвращает id ближайшего коннектора, если worldPoint в пределах порога.
     * Порог задан в экранных пикселях, пересчитывается в world через текущий scale.
     * Проверяет каждую пару соседних точек сохранённого пути (ломаная/аппроксимация).
     *
     * @param {{ x: number, y: number }} worldPoint
     * @returns {string|null}
     */
    hitTest(worldPoint) {
        if (this._lastSegments.length === 0) return null;
        const scale          = this.core?.pixi?.worldLayer?.scale?.x ?? 1;
        const worldThreshold = HIT_TEST_SCREEN_PX / scale;
        let closest = null;
        let minDist = worldThreshold;
        for (const seg of this._lastSegments) {
            const pts = seg.points;
            for (let i = 1; i < pts.length; i++) {
                const d = distanceToSegment(worldPoint, pts[i - 1], pts[i]);
                if (d < minDist) {
                    minDist = d;
                    closest = seg.id;
                }
            }
        }
        return closest;
    }
}
