import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { HandlesPositioningService } from '../handles/HandlesPositioningService.js';
import { UpdateConnectorCommand } from '../../core/commands/UpdateConnectorCommand.js';

const HANDLE_SIZE   = 12;
const ANCHOR_SNAP   = 16; // CSS px до магнита к середине грани
const EDGE_SNAP     = 10; // CSS px до кромки
/** Нормализованные якоря середин граней — порядок совпадает с ConnectorDragController. */
const MID_ANCHORS = [
    { x: 0.5, y: 0 },
    { x: 1,   y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 0,   y: 0.5 },
];

/**
 * DOM-слой двух ручек для перепривязки концов выбранного коннектора.
 * Паттерн: ConnectionAnchorsLayer (подписки, world→screen, drag).
 * Терминал формируется по правилам ConnectorDragController._resolveEnd.
 */
export class ConnectorHandlesLayer {
    constructor(container, eventBus, core) {
        this.container          = container;
        this.eventBus           = eventBus;
        this.core               = core;
        this.layer              = null;
        this.positioningService = new HandlesPositioningService(this);
        this.subscriptions      = [];
        this._eventsAttached    = false;
        this._activeConnectorId = null;

        // drag state
        this._drag        = null; // { endKey:'start'|'end', el }
        this._boundMove   = null;
        this._boundUp     = null;
    }

    attach() {
        if (!this.layer) {
            this.layer = document.createElement('div');
            this.layer.className = 'mb-connector-handles-layer';
            Object.assign(this.layer.style, {
                position:      'absolute',
                left:          '0',
                top:           '0',
                width:         '100%',
                height:        '100%',
                pointerEvents: 'none',
                zIndex:        '36',
            });
            this.container.appendChild(this.layer);
        }
        this._attachEvents();
        this.updateFromSelection();
    }

