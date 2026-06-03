import { gsap } from 'gsap';
import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import {
    getChildrenSidesWithChildren,
    getDescendantIds,
    isHiddenByCollapsedAncestor,
    countVisibleDescendantsForBadge,
} from './MindmapCollapseGraph.js';

const MINDMAP_TYPE = 'mindmap';
const BTN_SIZE = 20;

function asNumber(v, fallback = 0) {
    return Number.isFinite(v) ? v : fallback;
}

function getWorldRect(node) {
    const x = asNumber(node?.position?.x);
    const y = asNumber(node?.position?.y);
    const w = Math.max(1, Math.round(asNumber(node?.width, asNumber(node?.properties?.width, 1))));
    const h = Math.max(1, Math.round(asNumber(node?.height, asNumber(node?.properties?.height, 1))));
    return { x, y, w, h };
}

function anchorWorldPoint(rect, side) {
    if (side === 'right')  return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
    if (side === 'left')   return { x: rect.x,           y: rect.y + rect.h / 2 };
    if (side === 'bottom') return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    return { x: rect.x + rect.w / 2, y: rect.y };
}

export class MindmapCollapseLayer {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.subscriptions = [];
        this._eventsAttached = false;
        this.hoveredObjectId = null;
        this._gsapCtx = null;
        /** Map<"nodeId:side", HTMLElement> */
        this._buttons = new Map();
        /** Tracks which keys have the button currently shown */
        this._shown = new Set();
        /** Ключ кнопки, над которой сейчас курсор (чтобы не прятать до клика) */
        this._btnHoverKey = null;
        this._onContainerMove = null;
        this._onContainerLeave = null;
        this._moveRaf = 0;
        this._lastMoveEvent = null;
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'mb-mindmap-collapse-layer';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: '12',
        });
        this.container.appendChild(this.layer);
        this._gsapCtx = gsap.context(() => {}, this.layer);
        this._attachEvents();

        // Hover для майндмап-нод нельзя брать из Events.Object.Hover роутера:
        // HTML-текст ноды (pointer-events:auto) перехватывает события и PIXI не
        // получает pointermove над нодой. Поэтому слушаем pointermove на контейнере
        // (события всплывают и от span текста, и от canvas) и резолвим ноду через HitTest.
        this._onContainerMove = (e) => {
            this._lastMoveEvent = e;
            if (this._moveRaf) return;
            this._moveRaf = requestAnimationFrame(() => {
                this._moveRaf = 0;
                this._handlePointerMove(this._lastMoveEvent);
            });
        };
        this._onContainerLeave = () => {
            this.hoveredObjectId = null;
            this._syncVisibility();
        };
        this.container.addEventListener('pointermove', this._onContainerMove);
        this.container.addEventListener('pointerleave', this._onContainerLeave);

        this._rebuildAll();
    }

    destroy() {
        this._detachEvents();
        if (this._moveRaf) {
            cancelAnimationFrame(this._moveRaf);
            this._moveRaf = 0;
        }
        if (this._onContainerMove) {
            this.container.removeEventListener('pointermove', this._onContainerMove);
            this._onContainerMove = null;
        }
        if (this._onContainerLeave) {
            this.container.removeEventListener('pointerleave', this._onContainerLeave);
            this._onContainerLeave = null;
        }
        if (this._gsapCtx) {
            this._gsapCtx.revert();
            this._gsapCtx = null;
        }
        if (this.layer) {
            this.layer.remove();
            this.layer = null;
        }
        this._buttons.clear();
        this._shown.clear();
    }

    _handlePointerMove(e) {
        if (!e || !this.layer) return;
        // Курсор над самой кнопкой — состояние держит btnHover, ничего не пересчитываем.
        if (this.layer.contains(e.target)) return;

        const view = this.core?.pixi?.app?.view;
        if (!view) return;
        const rect = view.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hitData = { x, y, result: null };
        this.eventBus.emit(Events.Tool.HitTest, hitData);
        const hitId = typeof hitData.result?.object === 'string'
            ? hitData.result.object
            : (hitData.result?.object?.id || null);

        let mindmapId = null;
        if (hitId) {
            const obj = this._objects().find((o) => o?.id === hitId);
            if (obj?.type === MINDMAP_TYPE) mindmapId = hitId;
        }

        if (this.hoveredObjectId !== mindmapId) {
            this.hoveredObjectId = mindmapId;
            this._syncVisibility();
        }
    }

    _attachEvents() {
        if (this._eventsAttached) return;
        const rebuild = () => this._rebuildAll();
        const reposition = () => this._updatePositions();
        const bindings = [
            [Events.Object.Created,          rebuild],
            [Events.Object.Deleted,          rebuild],
            [Events.Object.Updated,          rebuild],
            [Events.Object.StateChanged,     rebuild],
            [Events.History.Changed,         rebuild],
            [Events.Board.Loaded,            rebuild],
            [Events.Tool.DragUpdate,         reposition],
            [Events.Tool.DragEnd,            reposition],
            [Events.Tool.ResizeUpdate,       reposition],
            [Events.Tool.ResizeEnd,          reposition],
            [Events.Tool.GroupDragUpdate,    reposition],
            [Events.Tool.GroupResizeUpdate,  reposition],
            [Events.Tool.PanUpdate,          reposition],
            [Events.UI.ZoomPercent,          reposition],
            [Events.Object.TransformUpdated, reposition],
        ];
        bindings.forEach(([ev, fn]) => {
            this.eventBus.on(ev, fn);
            this.subscriptions.push([ev, fn]);
        });
        this._eventsAttached = true;
    }

    _detachEvents() {
        if (!this._eventsAttached) return;
        if (typeof this.eventBus?.off === 'function') {
            this.subscriptions.forEach(([ev, fn]) => this.eventBus.off(ev, fn));
        }
        this.subscriptions = [];
        this._eventsAttached = false;
    }

    _objects() {
        return this.core?.state?.state?.objects || [];
    }

    _rebuildAll() {
        if (!this.layer) return;
        const objects = this._objects();
        const mindmaps = objects.filter((o) => o?.type === MINDMAP_TYPE);

        // Collect needed keys
        const needed = new Set();
        mindmaps.forEach((node) => {
            getChildrenSidesWithChildren(objects, node.id)
                .forEach((side) => needed.add(`${node.id}:${side}`));
        });

        // Remove stale
        for (const key of this._buttons.keys()) {
            if (!needed.has(key)) {
                this._buttons.get(key)?.remove();
                this._buttons.delete(key);
                this._shown.delete(key);
            }
        }

        // Create missing
        needed.forEach((key) => {
            if (!this._buttons.has(key)) {
                const colonIdx = key.indexOf(':');
                const nodeId = key.slice(0, colonIdx);
                const side = key.slice(colonIdx + 1);
                this._createButton(nodeId, side, key);
            }
        });

        this._updatePositions();
        this._syncVisibility();
    }

    _createButton(nodeId, side, key) {
        const btn = document.createElement('div');
        btn.dataset.nodeId = nodeId;
        btn.dataset.side = side;
        Object.assign(btn.style, {
            position: 'absolute',
            width: `${BTN_SIZE}px`,
            height: `${BTN_SIZE}px`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
            userSelect: 'none',
            fontSize: '12px',
            fontWeight: '700',
            fontFamily: 'sans-serif',
            lineHeight: '1',
            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            visibility: 'hidden',
            opacity: '0',
        });

        btn.addEventListener('pointerenter', () => {
            this._btnHoverKey = key;
            this._syncVisibility();
        });
        btn.addEventListener('pointerleave', () => {
            if (this._btnHoverKey === key) this._btnHoverKey = null;
            this._syncVisibility();
        });
        btn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this._toggle(nodeId);
        });

        this.layer.appendChild(btn);
        this._buttons.set(key, btn);
        gsap.set(btn, { autoAlpha: 0, scale: 0.6 });
    }

    _applyBtnStyle(btn, nodeId) {
        const objects = this._objects();
        const node = objects.find((o) => o?.id === nodeId);
        const collapsed = node?.properties?.mindmap?.collapsed === true;
        if (collapsed) {
            const count = countVisibleDescendantsForBadge(objects, nodeId);
            btn.textContent = String(count);
            Object.assign(btn.style, {
                background: '#6366f1',
                color: '#fff',
                border: 'none',
            });
        } else {
            btn.textContent = '−';
            Object.assign(btn.style, {
                background: 'rgba(255,255,255,0.94)',
                color: '#374151',
                border: '1.5px solid #d1d5db',
            });
        }
    }

    _updatePositions() {
        if (!this.layer || !this.core?.pixi) return;
        const worldLayer = this.core.pixi.worldLayer || this.core.pixi.app?.stage;
        const view = this.core.pixi.app?.view;
        if (!worldLayer || !view?.parentElement) return;

        const containerRect = view.parentElement.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offX = viewRect.left - containerRect.left;
        const offY = viewRect.top - containerRect.top;
        const objects = this._objects();

        this._buttons.forEach((btn, key) => {
            const nodeId = btn.dataset.nodeId;
            const side = btn.dataset.side;
            const node = objects.find((o) => o?.id === nodeId && o?.type === MINDMAP_TYPE);
            if (!node) return;

            const rect = getWorldRect(node);
            const wp = anchorWorldPoint(rect, side);
            const screen = worldLayer.toGlobal(new PIXI.Point(wp.x, wp.y));
            btn.style.left = `${Math.round(offX + screen.x)}px`;
            btn.style.top  = `${Math.round(offY + screen.y)}px`;
            this._applyBtnStyle(btn, nodeId);
        });
    }

    _syncVisibility() {
        const objects = this._objects();
        this._buttons.forEach((btn, key) => {
            const nodeId = btn.dataset.nodeId;
            const node = objects.find((o) => o?.id === nodeId);
            const collapsed = node?.properties?.mindmap?.collapsed === true;
            const shouldShow = collapsed
                || this.hoveredObjectId === nodeId
                || this._btnHoverKey === key;

            if (shouldShow && !this._shown.has(key)) {
                this._shown.add(key);
                this._animIn(btn);
            } else if (!shouldShow && this._shown.has(key)) {
                this._shown.delete(key);
                this._animOut(btn);
            }
        });
    }

    _animIn(btn) {
        if (!this._gsapCtx) return;
        this._gsapCtx.add(() => {
            gsap.fromTo(btn,
                { autoAlpha: 0, scale: 0.6 },
                { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'back.out(2)', overwrite: true }
            );
        });
    }

    _animOut(btn) {
        if (!this._gsapCtx) return;
        this._gsapCtx.add(() => {
            gsap.to(btn, { autoAlpha: 0, scale: 0.6, duration: 0.12, ease: 'power2.in', overwrite: true });
        });
    }

    _toggle(nodeId) {
        const objects = this._objects();
        const node = objects.find((o) => o?.id === nodeId && o?.type === MINDMAP_TYPE);
        if (!node) return;

        if (!node.properties) node.properties = {};
        if (!node.properties.mindmap) node.properties.mindmap = {};

        const nowCollapsed = !node.properties.mindmap.collapsed;
        node.properties.mindmap.collapsed = nowCollapsed;

        const descendants = getDescendantIds(objects, nodeId);
        descendants.forEach((descId) => {
            const pixi = this.core?.pixi?.objects?.get?.(descId);
            if (nowCollapsed) {
                if (pixi) pixi.visible = false;
                this.eventBus.emit(Events.Tool.HideObjectText, { objectId: descId });
            } else {
                const stillHidden = isHiddenByCollapsedAncestor(objects, descId);
                if (!stillHidden) {
                    if (pixi) pixi.visible = true;
                    this.eventBus.emit(Events.Tool.ShowObjectText, { objectId: descId });
                }
            }
        });

        this.eventBus.emit(Events.Object.Updated, { objectId: nodeId });
        this.core?.state?.markDirty?.();
    }
}
