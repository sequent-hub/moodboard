import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    terminalWorldPoint,
    computeAnchor,
    drawPreview,
    createConnectorFromTerminals,
} from './connectorGesture.js';

/** Минимальное смещение (px) для старта drag. */
const DRAG_THRESHOLD = 4;
/** Порог «у кромки» в CSS-пикселях. */
const EDGE_THRESHOLD_CSS = 10;
/** Радиус поиска ближайшего объекта при клике по якорю (world-px). */
const CLICK_FIND_RADIUS = 400;
/** Зазор между дубликатом и источником при автосоздании (world-px). */
const CLONE_GAP = 40;
/** Типы объектов, к которым можно привязать коннектор (из ConnectionAnchorsLayer). */
const ALLOWED_BIND_TYPES = new Set(['shape', 'note', 'image', 'text', 'simple-text', 'file']);

/**
 * Обрабатывает жест «pointerdown на точке подключения → drag → drop»
 * без переключения инструмента. Создаёт коннектор через connectorGesture.
 */
export class ConnectorDragController {
    constructor(core, eventBus) {
        this.core = core;
        this.eventBus = eventBus;
        this._sourceTerminal = null;
        this._previewGraphics = null;
        this._highlightGraphics = null;
        this._dragging = false;
        this._pendingDupListener = null;
        this._startX = 0;
        this._startY = 0;
        this._boundMove = this._onMove.bind(this);
        this._boundUp   = this._onUp.bind(this);
    }

    /**
     * Вызывается из ConnectionAnchorsLayer на pointerdown по точке привязки.
     * domEvent.target обязан иметь dataset: id, anchorX, anchorY.
     */
    startFromAnchor(domEvent) {
        const el = domEvent.target;
        this._sourceTerminal = {
            boundId: el.dataset.id,
            anchor: { x: parseFloat(el.dataset.anchorX), y: parseFloat(el.dataset.anchorY) },
            isPrecise: true,
            isExact: false,
        };
        this._startX   = domEvent.clientX;
        this._startY   = domEvent.clientY;
        this._dragging = false;
        document.addEventListener('pointermove', this._boundMove);
        document.addEventListener('pointerup',   this._boundUp);
    }

    // ─── Утилиты ──────────────────────────────────────────────────────────────

    _world() {
        const pixi = this.core?.pixi;
        if (!pixi?.app?.stage) return null;
        return pixi.worldLayer
            || pixi.app.stage.getChildByName?.('worldLayer')
            || pixi.app.stage;
    }

    /** clientX/Y → world-coords через worldLayer.toLocal (канон ConnectorTool). */
    _toWorld(clientX, clientY) {
        const world = this._world();
        if (!world) return { x: clientX, y: clientY };
        const rect = this.core.pixi.app.view.getBoundingClientRect();
        return world.toLocal(new PIXI.Point(clientX - rect.left, clientY - rect.top));
    }

    /** screen-coords для HitTest = canvas-relative px. */
    _hitTest(clientX, clientY) {
        const rect = this.core?.pixi?.app?.view?.getBoundingClientRect();
        if (!rect) return null;
        const hitData = { x: clientX - rect.left, y: clientY - rect.top, result: null };
        this.eventBus.emit(Events.Tool.HitTest, hitData);
        return hitData.result?.object || null;
    }

    _objectBounds(objectId) {
        const posData  = { objectId, position: null };
        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (!posData.position || !sizeData.size) return null;
        return { x: posData.position.x, y: posData.position.y, ...sizeData.size };
    }

    /** Возвращает true, если worldPt находится в пределах EDGE_THRESHOLD_CSS от кромки. */
    _nearEdge(bounds, worldPt) {
        const scale = this._world()?.scale?.x || 1;
        const thr = EDGE_THRESHOLD_CSS / scale;
        const { x, y, width, height } = bounds;
        return Math.min(
            worldPt.x - x, x + width  - worldPt.x,
            worldPt.y - y, y + height - worldPt.y,
        ) <= thr;
    }

    /**
     * Определяет endTerminal по правилам CONNECTORS.md / ConnectorBindingResolver:
     *  - над кромкой объекта (≤10 CSS px) → isPrecise:true, точный якорь
     *  - над телом объекта              → isPrecise:false, центр {0.5,0.5}
     *  - над пустотой                   → свободная point
     */
    _resolveEnd(clientX, clientY, sourceBoundId) {
        const worldPt  = this._toWorld(clientX, clientY);
        const objectId = this._hitTest(clientX, clientY);

        if (objectId && objectId !== sourceBoundId) {
            const bounds = this._objectBounds(objectId);
            if (bounds) {
                if (this._nearEdge(bounds, worldPt)) {
                    return {
                        boundId: objectId,
                        anchor: computeAnchor(this.eventBus, objectId, worldPt),
                        isPrecise: true,
                        isExact: false,
                    };
                }
                return { boundId: objectId, anchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false };
            }
        }
        return { point: worldPt };
    }

    // ─── Handlers ─────────────────────────────────────────────────────────────

