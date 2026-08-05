import { Events } from '../../core/events/Events.js';
import { HandlesPositioningService } from '../handles/HandlesPositioningService.js';
import { ConnectorDragController } from '../../tools/object-tools/connector/ConnectorDragController.js';
import { AnchorHoverGhost } from '../../tools/object-tools/connector/AnchorHoverGhost.js';
import { getPortsFromPixi, portDomId } from '../../services/ConnectorPortRegistry.js';
import { IMAGE_GENERATOR_TYPE, PORT_CHIP_SIZE } from '../../services/ai/imageGeneratorContract.js';
import { findIncomingConnections } from '../../services/ai/imageGeneratorInputs.js';

const ALLOWED_TYPES = new Set(['shape', 'note', 'image', 'text', 'simple-text', 'file', 'image-generator']);

/** Разделитель в ключе подсветки: в id объектов и портов не встречается. */
const PORT_KEY_SEPARATOR = '::';

/**
 * @param {string} objectId
 * @param {string} portId
 * @returns {string}
 */
export function portHighlightKey(objectId, portId) {
    return `${objectId}${PORT_KEY_SEPARATOR}${portId}`;
}

/**
 * @param {string} key
 * @returns {{objectId: string, portId: string|null}}
 */
export function parsePortHighlightKey(key) {
    const index = String(key).lastIndexOf(PORT_KEY_SEPARATOR);
    if (index === -1) return { objectId: String(key), portId: null };

    return {
        objectId: String(key).slice(0, index),
        portId: String(key).slice(index + PORT_KEY_SEPARATOR.length) || null,
    };
}

export class ConnectionAnchorsLayer {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.positioningService = new HandlesPositioningService(this);
        
        this.subscriptions = [];
        this._eventsAttached = false;
        