    destroy() {
        this._cancelDrag();
        this._detachEvents();
        if (this.layer && this.layer.parentNode) {
            this.layer.parentNode.removeChild(this.layer);
        }
        this.layer              = null;
        this._activeConnectorId = null;
        this.eventBus           = null;
        this.core               = null;
        this.container          = null;
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    _attachEvents() {
        if (this._eventsAttached) return;

        const on = (event, handler) => {
            this.eventBus.on(event, handler);
            this.subscriptions.push([event, handler]);
        };

        on(Events.Tool.SelectionAdd,       () => this.updateFromSelection());
        on(Events.Tool.SelectionRemove,    () => this.updateFromSelection());
        on(Events.Tool.SelectionClear,     () => this.updateFromSelection());
        on(Events.Object.Deleted,          () => this.updateFromSelection());

        on(Events.Tool.DragUpdate,         () => this._reposition());
        on(Events.Tool.ResizeUpdate,       () => this._reposition());
        on(Events.Tool.GroupDragUpdate,    () => this._reposition());
        on(Events.Tool.GroupResizeUpdate,  () => this._reposition());
        on(Events.Tool.RotateUpdate,       () => this._reposition());
        on(Events.Tool.PanUpdate,          () => this._reposition());
        on(Events.UI.ZoomPercent,          () => this._reposition());
        on(Events.History.Changed,         () => this._reposition());

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

    // ─── Public ───────────────────────────────────────────────────────────────

    /** Перечитывает выделение и показывает/скрывает ручки. */
    updateFromSelection() {
        if (!this.layer) return;

        const selection = Array.from(this.core?.selectTool?.selectedObjects || []);
        if (selection.length !== 1) { this._hide(); return; }

        const id  = selection[0];
        const req = { objectId: id, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPixi, req);
        if (req.pixiObject?._mb?.type !== 'connector') { this._hide(); return; }

        this._activeConnectorId = id;
        this._render();
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    _hide() {
        this._activeConnectorId = null;
        if (this.layer) this.layer.innerHTML = '';
    }

    _reposition() {
        if (!this._activeConnectorId || !this.layer) return;
        // Не перерисовывать во время drag — ручка движется вручную через _onDragMove.
        if (this._drag) return;
        this._render();
    }

    _render() {
        if (!this.layer || !this._activeConnectorId) return;

        const id  = this._activeConnectorId;
        const seg = (this.core.connectorLayer?._lastSegments ?? []).find(s => s.id === id);
        if (!seg) { this.layer.innerHTML = ''; return; }

        const ss = this._worldToScreen(seg.start.x, seg.start.y);
        const es = this._worldToScreen(seg.end.x,   seg.end.y);

        this.layer.innerHTML = '';
        this._createHandle('start', ss.x, ss.y);
        this._createHandle('end',   es.x, es.y);
    }

    /** Конвертирует world-точку в CSS-координаты относительно контейнера. Целые px. */
    _worldToScreen(wx, wy) {
        const world = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const pt    = world.toGlobal(new PIXI.Point(wx, wy));
        const { offsetLeft, offsetTop } = this.positioningService.getViewportOffsets();
        return {
            x: Math.round(offsetLeft + pt.x),
            y: Math.round(offsetTop  + pt.y),
        };
    }

    /** Создаёт DOM-ручку с центром в (cx, cy) в px от container. */
    _createHandle(endKey, cx, cy) {
        const r  = HANDLE_SIZE / 2;
        const el = document.createElement('div');
        el.className      = 'mb-connector-handle';
        el.dataset.end    = endKey;
        Object.assign(el.style, {
            position:        'absolute',
            left:            `${cx - r}px`,
            top:             `${cy - r}px`,
            width:           `${HANDLE_SIZE}px`,
            height:          `${HANDLE_SIZE}px`,
            backgroundColor: '#ffffff',
            border:          '2px solid #2563EB',
            borderRadius:    '50%',
            pointerEvents:   'auto',
            boxSizing:       'border-box',
            cursor:          'grab',
        });
        el.addEventListener('pointerdown', (e) => this._onPointerDown(e, endKey, el));
        this.layer.appendChild(el);
    }

    // ─── Drag ─────────────────────────────────────────────────────────────────

    _onPointerDown(e, endKey, el) {
        e.preventDefault();
        e.stopPropagation();

        this._drag      = { endKey, el };
        el.style.cursor = 'grabbing';

        this._boundMove = (ev) => this._onDragMove(ev);
        this._boundUp   = (ev) => this._onDragUp(ev);
        document.addEventListener('pointermove', this._boundMove);
        document.addEventListener('pointerup',   this._boundUp);
    }

    _onDragMove(e) {
        if (!this._drag) return;
        const r    = HANDLE_SIZE / 2;
        const rect = this.container.getBoundingClientRect();
        const x    = Math.round(e.clientX - rect.left - r);
        const y    = Math.round(e.clientY - rect.top  - r);
        this._drag.el.style.left = `${x}px`;
        this._drag.el.style.top  = `${y}px`;
    }

    _onDragUp(e) {
        document.removeEventListener('pointermove', this._boundMove);
        document.removeEventListener('pointerup',   this._boundUp);
        this._boundMove = null;
        this._boundUp   = null;

        if (!this._drag) return;
        const { endKey } = this._drag;
        this._drag = null;

        const connectorId = this._activeConnectorId;
        if (!connectorId) { this._render(); return; }

        const terminal = this._resolveTerminal(e.clientX, e.clientY);
        const updates  = endKey === 'start' ? { start: terminal } : { end: terminal };

        this.core.history.executeCommand(
            new UpdateConnectorCommand(this.core, connectorId, updates)
        );
        // ConnectorLayer перерисуется по History.Changed → _reposition()
    }

    /**
     * Определяет терминал по clientX/Y. Логика: ConnectorDragController._resolveEnd.
     * sourceBoundId не передаётся — при перепривязке конца можно приземлиться
     * на тот же объект, к которому привязан другой конец.
     *
     * Допущение: isExact=false всегда (матчит контракт ConnectorBindingResolver).
     */
    _resolveTerminal(clientX, clientY) {
        const view     = this.core.pixi.app.view;
        const viewRect = view.getBoundingClientRect();
        const world    = this.core.pixi.worldLayer || this.core.pixi.app.stage;
        const worldPt  = world.toLocal(new PIXI.Point(clientX - viewRect.left, clientY - viewRect.top));

        const hitData = {
            x: clientX - viewRect.left,
            y: clientY - viewRect.top,
            result: null,
        };
        this.eventBus.emit(Events.Tool.HitTest, hitData);
        const objectId = hitData.result?.object || null;

        if (objectId) {
            const posData  = { objectId, position: null };
            const sizeData = { objectId, size: null };
            this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
            this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

            if (posData.position && sizeData.size) {
                const { x, y } = posData.position;
                const { width, height } = sizeData.size;
                const scale = world?.scale?.x || 1;

                // Приоритет 1: магнит к середине грани (≤ANCHOR_SNAP CSS px)
                const snapThr = ANCHOR_SNAP / scale;
                let best = null, bestDist = snapThr;
                for (const a of MID_ANCHORS) {
                    const ax = x + a.x * width;
                    const ay = y + a.y * height;
                    const d  = Math.hypot(worldPt.x - ax, worldPt.y - ay);
                    if (d <= bestDist) { bestDist = d; best = a; }
                }
                if (best) {
                    return { boundId: objectId, anchor: best, isPrecise: true, isExact: false };
                }

                // Приоритет 2: произвольная точка кромки (≤EDGE_SNAP CSS px)
                const edgeThr = EDGE_SNAP / scale;
                const nearEdge = Math.min(
                    worldPt.x - x, x + width  - worldPt.x,
                    worldPt.y - y, y + height - worldPt.y,
                ) <= edgeThr;
                if (nearEdge) {
                    return {
                        boundId: objectId,
                        anchor: {
                            x: Math.max(0, Math.min(1, (worldPt.x - x) / width)),
                            y: Math.max(0, Math.min(1, (worldPt.y - y) / height)),
                        },
                        isPrecise: true,
                        isExact: false,
                    };
                }

                // Приоритет 3: центр объекта
                return { boundId: objectId, anchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false };
            }
        }

        // Свободная точка в world-coords
        return { point: { x: worldPt.x, y: worldPt.y } };
    }

    _cancelDrag() {
        if (this._boundMove) {
            document.removeEventListener('pointermove', this._boundMove);
            this._boundMove = null;
        }
        if (this._boundUp) {
            document.removeEventListener('pointerup', this._boundUp);
            this._boundUp = null;
        }
        this._drag = null;
    }
}