    _onMove(e) {
        if (!this._sourceTerminal) return;

        if (!this._dragging) {
            if (Math.abs(e.clientX - this._startX) < DRAG_THRESHOLD
             && Math.abs(e.clientY - this._startY) < DRAG_THRESHOLD) return;
            this._dragging = true;
            const world = this._world();
            if (world) {
                this._previewGraphics   = new PIXI.Graphics();
                this._highlightGraphics = new PIXI.Graphics();
                world.addChild(this._previewGraphics);
                world.addChild(this._highlightGraphics);
            }
        }

        if (!this._previewGraphics) return;

        const worldPt = this._toWorld(e.clientX, e.clientY);
        const fromPt  = terminalWorldPoint(this.eventBus, this._sourceTerminal);
        drawPreview(this._previewGraphics, fromPt, worldPt);

        this._highlightGraphics.clear();
        const objectId = this._hitTest(e.clientX, e.clientY);
        if (objectId && objectId !== this._sourceTerminal?.boundId) {
            const bounds = this._objectBounds(objectId);
            if (bounds) {
                this._highlightGraphics.lineStyle({ width: 2, color: 0x2563EB, alpha: 0.85 });
                this._highlightGraphics.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
            }
        }
    }

    _onUp(e) {
        document.removeEventListener('pointermove', this._boundMove);
        document.removeEventListener('pointerup',   this._boundUp);

        const wasDragging = this._dragging;
        const source      = this._sourceTerminal;
        this._dragging        = false;
        this._sourceTerminal  = null;
        this._clearGraphics();

        if (!source) return;
        if (!wasDragging) {
            this._onAnchorClick(source);
            return;
        }

        const end = this._resolveEnd(e.clientX, e.clientY, source.boundId);
        createConnectorFromTerminals(this.core, this.eventBus, source, end);
    }

    // ─── Клик по якорю (без drag) ────────────────────────────────────────────

    /** Определяет сторону объекта по нормализованному якорю [0,1]. */
    _sideFromAnchor(anchor) {
        const ax = anchor?.x ?? 0.5;
        const ay = anchor?.y ?? 0.5;
        if (ax <= 0.1) return 'left';
        if (ax >= 0.9) return 'right';
        if (ay <= 0.1) return 'top';
        if (ay >= 0.9) return 'bottom';
        return 'right';
    }

    /**
     * Ищет ближайший допустимый объект, чей центр лежит в полуплоскости
     * от стороны side и в пределах radius world-px.
     */
    _findNearestInHalfplane(sourceId, sourceBounds, side, radius) {
        const cx = sourceBounds.x + sourceBounds.width  / 2;
        const cy = sourceBounds.y + sourceBounds.height / 2;
        const objects = this.core?.state?.state?.objects;
        if (!Array.isArray(objects)) return null;

        let best = null, bestDist = Infinity;
        for (const obj of objects) {
            if (!obj || obj.id === sourceId) continue;
            if (!ALLOWED_BIND_TYPES.has(obj.type)) continue;
            const bounds = this._objectBounds(obj.id);
            if (!bounds) continue;
            const ocx = bounds.x + bounds.width  / 2;
            const ocy = bounds.y + bounds.height / 2;
            if (side === 'right'  && ocx <= cx) continue;
            if (side === 'left'   && ocx >= cx) continue;
            if (side === 'bottom' && ocy <= cy) continue;
            if (side === 'top'    && ocy >= cy) continue;
            const dist = Math.hypot(ocx - cx, ocy - cy);
            if (dist > radius || dist >= bestDist) continue;
            bestDist = dist;
            best = obj;
        }
        return best;
    }

    /** Вычисляет top-left позицию дубликата со сдвигом в сторону side. */
    _offsetPos(sourceBounds, side) {
        const { x, y, width, height } = sourceBounds;
        switch (side) {
            case 'left':   return { x: x - width  - CLONE_GAP, y };
            case 'top':    return { x, y: y - height - CLONE_GAP };
            case 'bottom': return { x, y: y + height + CLONE_GAP };
            default:       return { x: x + width  + CLONE_GAP, y };
        }
    }

    /**
     * Обрабатывает клик по точке подключения (pointerup без значимого drag).
     * 1. Ищет ближайший объект в полуплоскости стороны → коннектор к нему.
     * 2. Не нашёл → дублирует исходник со сдвигом → коннектор к дубликату.
     */
    _onAnchorClick(source) {
        const sourceBounds = this._objectBounds(source.boundId);
        if (!sourceBounds) return;

        const side    = this._sideFromAnchor(source.anchor);
        const nearest = this._findNearestInHalfplane(source.boundId, sourceBounds, side, CLICK_FIND_RADIUS);

        if (nearest) {
            const end = { boundId: nearest.id, anchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false };
            createConnectorFromTerminals(this.core, this.eventBus, source, end);
            return;
        }

        const originalId = source.boundId;
        const newPos     = this._offsetPos(sourceBounds, side);
        const onReady    = (data) => {
            if (!data || data.originalId !== originalId) return;
            this._pendingDupListener = null;
            this.eventBus?.off(Events.Tool.DuplicateReady, onReady);
            const end = { boundId: data.newId, anchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false };
            createConnectorFromTerminals(this.core, this.eventBus, source, end);
        };
        this._pendingDupListener = onReady;
        this.eventBus.on(Events.Tool.DuplicateReady, onReady);
        this.eventBus.emit(Events.Tool.DuplicateRequest, { originalId, position: newPos });
    }

    _clearGraphics() {
        [this._previewGraphics, this._highlightGraphics].forEach(g => {
            if (!g) return;
            if (g.parent) g.parent.removeChild(g);
            g.destroy();
        });
        this._previewGraphics   = null;
        this._highlightGraphics = null;
    }

    destroy() {
        document.removeEventListener('pointermove', this._boundMove);
        document.removeEventListener('pointerup',   this._boundUp);
        if (this._pendingDupListener) {
            this.eventBus?.off(Events.Tool.DuplicateReady, this._pendingDupListener);
            this._pendingDupListener = null;
        }
        this._clearGraphics();
        this._sourceTerminal = null;
        this.core     = null;
        this.eventBus = null;
    }
}
