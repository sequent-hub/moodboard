import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { setupTransformFlow } from '../../src/core/flows/TransformFlow.js';
import { Events } from '../../src/core/events/Events.js';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';

function degToRad(angle) {
    return angle * Math.PI / 180;
}

function rotatePoint(point, center, angleDeg) {
    const rad = degToRad(angleDeg);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
}

function getObjectCorners({ x, y, width, height, rotation }) {
    const center = { x: x + width / 2, y: y + height / 2 };
    const corners = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
    ];
    return corners.map((corner) => rotatePoint(corner, center, rotation || 0));
}

function getAxisAlignedBounds(corners) {
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, new Set());
            handlers.get(event).add(handler);
        }),
        off: vi.fn((event, handler) => {
            const set = handlers.get(event);
            if (!set) return;
            set.delete(handler);
            if (set.size === 0) handlers.delete(event);
        }),
        emit: vi.fn((event, payload) => {
            const set = handlers.get(event);
            if (!set) return;
            for (const handler of set) handler(payload);
        }),
    };
}

function createRotationGeometryContext() {
    const eventBus = createEventBus();
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800,
    });

    const view = document.createElement('canvas');
    view.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800,
    });

    const world = {
        x: 0,
        y: 0,
        scale: { x: 1, y: 1 },
        toGlobal(point) {
            return {
                x: (point.x * this.scale.x) + this.x,
                y: (point.y * this.scale.y) + this.y,
            };
        },
        toLocal(point) {
            return {
                x: (point.x - this.x) / this.scale.x,
                y: (point.y - this.y) / this.scale.y,
            };
        },
    };

    const objects = [
        {
            id: 'sq-a',
            type: 'note',
            position: { x: 0, y: 0 },
            width: 40,
            height: 40,
            properties: {},
            transform: { rotation: 0 },
        },
        {
            id: 'sq-b',
            type: 'note',
            position: { x: 70, y: 10 },
            width: 40,
            height: 40,
            properties: {},
            transform: { rotation: 0 },
        },
        {
            id: 'sq-c',
            type: 'note',
            position: { x: 20, y: 60 },
            width: 40,
            height: 40,
            properties: {},
            transform: { rotation: 0 },
        },
    ];

    const state = {
        state: { objects, board: {}, selectedObjects: [], isDirty: false },
        getObjects: vi.fn(() => state.state.objects),
        markDirty: vi.fn(() => {
            state.state.isDirty = true;
        }),
    };

    const pixiObjects = new Map();
    for (const obj of objects) {
        pixiObjects.set(obj.id, {
            id: obj.id,
            _mb: { type: obj.type },
            width: obj.width,
            height: obj.height,
            x: obj.position.x + obj.width / 2,
            y: obj.position.y + obj.height / 2,
            rotation: degToRad(obj.transform?.rotation || 0),
            getBounds() {
                const corners = getObjectCorners({
                    x: this.x - this.width / 2,
                    y: this.y - this.height / 2,
                    width: this.width,
                    height: this.height,
                    rotation: this.rotation * 180 / Math.PI,
                });
                return getAxisAlignedBounds(corners);
            },
        });
    }

    const core = {
        eventBus,
        state,
        history: { executeCommand: vi.fn() },
        pixi: {
            app: {
                view,
                stage: world,
                renderer: { resolution: 1 },
            },
            worldLayer: world,
            objects: pixiObjects,
            updateObjectRotation: vi.fn((objectId, angleDeg) => {
                const pixiObject = pixiObjects.get(objectId);
                if (!pixiObject) return;
                pixiObject.rotation = degToRad(angleDeg);
            }),
            updateObjectSize: vi.fn(),
        },
        selectTool: {
            selectedObjects: new Set(),
            selection: new Set(),
            updateResizeHandles: vi.fn(),
        },
        resizeStartSize: null,
        dragStartPosition: null,
        _activeResize: null,
        _groupResizeSnapshot: null,
        _groupResizeStart: null,
        _groupRotateStart: null,
        _groupRotateCenter: null,
    };

    core.updateObjectPositionDirect = CoreMoodBoard.prototype.updateObjectPositionDirect.bind(core);
    core.updateObjectRotationDirect = CoreMoodBoard.prototype.updateObjectRotationDirect.bind(core);
    core.updateObjectSizeAndPositionDirect = CoreMoodBoard.prototype.updateObjectSizeAndPositionDirect.bind(core);

    eventBus.on(Events.Tool.GetSelection, (payload) => {
        payload.selection = Array.from(core.selectTool.selectedObjects);
    });
    eventBus.on(Events.Tool.GetObjectRotation, (payload) => {
        const object = state.state.objects.find((item) => item.id === payload.objectId);
        payload.rotation = object?.transform?.rotation || 0;
    });
    eventBus.on(Events.Tool.GetObjectPixi, (payload) => {
        payload.pixiObject = core.pixi.objects.get(payload.objectId) || null;
    });
    eventBus.on(Events.Tool.GetObjectPosition, (payload) => {
        const object = state.state.objects.find((item) => item.id === payload.objectId);
        payload.position = object ? { ...object.position } : null;
    });
    eventBus.on(Events.Tool.GetObjectSize, (payload) => {
        const object = state.state.objects.find((item) => item.id === payload.objectId);
        payload.size = object ? { width: object.width, height: object.height } : null;
    });

    return {
        container,
        core,
        objects,
        cleanup() {
            container.remove();
        },
    };
}

