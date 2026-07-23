import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { isHiddenByCollapsedAncestor } from './MindmapCollapseGraph.js';

const MINDMAP_TYPE = 'mindmap';
const SIDE_LEFT = 'left';
const SIDE_RIGHT = 'right';
const SIDE_BOTTOM = 'bottom';

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function asMindmapMeta(obj) {
    return obj?.properties?.mindmap || {};
}

function isMindmap(obj) {
    return obj?.type === MINDMAP_TYPE;
}

function asNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

function getNodeRect(node) {
    const x = asNumber(node?.position?.x, 0);
    const y = asNumber(node?.position?.y, 0);
    const width = Math.max(1, Math.round(asNumber(node?.width, asNumber(node?.properties?.width, 1))));
    const height = Math.max(1, Math.round(asNumber(node?.height, asNumber(node?.properties?.height, 1))));
    return { x, y, width, height };
}

function getAnchorPoint(node, side) {
    const rect = getNodeRect(node);
    if (side === SIDE_LEFT) {
        return { x: rect.x, y: rect.y + rect.height / 2 };
    }
    if (side === SIDE_RIGHT) {
        return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    }
    if (side === SIDE_BOTTOM) {
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    }
    return { x: rect.x + rect.width / 2, y: rect.y };
}

function nudgeStartOutsideNode(point, side) {
    const px = 1;
    if (side === SIDE_LEFT) return { x: point.x - px, y: point.y };
    if (side === SIDE_RIGHT) return { x: point.x + px, y: point.y };
    if (side === SIDE_BOTTOM) return { x: point.x, y: point.y + px };
    return point;
}

function getChildAttachSide(parentSide) {
    if (parentSide === SIDE_LEFT) return SIDE_RIGHT;
    if (parentSide === SIDE_RIGHT) return SIDE_LEFT;
    if (parentSide === SIDE_BOTTOM) return 'top';
    return 'top';
}

function getBezierControls(start, end, side) {
    if (side === SIDE_BOTTOM) {
        const spanY = Math.max(30, Math.abs(end.y - start.y) * 0.5);
        return {
            cp1: { x: start.x, y: start.y + spanY },
            cp2: { x: end.x, y: end.y - spanY },
        };
    }
    const dir = side === SIDE_LEFT ? -1 : 1;
    const spanX = Math.max(30, Math.abs(end.x - start.x) * 0.5);
    return {
        cp1: { x: start.x + spanX * dir, y: start.y },
        cp2: { x: end.x - spanX * dir, y: end.y },
    };
}

function cubicPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return {
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
}

function drawRibbon(g, start, cp1, cp2, end, color, width) {
    const STEPS = 24;
    const half = width / 2;
    const pts = [];
    for (let i = 0; i <= STEPS; i++) {
        pts.push(cubicPoint(start, cp1, cp2, end, i / STEPS));
    }
    const top = [], bottom = [];
    for (let i = 0; i <= STEPS; i++) {
        const p = pts[i];
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(STEPS, i + 1)];
        const dx = next.x - prev.x, dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        top.push({ x: p.x + nx * half, y: p.y + ny * half });
        bottom.push({ x: p.x - nx * half, y: p.y - ny * half });
    }
    g.beginFill(color, 1);
    g.moveTo(top[0].x, top[0].y);
    for (let i = 1; i <= STEPS; i++) g.lineTo(top[i].x, top[i].y);
    for (let i = STEPS; i >= 0; i--) g.lineTo(bottom[i].x, bottom[i].y);
    g.closePath();
    g.endFill();
}

function resolveLegacyLink(child, byId, rootByCompoundId) {
    const childMeta = asMindmapMeta(child);
    const compoundId = childMeta?.compoundId || null;
    let parentId = childMeta?.parentId || null;
    let side = childMeta?.side || null;
    const childId = child?.id || null;

    if (!parentId || parentId === childId) {
        parentId = childMeta?.branchRootId || null;
    }

    let parent = parentId ? byId.get(parentId) : null;
    if (!parent && compoundId) {
        parentId = rootByCompoundId.get(compoundId) || null;
        parent = parentId ? byId.get(parentId) : null;
    }

    if (![SIDE_LEFT, SIDE_RIGHT, SIDE_BOTTOM].includes(side)) {
        side = SIDE_RIGHT;
    }
    if (parentId === childId && compoundId) {
        const rootId = rootByCompoundId.get(compoundId) || null;
        if (rootId && rootId !== childId) parentId = rootId;
    }
    return { parentId, side };
}

export class MindmapConnectionLayer {
    constructor(eventBus, core) {
        this.eventBus = eventBus;
        this.core = core;
        this.graphics = null;
        this.subscriptions = [];
        this._lastSegments = [];
        this._eventsAttached = false;
    }

