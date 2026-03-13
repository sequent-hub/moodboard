import { vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

export function createEventBus() {
    const handlers = new Map();
    return {
        handlers,
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        off: vi.fn(),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

export function createHtmlHandlesContext() {
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

    const core = {
        selectTool: { selectedObjects: new Set() },
        pixi: {
            app: {
                view,
                stage: world,
                renderer: { resolution: 1 },
            },
            worldLayer: world,
            objects: new Map(),
        },
    };

    const store = new Map();

    const setObject = (id, next) => {
        const current = store.get(id) || {
            x: 0, y: 0, width: 1, height: 1, rotation: 0, type: 'note', properties: {},
        };
        const value = { ...current, ...next };
        store.set(id, value);
        core.pixi.objects.set(id, {
            _mb: { type: value.type, properties: value.properties || {} },
            getBounds: () => ({
                x: (value.x * world.scale.x) + world.x,
                y: (value.y * world.scale.y) + world.y,
                width: value.width * world.scale.x,
                height: value.height * world.scale.y,
            }),
        });
    };

    const getObject = (id) => store.get(id);

    eventBus.emit.mockImplementation((event, payload = {}) => {
        if (event === Events.Tool.GetObjectPosition && payload.objectId) {
            const obj = store.get(payload.objectId);
            payload.position = obj ? { x: obj.x, y: obj.y } : null;
        }
        if (event === Events.Tool.GetObjectSize && payload.objectId) {
            const obj = store.get(payload.objectId);
            payload.size = obj ? { width: obj.width, height: obj.height } : null;
        }
        if (event === Events.Tool.GetObjectRotation && payload.objectId) {
            const obj = store.get(payload.objectId);
            payload.rotation = obj ? obj.rotation : 0;
        }
        if (event === Events.Tool.GetObjectPixi && payload.objectId) {
            payload.pixiObject = core.pixi.objects.get(payload.objectId) || null;
        }
        if (event === Events.Tool.GetSelection) {
            payload.selection = Array.from(core.selectTool.selectedObjects);
        }

        const list = eventBus.handlers.get(event) || [];
        for (const handler of list) handler(payload);
    });

    return {
        eventBus,
        container,
        core,
        world,
        setObject,
        getObject,
        cleanup() {
            container.remove();
        },
    };
}