function pointInsideRotatedFrame(point, frame) {
    const center = {
        x: frame.left + frame.width / 2,
        y: frame.top + frame.height / 2,
    };
    const local = rotatePoint(point, center, -(frame.rotation || 0));
    const epsilon = 0.01;
    return (
        local.x >= frame.left - epsilon &&
        local.x <= frame.left + frame.width + epsilon &&
        local.y >= frame.top - epsilon &&
        local.y <= frame.top + frame.height + epsilon
    );
}

describe('HtmlHandlesLayer group rotate geometry', () => {
    let ctx;
    let layer;
    let listeners;
    let addSpy;
    let removeSpy;

    beforeEach(() => {
        listeners = {};
        addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((name, handler) => {
            listeners[name] = handler;
        });
        removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});
        ctx = createRotationGeometryContext();
        setupTransformFlow(ctx.core);
        layer = new HtmlHandlesLayer(ctx.container, ctx.core.eventBus, ctx.core);
        layer.attach();
    });

    afterEach(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
        vi.restoreAllMocks();
        layer?.destroy();
        ctx?.cleanup();
    });

    it('keeps all selected square corners inside the rotated group frame during and after rotation', () => {
        const ids = ['sq-a', 'sq-b', 'sq-c'];
        ids.forEach((id) => {
            ctx.core.selectTool.selectedObjects.add(id);
            ctx.core.selectTool.selection.add(id);
        });

        ctx.core.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'sq-a' });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ids,
            center: { x: 55, y: 50 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ids,
            angle: 30,
        });

        let box = ctx.container.querySelector('.mb-handles-box');
        let frame = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
            rotation: 30,
        };

        for (const object of ctx.core.state.state.objects) {
            const corners = getObjectCorners({
                x: object.position.x,
                y: object.position.y,
                width: object.width,
                height: object.height,
                rotation: object.transform?.rotation || 0,
            });
            for (const corner of corners) {
                expect(pointInsideRotatedFrame(corner, frame)).toBe(true);
            }
        }

        ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, { objects: ids });

        box = ctx.container.querySelector('.mb-handles-box');
        frame = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
            rotation: 30,
        };

        for (const object of ctx.core.state.state.objects) {
            const corners = getObjectCorners({
                x: object.position.x,
                y: object.position.y,
                width: object.width,
                height: object.height,
                rotation: object.transform?.rotation || 0,
            });
            for (const corner of corners) {
                expect(pointInsideRotatedFrame(corner, frame)).toBe(true);
            }
        }
    });

    it('keeps all selected square corners inside the rotated group frame during resize after rotation', () => {
        const ids = ['sq-a', 'sq-b', 'sq-c'];
        ids.forEach((id) => {
            ctx.core.selectTool.selectedObjects.add(id);
            ctx.core.selectTool.selection.add(id);
        });

        ctx.core.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'sq-a' });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ids,
            center: { x: 55, y: 50 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ids,
            angle: 30,
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateEnd, { objects: ids });

        let box = ctx.container.querySelector('.mb-handles-box');
        const frameBefore = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
            rotation: 30,
        };

        const handle = box.querySelector('[data-dir="se"]');
        const startPointer = rotatePoint(
            {
                x: frameBefore.left + frameBefore.width,
                y: frameBefore.top + frameBefore.height,
            },
            {
                x: frameBefore.left + frameBefore.width / 2,
                y: frameBefore.top + frameBefore.height / 2,
            },
            frameBefore.rotation
        );
        const endPointer = rotatePoint(
            {
                x: frameBefore.left + frameBefore.width + 20,
                y: frameBefore.top + frameBefore.height + 10,
            },
            {
                x: frameBefore.left + frameBefore.width / 2,
                y: frameBefore.top + frameBefore.height / 2,
            },
            frameBefore.rotation
        );

        layer._onHandleDown({
            currentTarget: handle,
            clientX: startPointer.x,
            clientY: startPointer.y,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        }, box);

        listeners.mousemove({
            clientX: endPointer.x,
            clientY: endPointer.y,
        });

        box = ctx.container.querySelector('.mb-handles-box');
        const frame = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
            rotation: 30,
        };

        for (const object of ctx.core.state.state.objects) {
            const corners = getObjectCorners({
                x: object.position.x,
                y: object.position.y,
                width: object.width,
                height: object.height,
                rotation: object.transform?.rotation || 0,
            });
            for (const corner of corners) {
                expect(pointInsideRotatedFrame(corner, frame)).toBe(true);
            }
        }
    });
});