    attach() {
        if (!this.core?.pixi) return;
        if (!this._eventsAttached) {
            this._attachEvents();
        }
        this.updateAll();
    }

    destroy() {
        this._detachEvents();
        if (this.graphics) {
            this.graphics.clear();
            this.graphics.removeFromParent();
            this.graphics.destroy();
            this.graphics = null;
        }
        this._lastSegments = [];
    }

    _attachEvents() {
        if (this._eventsAttached) return;
        const bindings = [
            [Events.Object.Created, () => this.updateAll()],
            [Events.Object.Deleted, () => this.updateAll()],
            [Events.Object.Updated, () => this.updateAll()],
            [Events.Object.StateChanged, () => this.updateAll()],
            [Events.Tool.DragUpdate, () => this.updateAll()],
            [Events.Tool.DragEnd, () => this.updateAll()],
            [Events.Tool.ResizeUpdate, () => this.updateAll()],
            [Events.Tool.ResizeEnd, () => this.updateAll()],
            [Events.Tool.GroupDragUpdate, () => this.updateAll()],
            [Events.Tool.GroupResizeUpdate, () => this.updateAll()],
            [Events.Tool.RotateUpdate, () => this.updateAll()],
            [Events.Tool.PanUpdate, () => this.updateAll()],
            [Events.Viewport.Changed, () => this.updateAll()],
            [Events.UI.ZoomPercent, () => this.updateAll()],
            [Events.History.Changed, () => this.updateAll()],
            [Events.Board.Loaded, () => this.updateAll()],
        ];
        bindings.forEach(([event, handler]) => {
            this.eventBus.on(event, handler);
            this.subscriptions.push([event, handler]);
        });
        this._eventsAttached = true;
    }

    _detachEvents() {
        if (typeof this.eventBus?.off !== 'function') {
            this.subscriptions = [];
            return;
        }
        this.subscriptions.forEach(([event, handler]) => this.eventBus.off(event, handler));
        this.subscriptions = [];
        this._eventsAttached = false;
    }

    updateAll() {
        const objects = asArray(this.core?.state?.state?.objects);
        const mindmaps = objects.filter(isMindmap);
        const byId = new Map(mindmaps.map((obj) => [obj.id, obj]));
        const rootByCompoundId = new Map();
        mindmaps.forEach((obj) => {
            const meta = asMindmapMeta(obj);
            if (meta?.role === 'root' && typeof meta?.compoundId === 'string' && meta.compoundId.length > 0) {
                rootByCompoundId.set(meta.compoundId, obj.id);
            }
        });
        const children = mindmaps.filter((obj) => {
            const meta = asMindmapMeta(obj);
            return meta.role === 'child' && typeof meta.parentId === 'string' && meta.parentId.length > 0;
        });

        if (children.length === 0) {
            if (this.graphics) {
                this.graphics.clear();
            }
            this._lastSegments = [];
            return;
        }

        if (!this.graphics) {
            this.graphics = new PIXI.Graphics();
            this.graphics.name = 'mindmap-connection-layer';
            // Коннекторы рисуем ПОД узлами (узлы имеют zIndex 0), иначе начало
            // ленты у ребра капсулы закрашивается поверх неё и торчит из-под узла.
            this.graphics.zIndex = -1;
            const world = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
            world?.addChild?.(this.graphics);
        }

        const g = this.graphics;
        g.clear();
        this._lastSegments = [];

        children.forEach((child) => {
            if (isHiddenByCollapsedAncestor(mindmaps, child.id)) return;

            const childMeta = asMindmapMeta(child);
            const { parentId, side } = resolveLegacyLink(child, byId, rootByCompoundId);
            const parent = parentId ? byId.get(parentId) : null;
            if (!parent || ![SIDE_LEFT, SIDE_RIGHT, SIDE_BOTTOM].includes(side)) return;

            const parentMeta = asMindmapMeta(parent);
            if (parentMeta.compoundId && childMeta.compoundId && parentMeta.compoundId !== childMeta.compoundId) {
                return;
            }

            const startBase = getAnchorPoint(parent, side);
            const start = nudgeStartOutsideNode(startBase, side);
            const end = getAnchorPoint(child, getChildAttachSide(side));
            const { cp1, cp2 } = getBezierControls(start, end, side);
            const color = Number(
                childMeta.branchColor
                ?? parentMeta.branchColor
                ?? child?.properties?.strokeColor
                ?? parent?.properties?.strokeColor
                ?? 0x2563EB
            );

            const scale = this.core?.pixi?.worldLayer?.scale?.x || 1;
            const width = 1 / scale;
            drawRibbon(g, start, cp1, cp2, end, color, width);
            this._lastSegments.push({
                parentId: parent.id,
                childId: child.id,
                side,
                start: { x: Math.round(start.x), y: Math.round(start.y) },
                end: { x: Math.round(end.x), y: Math.round(end.y) },
            });
        });
    }
}
