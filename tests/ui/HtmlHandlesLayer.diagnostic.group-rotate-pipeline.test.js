import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { setupTransformFlow } from '../../src/core/flows/TransformFlow.js';
import { Events } from '../../src/core/events/Events.js';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';

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

function createWorld() {
    return {
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
}

function createPipelineContext() {
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

    const world = createWorld();
    const objects = [
        {
            id: 'obj-a',
            type: 'note',
            position: { x: 10, y: 10 },
            width: 80,
            height: 50,
            properties: {},
            transform: { rotation: 0 },
        },
        {
            id: 'obj-b',
            type: 'note',
            position: { x: 120, y: 30 },
            width: 90,
            height: 60,
            properties: {},
            transform: { rotation: 35 },
        },
    ];

    const state = {
        state: {
            objects,
            board: {},
            selectedObjects: [],
            isDirty: false,
        },
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
            rotation: (obj.transform?.rotation || 0) * Math.PI / 180,
            getBounds() {
                return {
                    x: this.x - this.width / 2,
                    y: this.y - this.height / 2,
                    width: this.width,
                    height: this.height,
                };
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
                pixiObject.rotation = angleDeg * Math.PI / 180;
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
        cleanup() {
            container.remove();
        },
    };
}

describe('HtmlHandlesLayer diagnostics: group rotate pipeline', () => {
    let ctx;
    let layer;
    let infoSpy;

    beforeEach(() => {
        ctx = createPipelineContext();
        setupTransformFlow(ctx.core);
        layer = new HtmlHandlesLayer(ctx.container, ctx.core.eventBus, ctx.core);
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        layer.attach();
    });

    afterEach(() => {
        infoSpy?.mockRestore();
        layer?.destroy();
        ctx?.cleanup();
    });

    it('logs transform-flow rotation data and resulting group box data in one pipeline', () => {
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');
        ctx.core.selectTool.selection.add('obj-a');
        ctx.core.selectTool.selection.add('obj-b');

        ctx.core.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });
        infoSpy.mockClear();

        ctx.core.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 110, y: 50 },
        });
        ctx.core.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: 20,
        });

        const transformCall = infoSpy.mock.calls.find(
            ([message]) => message === 'TransformFlow group rotate diagnostics:'
        );
        const handlesCall = infoSpy.mock.calls.find(
            ([message]) => message === 'HtmlHandlesLayer group box diagnostics:'
        );

        expect(transformCall).toBeTruthy();
        expect(handlesCall).toBeTruthy();

        expect(transformCall[1]).toEqual(expect.objectContaining({
            angleDelta: 20,
            center: { x: 110, y: 50 },
            objects: expect.arrayContaining([
                expect.objectContaining({
                    id: 'obj-a',
                    startAngle: 0,
                    newAngle: 20,
                }),
                expect.objectContaining({
                    id: 'obj-b',
                    startAngle: 35,
                    newAngle: 55,
                }),
            ]),
        }));

        expect(handlesCall[1]).toEqual(expect.objectContaining({
            targetId: '__group__',
            rotation: 20,
            worldBounds: expect.objectContaining({
                x: expect.any(Number),
                y: expect.any(Number),
                width: 200,
                height: 80,
            }),
        }));

        const stateA = ctx.core.state.state.objects.find((item) => item.id === 'obj-a');
        const stateB = ctx.core.state.state.objects.find((item) => item.id === 'obj-b');
        expect(stateA.transform.rotation).toBe(20);
        expect(stateB.transform.rotation).toBe(55);
    });
});
