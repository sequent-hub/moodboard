import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { ConnectorBindingResolver, distanceToSegment } from '../../services/ConnectorBindingResolver.js';

const HIT_TEST_SCREEN_PX = 8;
const ARROW_LEN   = 12;
const ARROW_HALF  = 4;
const DASH_LEN    = 8;
const GAP_LEN     = 5;

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

/**
 * Рисует пунктирную линию через последовательность moveTo/lineTo.
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
 * Рисует треугольный наконечник стрелки в точке `to`, направление from→to.
 * Вызывать после g.lineStyle(0) не нужно — сбрасывает линию сам.
 * @param {PIXI.Graphics} g
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {number} color  PIXI-цвет
 */
function drawArrow(g, from, to, color) {
    const dx  = to.x - from.x;
    const dy  = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    // перпендикуляр
    const px = -uy;
    const py =  ux;
    const bx = to.x - ux * ARROW_LEN;
    const by = to.y - uy * ARROW_LEN;
    g.lineStyle(0);
    g.beginFill(color, 1);
    g.drawPolygon([
        Math.round(to.x),               Math.round(to.y),
        Math.round(bx + px * ARROW_HALF), Math.round(by + py * ARROW_HALF),
        Math.round(bx - px * ARROW_HALF), Math.round(by - py * ARROW_HALF),
    ]);
    g.endFill();
}

/**
 * ConnectorLayer — слой рендера универсальных коннекторов.
 *
 * Паттерн: MindmapConnectionLayer (один PIXI.Graphics, полная перерисовка на события).
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
        /** @type {Array<{ id: string, start: {x,y}, end: {x,y} }>} */
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
            this.graphics      = new PIXI.Graphics();
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
            const style        = connector?.properties?.style ?? {};
            const startTerm    = connector?.properties?.start;
            const endTerm      = connector?.properties?.end;
            if (!startTerm || !endTerm) return;

            const startTarget = startTerm.boundId ? (byId.get(startTerm.boundId) ?? null) : null;
            const endTarget   = endTerm.boundId   ? (byId.get(endTerm.boundId)   ?? null) : null;

            // Двухпроходное резолвание для корректной проекции isExact=false:
            // проход 1 — грубые точки (без взаимной информации)
            const roughStart = ConnectorBindingResolver.resolve(startTerm, startTarget, null);
            const roughEnd   = ConnectorBindingResolver.resolve(endTerm,   endTarget,   null);
            // проход 2 — уточнение с кромочной проекцией
            const start = ConnectorBindingResolver.resolve(startTerm, startTarget, roughEnd);
            const end   = ConnectorBindingResolver.resolve(endTerm,   endTarget,   start);

            const sx = Math.round(start.x);
            const sy = Math.round(start.y);
            const ex = Math.round(end.x);
            const ey = Math.round(end.y);

            const color  = style.stroke ?? 0x2563EB;
            const width  = style.width  ?? 2;
            const isDash = !!style.dash;
            const head   = style.head ?? { start: false, end: true };

            try {
                g.lineStyle({ width, color, alpha: 1, alignment: 0, cap: 'round', join: 'round' });
            } catch (_) {
                g.lineStyle(width, color, 1, 0);
            }

            if (isDash) {
                drawDashedLine(g, sx, sy, ex, ey);
            } else {
                g.moveTo(sx, sy);
                g.lineTo(ex, ey);
            }

            if (head?.end)   drawArrow(g, { x: sx, y: sy }, { x: ex, y: ey }, color);
            if (head?.start) drawArrow(g, { x: ex, y: ey }, { x: sx, y: sy }, color);

            this._lastSegments.push({ id: connector.id, start: { x: sx, y: sy }, end: { x: ex, y: ey } });
        });
    }

    /**
     * Возвращает id ближайшего коннектора, если worldPoint в пределах порога.
     * Порог задан в экранных пикселях, пересчитывается в world через текущий scale.
     *
     * @param {{ x: number, y: number }} worldPoint
     * @returns {string|null}
     */
    hitTest(worldPoint) {
        if (this._lastSegments.length === 0) return null;
        // worldLayer.scale.x = zoom; 1 screen px = 1/scale world units
        const scale          = this.core?.pixi?.worldLayer?.scale?.x ?? 1;
        const worldThreshold = HIT_TEST_SCREEN_PX / scale;
        let closest = null;
        let minDist = worldThreshold;
        for (const seg of this._lastSegments) {
            const d = distanceToSegment(worldPoint, seg.start, seg.end);
            if (d < minDist) {
                minDist = d;
                closest = seg.id;
            }
        }
        return closest;
    }
}
