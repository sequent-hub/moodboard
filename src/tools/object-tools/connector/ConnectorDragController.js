import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import {
    terminalWorldPoint,
    computeAnchor,
    drawPreview,
    createConnectorFromTerminals,
    objectBounds,
    sideFromAnchor,
    resolveFreePlacement,
} from './connectorGesture.js';
import {
    getObjectPorts,
    findNearestPort,
    findPortTargetNear,
    portTargetRule,
    soleCompatiblePort,
    terminalForPort,
    PORT_SNAP_CSS,
} from '../../../services/ConnectorPortRegistry.js';
import {
    PORT_LINE_STOP,
    canConnectTerminals,
    isSingleLinkOutputPort,
} from '../../../services/ai/generatorPorts.js';
import { findGeneratorDropCandidates } from '../../../services/ai/generatorNodeCatalog.js';
import { GeneratorDropMenu } from '../../../ui/generator/GeneratorDropMenu.js';
import { CONNECTOR_Z_INDEX } from '../../../ui/connectors/ConnectorLayer.js';

/** Минимальное смещение (px) для старта drag. */
const DRAG_THRESHOLD = 4;
/** Порог «у кромки» в CSS-пикселях. */
const EDGE_THRESHOLD_CSS = 10;
/** Порог магнита к коннектору цели — строго больше EDGE_THRESHOLD_CSS, иначе грань перехватит. */
const ANCHOR_SNAP_CSS = 16;
/** Нормализованные якоря коннекторов: top, right, bottom, left. */
const TARGET_ANCHORS = [
    { x: 0.5, y: 0 },
    { x: 1,   y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 0,   y: 0.5 },
];

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
        this._dropMenu = null;
        this._dragging = false;
        this._pendingDupListener = null;
        this._startX = 0;
        this._startY = 0;
        this._portHighlightId = null;
        this._boundMove = this._onMove.bind(this);
        this._boundUp   = this._onUp.bind(this);
    }

    /**
     * Вызывается из ConnectionAnchorsLayer на pointerdown по точке привязки.
     * domEvent.target обязан иметь dataset: id, anchorX, anchorY.
     */
    startFromAnchor(domEvent) {
        const el = domEvent.target;
        const portId = el.dataset.portId || null;
        this._sourceTerminal = {
            boundId: el.dataset.id,
            ...(portId ? { portId } : {}),
            anchor: { x: parseFloat(el.dataset.anchorX), y: parseFloat(el.dataset.anchorY) },
            isPrecise: true,
            // Порт вынесен за габарит объекта — связь должна приходить ровно в него.
            isExact: Boolean(portId),
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
        return objectBounds(this.eventBus, objectId);
    }

    _objects() {
        return this.core?.state?.getObjects ? this.core.state.getObjects() : [];
    }

    /**
     * Какие порты принимает связь этого жеста: зависит от порта, с которого её тянут.
     *
     * @param {object|null} [source=this._sourceTerminal] терминал-источник
     * @returns {(port: object, targetId: string) => boolean}
     */
    _portRule(source = this._sourceTerminal) {
        return portTargetRule(this._objects(), source?.portId || null);
    }

    /**
     * Порт-цель рядом с точкой мира, минуя hit-test.
     *
     * Порт вынесен наружу от грани карточки, поэтому над самим портом hit-test
     * объекта пустой — без отдельного поиска связь приземлялась в пустоту.
     *
     * @param {{x: number, y: number}} worldPt
     * @param {string|null} excludeBoundId
     * @param {object|null} [source=this._sourceTerminal] терминал-источник
     */
    _findPortTarget(worldPt, excludeBoundId, source = this._sourceTerminal) {
        return findPortTargetNear(
            this.eventBus,
            this._objects(),
            worldPt,
            this._world()?.scale?.x || 1,
            excludeBoundId || null,
            this._portRule(source),
        );
    }

    /**
     * Порт объекта под курсором: сначала ближайший к точке, затем — единственный,
     * который принимает эту связь.
     *
     * Второй шаг делает цель размером с карточку: тянуть от порта результата
     * прицельно в иконку входа шириной 32 world-px пользователь не обязан, а
     * подходящий вход у генератора ровно один.
     *
     * @param {string} objectId
     * @param {{x: number, y: number, width: number, height: number}} bounds
     * @param {{x: number, y: number}} worldPt
     * @param {object|null} source терминал-источник
     * @returns {{portId: string, anchor: {x: number, y: number}}|null}
     */
    _portOnObject(objectId, bounds, worldPt, source) {
        const rule = this._portRule(source);
        const ports = getObjectPorts(this.eventBus, objectId);
        const nearest = findNearestPort(
            ports,
            bounds,
            worldPt,
            this._world()?.scale?.x || 1,
            PORT_SNAP_CSS,
            (candidate) => rule(candidate, objectId),
        );

        return nearest || soleCompatiblePort(ports, rule, objectId);
    }

    /**
     * Держит подсветку порта у объекта под курсором на время протягивания.
     * @param {string|null} objectId
     */
    _setPortHighlight(objectId) {
        if (this._portHighlightId === objectId) return;

        [this._portHighlightId, objectId].forEach((id, index) => {
            if (!id) return;
            const req = { objectId: id, pixiObject: null };
            this.eventBus?.emit(Events.Tool.GetObjectPixi, req);
            const instance = req.pixiObject?._mb?.instance;
            if (typeof instance?.setPortHighlight === 'function') {
                instance.setPortHighlight(index === 1, 'connector');
            }
        });

        this._portHighlightId = objectId;
    }

    /**
     * Возвращает ближайший якорь из TARGET_ANCHORS в пределах ANCHOR_SNAP_CSS от worldPt,
     * иначе null. Приоритет выше грани — вызывать в _resolveEnd первым.
     */
    _snapToAnchor(bounds, worldPt) {
        const scale = this._world()?.scale?.x || 1;
        const thr = ANCHOR_SNAP_CSS / scale;
        let best = null, bestDist = thr;
        for (const a of TARGET_ANCHORS) {
            const ax = bounds.x + a.x * bounds.width;
            const ay = bounds.y + a.y * bounds.height;
            const d = Math.hypot(worldPt.x - ax, worldPt.y - ay);
            if (d <= bestDist) { bestDist = d; best = a; }
        }
        return best;
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
     *
     * @param {number} clientX
     * @param {number} clientY
     * @param {object|null} source терминал-источник: от его порта зависят допустимые цели
     */
    _resolveEnd(clientX, clientY, source) {
        const worldPt  = this._toWorld(clientX, clientY);
        const sourceBoundId = source?.boundId || null;

        // ПРИОРИТЕТ -1: порт под курсором, даже если он вынесен за габарит карточки
        const portTarget = this._findPortTarget(worldPt, sourceBoundId, source);
        if (portTarget) {
            return terminalForPort(portTarget.boundId, portTarget);
        }

        const objectId = this._hitTest(clientX, clientY);

        if (objectId && objectId !== sourceBoundId) {
            const bounds = this._objectBounds(objectId);
            if (bounds) {
                // ПРИОРИТЕТ 0: именованный порт объекта, если он их объявляет
                const port = this._portOnObject(objectId, bounds, worldPt, source);
                if (port) {
                    return terminalForPort(objectId, port);
                }
                // ПРИОРИТЕТ 1: магнит к коннектору (середина грани)
                const snapAnchor = this._snapToAnchor(bounds, worldPt);
                if (snapAnchor) {
                    return { boundId: objectId, anchor: snapAnchor, isPrecise: true, isExact: false };
                }
                // ПРИОРИТЕТ 2: произвольная точка грани
                if (this._nearEdge(bounds, worldPt)) {
                    return {
                        boundId: objectId,
                        anchor: computeAnchor(this.eventBus, objectId, worldPt),
                        isPrecise: true,
                        isExact: false,
                    };
                }
                // ПРИОРИТЕТ 3: центр объекта
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
            // Гасим hover-lift на время протягивания: цель не должна масштабироваться
            // и подниматься, иначе её границы вылезают за рамку подсветки.
            this.core?.pixi?.hoverLift?.setConnecting(true);
            const world = this._world();
            if (world) {
                this._previewGraphics   = new PIXI.Graphics();
                this._highlightGraphics = new PIXI.Graphics();
                this._previewGraphics.zIndex = CONNECTOR_Z_INDEX;
                world.addChild(this._previewGraphics);
                world.addChild(this._highlightGraphics);
            }
        }

        if (!this._previewGraphics) return;

        const worldPt  = this._toWorld(e.clientX, e.clientY);
        const fromPt   = terminalWorldPoint(this.eventBus, this._sourceTerminal);

        this._highlightGraphics.clear();
        const sourceBoundId = this._sourceTerminal?.boundId;
        const portTarget = this._findPortTarget(worldPt, sourceBoundId);
        this._setPortHighlight(portTarget?.boundId || null);

        let previewEnd = worldPt;
        if (portTarget) {
            // Сам порт подсвечивает объект (подложка под иконкой), рамка показывает цель.
            previewEnd = portTarget.point;
            const b = portTarget.bounds;
            this._highlightGraphics.lineStyle({ width: 2, color: 0x2563EB, alpha: 0.85 });
            this._highlightGraphics.drawRect(b.x, b.y, b.width, b.height);
            drawPreview(this._previewGraphics, fromPt, previewEnd, 'bezier', null, {
                head: 'none',
                endTrim: PORT_LINE_STOP,
            });
            return;
        }

        const objectId = this._hitTest(e.clientX, e.clientY);
        if (objectId && objectId !== sourceBoundId) {
            const bounds = this._objectBounds(objectId);
            if (bounds) {
                // Рамку строим строго по логическим bounds — коннектор привязывается
                // к ним же. Hover-трансформацию (scale/lift) не учитываем: иначе рамка
                // выпирает за периметр объекта (раздув ×scale + подъём центра вверх) и
                // отстаёт от анимации, т.к. перерисовывается только на pointermove.
                this._highlightGraphics.lineStyle({ width: 2, color: 0x2563EB, alpha: 0.85 });
                this._highlightGraphics.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);

                // Порт, в который приземлится связь по телу карточки: превью должно
                // показывать ту же точку, что получит _resolveEnd на отпускании.
                const port = this._portOnObject(objectId, bounds, worldPt, this._sourceTerminal);
                if (port) {
                    this._setPortHighlight(objectId);
                    drawPreview(this._previewGraphics, fromPt, {
                        x: bounds.x + port.anchor.x * bounds.width,
                        y: bounds.y + port.anchor.y * bounds.height,
                    }, 'bezier', null, { head: 'none', endTrim: PORT_LINE_STOP });
                    return;
                }

                // Подводим превью к коннектору, если курсор в зоне магнита
                const snapAnchor = this._snapToAnchor(bounds, worldPt);
                if (snapAnchor) {
                    previewEnd = {
                        x: bounds.x + snapAnchor.x * bounds.width,
                        y: bounds.y + snapAnchor.y * bounds.height,
                    };
                    // Подсвечиваем конкретный коннектор
                    this._highlightGraphics.lineStyle(0);
                    this._highlightGraphics.beginFill(0x2563EB, 1);
                    this._highlightGraphics.drawCircle(previewEnd.x, previewEnd.y, 6);
                    this._highlightGraphics.endFill();
                }
            }
        }
        drawPreview(this._previewGraphics, fromPt, previewEnd);
    }

    _onUp(e) {
        document.removeEventListener('pointermove', this._boundMove);
        document.removeEventListener('pointerup',   this._boundUp);

        const wasDragging = this._dragging;
        const source      = this._sourceTerminal;
        this._dragging        = false;
        this._sourceTerminal  = null;
        this.core?.pixi?.hoverLift?.setConnecting(false);
        this._setPortHighlight(null);
        this._clearGraphics();

        if (!source) return;
        if (!wasDragging) {
            this._onAnchorClick(source);
            return;
        }

        const end = this._resolveEnd(e.clientX, e.clientY, source);

        // Связь от порта результата существует только в паре со входом того же
        // типа данных. В пустоте такого входа нет — предлагаем создать узел,
        // который его объявляет, вместо молчаливого обрыва жеста.
        if (!end.boundId && isSingleLinkOutputPort(source.portId)) {
            this._openDropMenu(e.clientX, e.clientY, source, end.point);
            return;
        }

        if (!canConnectTerminals(source, end)) return;

        createConnectorFromTerminals(this.core, this.eventBus, source, end);
    }

    /**
     * Предлагает создать узел под свободный конец связи и соединяет его.
     *
     * @param {number} clientX
     * @param {number} clientY
     * @param {object} source терминал-источник
     * @param {{x: number, y: number}} worldPoint точка отпускания в координатах мира
     */
    _openDropMenu(clientX, clientY, source, worldPoint) {
        const candidates = findGeneratorDropCandidates(source.portId);
        if (candidates.length === 0 || !worldPoint) return;

        this._dropMenu = this._dropMenu || new GeneratorDropMenu();
        this._dropMenu.open(clientX, clientY, candidates, (entry) => {
            this._createNodeForDrop(source, worldPoint, entry);
        });
    }

    /**
     * @param {object} source терминал-источник
     * @param {{x: number, y: number}} worldPoint точка отпускания в координатах мира
     * @param {object} entry запись каталога с выбранным входным портом
     */
    _createNodeForDrop(source, worldPoint, entry) {
        const { width, height } = entry.size;
        // Карточка встаёт правее точки отпускания и по вертикали центрируется на
        // выбранном входе: связь приходит ровно туда, где курсор её оставил.
        const position = {
            x: Math.round(worldPoint.x),
            y: Math.round(worldPoint.y - entry.port.anchor.y * height),
        };
        const created = this.core?.createObject(entry.type, position, {
            ...entry.createProperties(),
            width,
            height,
        });
        if (!created?.id) return;

        // Якорь берём у созданного объекта: он пересчитывает порты по своей
        // геометрии, и она может отличаться от размера, переданного в create.
        const actual = getObjectPorts(this.eventBus, created.id)
            .find((port) => port.id === entry.port.portId);
        const port = actual?.anchor
            ? { portId: actual.id, anchor: { x: actual.anchor.x, y: actual.anchor.y } }
            : entry.port;

        createConnectorFromTerminals(this.core, this.eventBus, source, terminalForPort(created.id, port));
    }

    // ─── Клик по якорю (без drag) ────────────────────────────────────────────

    /** Определяет сторону объекта по нормализованному якорю [0,1]. */
    _sideFromAnchor(anchor) {
        return sideFromAnchor(anchor);
    }

    /**
     * Обрабатывает клик по точке подключения (pointerup без значимого drag).
     * Всегда дублирует исходник в свободное место в сторону якоря (за ближайшими
     * объектами, если они мешают) и соединяет коннектором. Коннектор огибает
     * препятствия на стороне ConnectorLayer/ConnectorObstacleRouter.
     */
    _onAnchorClick(source) {
        // Дубликат подключается к центру нового объекта, а выходной порт
        // результата принимает только совместимый вход — соединять нечем.
        if (isSingleLinkOutputPort(source?.portId)) return;

        const sourceBounds = this._objectBounds(source.boundId);
        if (!sourceBounds) return;

        const side       = this._sideFromAnchor(source.anchor);
        const originalId = source.boundId;
        const newPos     = resolveFreePlacement(this.eventBus, this.core, originalId, sourceBounds, side);
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
        this.core?.pixi?.hoverLift?.setConnecting(false);
        this._setPortHighlight(null);
        if (this._pendingDupListener) {
            this.eventBus?.off(Events.Tool.DuplicateReady, this._pendingDupListener);
            this._pendingDupListener = null;
        }
        this._clearGraphics();
        this._dropMenu?.destroy();
        this._dropMenu = null;
        this._sourceTerminal = null;
        this.core     = null;
        this.eventBus = null;
    }
}
