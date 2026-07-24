import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    objectBounds,
    sideFromAnchor,
    resolveFreePlacement,
    drawPreview,
} from './connectorGesture.js';
import { routeElbowAvoiding } from '../../../services/ConnectorObstacleRouter.js';

/** Внешние нормали граней старта/конца превью по стороне размещения дубликата. */
const DIRS_BY_SIDE = {
    right:  { start: { x: 1, y: 0 },  end: { x: -1, y: 0 } },
    left:   { start: { x: -1, y: 0 }, end: { x: 1, y: 0 } },
    top:    { start: { x: 0, y: -1 }, end: { x: 0, y: 1 } },
    bottom: { start: { x: 0, y: 1 },  end: { x: 0, y: -1 } },
};

/** Типы источников, для которых показываем призрак будущего дубликата. */
const GHOST_SOURCE_TYPES = new Set(['note', 'shape']);
/** Прозрачность призрака — светлее готового объекта (два шага по 30 п.п.: 1.0 → 0.7 → 0.4). */
const GHOST_OPACITY = 0.4;

/** number (0xRRGGBB) → CSS hex-строка. */
function colorToCss(color, fallback) {
    const n = (typeof color === 'number' && Number.isFinite(color)) ? color : fallback;
    return `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;
}

/**
 * Показывает при hover на mb-connection-anchor визуальный «призрак» —
 * прямоугольник цвета/формы источника на месте, где появится дубликат по клику
 * без drag (см. ConnectorDragController._onAnchorClick, ветка «нет объекта рядом»).
 * Рендерится DOM-элементом через тот же worldBoundsToCssRect, что и сами якоря —
 * снимок через PIXI generateTexture не подходит: маска text-области в NoteObject
 * даёт полностью прозрачную текстуру для всего контейнера целиком.
 */
export class AnchorHoverGhost {
    constructor(core, eventBus, positioningService, mountEl) {
        this.core = core;
        this.eventBus = eventBus;
        this.positioningService = positioningService;
        this.mountEl = mountEl;
        this.el = null;
        this._previewGraphics = null;
    }

    _world() {
        const pixi = this.core?.pixi;
        if (!pixi?.app?.stage) return null;
        return pixi.worldLayer
            || pixi.app.stage.getChildByName?.('worldLayer')
            || pixi.app.stage;
    }

    /** Возвращает CSS-стиль фона/формы призрака по типу и инстансу источника. */
    _resolveAppearance(pixiObject, mbType) {
        const instance = pixiObject?._mb?.instance;
        if (mbType === 'note') {
            return {
                backgroundColor: colorToCss(instance?.backgroundColor, 0xFFF9C4),
                borderRadius: '2px',
            };
        }
        // shape
        const kind = instance?.kind;
        const cornerRadius = Number.isFinite(instance?.cornerRadius) ? instance.cornerRadius : 0;
        return {
            backgroundColor: colorToCss(instance?.fillColor, 0xffffff),
            borderRadius: kind === 'circle' ? '50%' : `${Math.max(0, Math.round(cornerRadius))}px`,
        };
    }

    /**
     * Собирает bbox-препятствия для превью-линии: все объекты, кроме источника
     * и объектов-коннекторов. Призрак-дубликат целью не считается (его ещё нет).
     *
     * @param {string} sourceId id объекта-источника
     * @returns {Array<{x:number,y:number,width:number,height:number}>}
     */
    _collectObstacles(sourceId) {
        const objects = this.core?.state?.state?.objects;
        if (!Array.isArray(objects)) return [];
        const rects = [];
        for (const obj of objects) {
            if (!obj || obj.id === sourceId || obj.type === 'connector') continue;
            const bounds = objectBounds(this.eventBus, obj.id);
            if (bounds && bounds.width > 0 && bounds.height > 0) rects.push(bounds);
        }
        return rects;
    }

    /**
     * Показывает призрак для якоря.
     * @param {{id:string, anchorX:string|number, anchorY:string|number, anchorClient?:{x:number,y:number}}} data
     *   anchorClient — центр DOM-дота mb-connection-anchor в client-координатах;
     *   если передан, старт превью строится точно из него (иммунитет к hover-lift).
     */
    show({ id, anchorX, anchorY, anchorClient }) {
        this.hide();
        if (!id || !this.mountEl) return;

        const req = { objectId: id, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPixi, req);
        const pixiObject = req.pixiObject;
        const mbType = pixiObject?._mb?.type;
        if (!pixiObject || !GHOST_SOURCE_TYPES.has(mbType)) return;

        const sourceBounds = objectBounds(this.eventBus, id);
        if (!sourceBounds) return;

        const side = sideFromAnchor({ x: parseFloat(anchorX), y: parseFloat(anchorY) });
        const pos = resolveFreePlacement(this.eventBus, this.core, id, sourceBounds, side);
        const cssRect = this.positioningService.worldBoundsToCssRect({
            x: pos.x, y: pos.y, width: sourceBounds.width, height: sourceBounds.height,
        });
        const appearance = this._resolveAppearance(pixiObject, mbType);

        const el = document.createElement('div');
        Object.assign(el.style, {
            position: 'absolute',
            left: `${Math.round(cssRect.left)}px`,
            top: `${Math.round(cssRect.top)}px`,
            width: `${Math.max(1, Math.round(cssRect.width))}px`,
            height: `${Math.max(1, Math.round(cssRect.height))}px`,
            pointerEvents: 'none',
            boxSizing: 'border-box',
            opacity: String(GHOST_OPACITY),
            zIndex: '34',
            ...appearance,
        });
        el.className = 'mb-connection-anchor-ghost';
        this.mountEl.appendChild(el);
        this.el = el;

        // Линия-превью повторяет маршрут итогового коннектора (createConnectorFromTerminals):
        // от точки клика по якорю до центра будущего дубликата.
        const world = this._world();
        if (world) {
            const startDir = (DIRS_BY_SIDE[side] || DIRS_BY_SIDE.right).start;
            // Старт коннектора — сама точка mb-connection-anchor. Берём её из фактической
            // позиции DOM-дота (anchorClient): дот и превью тогда совпадают всегда, даже
            // когда объект под hover-lift масштабирован/приподнят. Фолбэк (нет anchorClient) —
            // расчёт от bounds со смещением наружу на тот же offset, что в ConnectionAnchorsLayer.
            let fromPt;
            const view = this.core?.pixi?.app?.view;
            if (anchorClient && view) {
                const viewRect = view.getBoundingClientRect();
                const local = world.toLocal(new PIXI.Point(anchorClient.x - viewRect.left, anchorClient.y - viewRect.top));
                fromPt = { x: local.x, y: local.y };
            } else {
                const anchorOffset = mbType === 'note' ? 20 : 12;
                fromPt = {
                    x: sourceBounds.x + parseFloat(anchorX) * sourceBounds.width + startDir.x * anchorOffset,
                    y: sourceBounds.y + parseFloat(anchorY) * sourceBounds.height + startDir.y * anchorOffset,
                };
            }
            // Линия оканчивается на середине грани призрака, ближайшей к источнику
            // (призрак может стоять сверху/снизу соседа, а не только сбоку), а не в центре.
            const w = sourceBounds.width;
            const h = sourceBounds.height;
            const edges = [
                { pt: { x: pos.x,         y: pos.y + h / 2 }, dir: { x: -1, y: 0 } },
                { pt: { x: pos.x + w,     y: pos.y + h / 2 }, dir: { x: 1,  y: 0 } },
                { pt: { x: pos.x + w / 2, y: pos.y },         dir: { x: 0,  y: -1 } },
                { pt: { x: pos.x + w / 2, y: pos.y + h },     dir: { x: 0,  y: 1 } },
            ];
            let nearest = edges[0];
            let bestD = Infinity;
            for (const e of edges) {
                const d = Math.hypot(e.pt.x - fromPt.x, e.pt.y - fromPt.y);
                if (d < bestD) { bestD = d; nearest = e; }
            }
            const toPt = nearest.pt;
            const obstacles = this._collectObstacles(id);
            const pts = routeElbowAvoiding(fromPt, startDir, toPt, nearest.dir, obstacles);
            const graphics = new PIXI.Graphics();
            world.addChild(graphics);
            drawPreview(graphics, fromPt, toPt, 'elbow', pts);
            this._previewGraphics = graphics;
        }
    }

    /** Скрывает призрак, если он показан. */
    hide() {
        if (this.el) {
            if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
            this.el = null;
        }
        if (this._previewGraphics) {
            if (this._previewGraphics.parent) this._previewGraphics.parent.removeChild(this._previewGraphics);
            this._previewGraphics.destroy();
            this._previewGraphics = null;
        }
    }

    destroy() {
        this.hide();
        this.core = null;
        this.eventBus = null;
        this.positioningService = null;
        this.mountEl = null;
    }
}
