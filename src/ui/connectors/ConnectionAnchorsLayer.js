import { Events } from '../../core/events/Events.js';
import { HandlesPositioningService } from '../handles/HandlesPositioningService.js';
import { ConnectorDragController } from '../../tools/object-tools/connector/ConnectorDragController.js';

const ALLOWED_TYPES = new Set(['shape', 'note', 'image', 'text', 'simple-text', 'file']);

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
        this._dragController = null;
        this._onAnchorPointerDown = null;
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
            this._onAnchorPointerDown = (e) => {
                if (!e.target.dataset.connectorAnchor) return;
                e.preventDefault();
                e.stopPropagation();
                this._dragController.startFromAnchor(e);
            };
            this.layer.addEventListener('pointerdown', this._onAnchorPointerDown);
        }
        
        this._attachEvents();
        this.update();
    }

    destroy() {
        this._detachEvents();
        if (this._onAnchorPointerDown && this.layer) {
            this.layer.removeEventListener('pointerdown', this._onAnchorPointerDown);
            this._onAnchorPointerDown = null;
        }
        if (this._dragController) {
            this._dragController.destroy();
            this._dragController = null;
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
            [Events.Comment.ThreadOpened, () => { this._commentPopoverOpen = true; this.layer.innerHTML = ''; }],
            [Events.Comment.DraftOpened,  () => { this._commentPopoverOpen = true; this.layer.innerHTML = ''; }],
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

    _getSingleSelectionWorldBounds(id) {
        const positionData = { objectId: id, position: null };
        const sizeData = { objectId: id, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, positionData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        
        if (positionData.position && sizeData.size) {
            return {
                x: positionData.position.x,
                y: positionData.position.y,
                width: sizeData.size.width,
                height: sizeData.size.height,
            };
        }
        return null;
    }

    update() {
        if (!this.layer) return;
        if (this._commentPopoverOpen) return;
        if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer?._cropMode) {
            this.layer.innerHTML = '';
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
    }

    _renderAnchorsFor(id) {
        const req = { objectId: id, pixiObject: null };
        this.eventBus.emit(Events.Tool.GetObjectPixi, req);
        const mbType = req.pixiObject?._mb?.type;
        
        if (!mbType || !ALLOWED_TYPES.has(mbType)) {
            return;
        }

        const worldBounds = this._getSingleSelectionWorldBounds(id);
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
        
        const offset = 12;
        const radius = 5;
        const dotSize = radius * 2;
        
        const createDot = (side, x, y, ax, ay) => {
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
                border: '2px solid #ffffff'
            });
            
            dot.dataset.connectorAnchor = "1";
            dot.dataset.id = id;
            dot.dataset.side = side;
            dot.dataset.anchorX = ax;
            dot.dataset.anchorY = ay;
            
            wrapper.appendChild(dot);
        };
        
        const cx = Math.round(width / 2);
        const cy = Math.round(height / 2);
        
        createDot('top', cx, -offset, 0.5, 0);
        createDot('right', width + offset, cy, 1, 0.5);
        createDot('bottom', cx, height + offset, 0.5, 1);
        createDot('left', -offset, cy, 0, 0.5);
        
        this.layer.appendChild(wrapper);
    }
}