        this.hoveredObjectId = null;
        this._highlightedPorts = new Set();
        this._dragController = null;
        this._hoverGhost = null;
        this._onAnchorPointerDown = null;
        this._onAnchorPointerOver = null;
        this._onAnchorPointerOut = null;
        this._commentPopoverOpen = false;
    }

    attach() {
        if (!this.layer) {
            this.layer = document.createElement('div');
            this.layer.className = 'mb-connection-anchors-layer';
            Object.assign(this.layer.style, {
                position: 'absolute',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '35'
            });
            this.container.appendChild(this.layer);

            this._dragController = new ConnectorDragController(this.core, this.eventBus);
            this._hoverGhost = new AnchorHoverGhost(this.core, this.eventBus, this.positioningService, this.container);
            this._onAnchorPointerDown = (e) => {
                if (!e.target.dataset.connectorAnchor) return;
                e.preventDefault();
                e.stopPropagation();
                this._hoverGhost.hide();
                this._dragController.startFromAnchor(e);
            };
            this._onAnchorPointerOver = (e) => {
                if (!e.target.dataset.connectorAnchor) return;
                const r = e.target.getBoundingClientRect();
                this._hoverGhost.show({
                    id: e.target.dataset.id,
                    anchorX: e.target.dataset.anchorX,
                    anchorY: e.target.dataset.anchorY,
                    anchorClient: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
                });
            };
            this._onAnchorPointerOut = (e) => {
                if (!e.target.dataset.connectorAnchor) return;
                this._hoverGhost.hide();
            };
            this.layer.addEventListener('pointerdown', this._onAnchorPointerDown);
            this.layer.addEventListener('pointerover', this._onAnchorPointerOver);
            this.layer.addEventListener('pointerout', this._onAnchorPointerOut);
        }
        
        this._attachEvents();
        this.update();
    }

    destroy() {
        this._detachEvents();
        this._syncPortHighlights(new Set());
        if (this.layer) {
            if (this._onAnchorPointerDown) this.layer.removeEventListener('pointerdown', this._onAnchorPointerDown);
            if (this._onAnchorPointerOver) this.layer.removeEventListener('pointerover', this._onAnchorPointerOver);
            if (this._onAnchorPointerOut)  this.layer.removeEventListener('pointerout',  this._onAnchorPointerOut);
        }
        this._onAnchorPointerDown = null;
        this._onAnchorPointerOver = null;
        this._onAnchorPointerOut  = null;
        if (this._dragController) {
            this._dragController.destroy();
            this._dragController = null;
        }
        if (this._hoverGhost) {
            this._hoverGhost.destroy();
            this._hoverGhost = null;
        }
        if (this.layer && this.layer.parentNode) {
            this.layer.parentNode.removeChild(this.layer);
        }
        this.layer = null;
        this.eventBus = null;
        this.core = null;
        this.container = null;
    }

    _attachEvents() {
        if (this._eventsAttached) return;
        
        const bindings = [
            [Events.Object.Hover, (e) => {
                this.hoveredObjectId = e.objectId || null;
                this.update();
            }],
            [Events.Tool.SelectionAdd, () => this.update()],
            [Events.Tool.SelectionRemove, () => this.update()],
            [Events.Tool.SelectionClear, () => this.update()],
            [Events.Object.Created, () => this.update()],
            [Events.Object.Deleted, () => this.update()],
            [Events.Object.Updated, () => this.update()],
            [Events.Object.StateChanged, () => this.update()],
            [Events.Tool.DragUpdate, () => this.update()],
            [Events.Tool.DragEnd, () => this.update()],
            [Events.Tool.ResizeUpdate, () => this.update()],
            [Events.Tool.ResizeEnd, () => this.update()],
            [Events.Tool.GroupDragUpdate, () => this.update()],
            [Events.Tool.GroupResizeUpdate, () => this.update()],
            [Events.Tool.RotateUpdate, () => this.update()],
            [Events.Tool.PanUpdate, () => this.update()],
            [Events.Viewport.Changed, () => this.update()],
            [Events.UI.ZoomPercent, () => this.update()],
            [Events.History.Changed, () => this.update()],
            [Events.Board.Loaded, () => this.update()],
            [Events.Comment.ThreadOpened, () => { this._commentPopoverOpen = true; this._hoverGhost?.hide(); this.layer.innerHTML = ''; }],
            [Events.Comment.DraftOpened,  () => { this._commentPopoverOpen = true; this._hoverGhost?.hide(); this.layer.innerHTML = ''; }],
            [Events.Comment.DraftClosed,  () => { this._commentPopoverOpen = false; this.update(); }],
            [Events.Comment.ThreadDeleted, () => { this._commentPopoverOpen = false; this.update(); }],
            [Events.Comment.PopoverClosed, () => { this._commentPopoverOpen = false; this.update(); }],
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
            this._eventsAttached = false;
            return;
        }
        this.subscriptions.forEach(([event, handler]) => {
            this.eventBus.off(event, handler);
        });
        this.subscriptions = [];
        this._eventsAttached = false;
    }

    update() {
        if (!this.layer) return;
        if (this._commentPopoverOpen) {
            this._syncPortHighlights(new Set());
            return;
        }
        if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer?._cropMode) {
            this.layer.innerHTML = '';
            this._syncPortHighlights(new Set());
            return;
        }
        this.layer.innerHTML = '';
        
        const selection = Array.from(this.core?.selectTool?.selectedObjects || []);
        let selectedId = null;
        if (selection.length === 1) {
            selectedId = selection[0];
        }
        
        const targets = new Set();
        if (this.hoveredObjectId) targets.add(this.hoveredObjectId);
        if (selectedId) targets.add(selectedId);
        
        targets.forEach(id => {
            this._renderAnchorsFor(id);
        });

        // Подложка порта — только у генераторов с реально подключённым
        // коннектором. Выделение и hover сами по себе её не зажигают.
        this._syncPortHighlights(this._collectConnectedPortTargets());
    }

    /**
     * Входные порты генераторов, в которые приходит коннектор.
     *
     * Ключ — пара «объект + порт»: у узла входов несколько, и связь в один из них
     * не должна зажигать подложку у соседнего.
     *
     * @returns {Set<string>}
     */
    _collectConnectedPortTargets() {
        const objects = this.core?.state?.getObjects?.() || [];
        const connected = new Set();

        objects.forEach((obj) => {
            if (obj?.type !== IMAGE_GENERATOR_TYPE || !obj.id) return;

            findIncomingConnections(objects, obj.id).forEach((link) => {
                connected.add(portHighlightKey(obj.id, link.portId));
            });
        });

        return connected;
    }

    /**
     * Держит подсветку портов в объектах в соответствии с набором целей.
     *
     * Сравнением с предыдущим набором, а не переустановкой: update() зовётся на
     * каждом кадре зума и перетаскивания, и безусловный вызов перезапускал бы
     * анимацию подложки каждый кадр.
     *
     * @param {Set<string>} keys порты (ключ «объект + порт»), которые должны гореть
     */
    _syncPortHighlights(keys) {
        const next = keys instanceof Set ? new Set(keys) : new Set(keys || []);

        this._highlightedPorts.forEach((key) => {
            if (!next.has(key)) this._setPortHighlight(key, false);
        });
        next.forEach((key) => {
            if (!this._highlightedPorts.has(key)) this._setPortHighlight(key, true);
        });

        this._highlightedPorts = next;
    }

    /**
     * @param {string} key ключ «объект + порт»
     * @param {boolean} active
     */
    _setPortHighlight(key, active) {
        const { objectId, portId } = parsePortHighlightKey(key);
        const req = { objectId, pixiObject: null };
        this.eventBus?.emit(Events.Tool.GetObjectPixi, req);

        const instance = req.pixiObject?._mb?.instance;
        if (typeof instance?.setPortHighlight === 'function') {
            instance.setPortHighlight(active, 'connected', portId);
        }
    }

    /**
     * Масштаб холста. Нужен для хит-зон, заданных в мировых единицах.
     * @returns {number}
     */
    _worldScale() {
        try {
            return this.positioningService.getWorldTransform().s || 1;
        } catch (_) {
            return 1;
        }
    }

    _renderAnchorsFor(id) {
        const req = { objectId: id, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPixi, req);
        const mbType = req.pixiObject?._mb?.type;
        
        if (!mbType || !ALLOWED_TYPES.has(mbType)) {
            return;
        }

        // Границы считаем тем же сервисом, что и рамка выделения
        // (HandlesPositioningService.getSingleSelectionWorldBounds): для текста это
        // реальный DOM-бокс .mb-text, а не state-размер. Иначе якоря смещены
        // относительно рамки, т.к. у текста DOM-бокс ≠ сохранённый width/height.
        const worldBounds = this.positioningService.getSingleSelectionWorldBounds(id, req.pixiObject);
        if (!worldBounds) return;

        const cssRect = this.positioningService.worldBoundsToCssRect(worldBounds);
        
        const left = Math.round(cssRect.left);
        const top = Math.round(cssRect.top);
        const width = Math.max(1, Math.round(cssRect.width));
        const height = Math.max(1, Math.round(cssRect.height));
        
        const rotationData = { objectId: id, rotation: 0 };
        this.eventBus.emit(Events.Tool.GetObjectRotation, rotationData);
        const rotation = rotationData.rotation || 0;

        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            position: 'absolute',
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
            pointerEvents: 'none',
            transformOrigin: 'center center',
            transform: `rotate(${rotation}deg)`,
            boxSizing: 'border-box'
        });
        
        const offset = mbType === 'note' ? 20 : 12;
        const radius = 5;
        const dotSize = radius * 2;
        
        const createDot = (side, x, y, ax, ay, portId = null) => {
            const dot = document.createElement('div');
            dot.className = 'mb-connection-anchor';
            Object.assign(dot.style, {
                position: 'absolute',
                left: `${Math.round(x - radius)}px`,
                top: `${Math.round(y - radius)}px`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                backgroundColor: '#2563EB',
                borderRadius: '50%',
                pointerEvents: 'auto',
                boxSizing: 'border-box',
                border: '2px solid #ffffff',
                cursor: 'pointer'
            });
            
            dot.dataset.connectorAnchor = "1";
            dot.dataset.id = id;
            dot.dataset.side = side;
            dot.dataset.anchorX = ax;
            dot.dataset.anchorY = ay;
            if (portId) {
                dot.dataset.portId = portId;
                dot.id = portDomId(id, portId);
                dot.classList.add('mb-connection-anchor--port');

                // Визуал порта рисует сам объект в PIXI (иконка на круглой
                // подложке) — только так он масштабируется вместе с узлом.
                // DOM-точке остаётся роль хит-зоны под старт коннектора,
                // размером с подложку.
                const hit = Math.max(dotSize, Math.round(PORT_CHIP_SIZE * this._worldScale()));
                Object.assign(dot.style, {
                    left: `${Math.round(x - hit / 2)}px`,
                    top: `${Math.round(y - hit / 2)}px`,
                    width: `${hit}px`,
                    height: `${hit}px`,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                });
            }
            
            wrapper.appendChild(dot);
        };
        
        const cx = Math.round(width / 2);
        const cy = Math.round(height / 2);

        // Объект с именованными портами (узел-генератор) сам определяет точки
        // привязки: середины граней для него не имеют смысла.
        const ports = getPortsFromPixi(req.pixiObject);
        if (ports.length > 0) {
            ports.forEach((port) => {
                if (!port?.anchor || port.enabled === false) return;
                createDot(
                    port.id,
                    Math.round(port.anchor.x * width),
                    Math.round(port.anchor.y * height),
                    port.anchor.x,
                    port.anchor.y,
                    port.id
                );
            });
            this.layer.appendChild(wrapper);
            return;
        }
        
        createDot('top', cx, -offset, 0.5, 0);
        createDot('right', width + offset, cy, 1, 0.5);
        createDot('bottom', cx, height + offset, 0.5, 1);
        createDot('left', -offset, cy, 0, 0.5);
        
        this.layer.appendChild(wrapper);
    }
}
