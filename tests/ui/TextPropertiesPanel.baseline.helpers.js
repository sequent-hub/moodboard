import { vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

export function createTextPropertiesPanelContext() {
    const handlers = new Map();
    const eventBus = {
        handlers,
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        off: vi.fn((event, handler) => {
            const list = handlers.get(event) || [];
            handlers.set(event, list.filter((item) => item !== handler));
        }),
        emit: vi.fn((event, payload = {}) => {
            if (event === Events.Tool.GetObjectPosition && payload.objectId) {
                const object = objectsStore.get(payload.objectId);
                payload.position = object ? { ...object.position } : null;
            }
            if (event === Events.Tool.GetObjectSize && payload.objectId) {
                const object = objectsStore.get(payload.objectId);
                payload.size = object ? { ...object.size } : null;
            }
            if (event === Events.Tool.GetObjectPixi && payload.objectId) {
                payload.pixiObject = core.pixi.objects.get(payload.objectId) || null;
            }

            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    Object.assign(container.style, {
        position: 'relative',
        width: '1200px',
        height: '800px',
    });
    container.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 1200,
        bottom: 800,
        width: 1200,
        height: 800,
        x: 0,
        y: 0,
    });

    const objectsStore = new Map();

    const core = {
        selectTool: {
            selectedObjects: new Set(),
        },
        pixi: {
            objects: new Map(),
            worldLayer: {
                x: 0,
                y: 0,
                scale: { x: 1, y: 1 },
            },
        },
        state: {
            markDirty: vi.fn(),
        },
    };

    function setSelected(ids) {
        core.selectTool.selectedObjects = new Set(ids);
    }

    function setObject(id, options = {}) {
        const {
            type = 'text',
            properties = {},
            position = { x: 100, y: 200 },
            size = { width: 240, height: 80 },
        } = options;

        const pixiObject = {
            _mb: {
                type,
                properties: { ...properties },
            },
        };

        objectsStore.set(id, {
            id,
            type,
            position: { ...position },
            size: { ...size },
            pixiObject,
        });
        core.pixi.objects.set(id, pixiObject);
        return pixiObject;
    }

    function removeObject(id) {
        objectsStore.delete(id);
        core.pixi.objects.delete(id);
    }

    function setHtmlTextElement(id) {
        const element = document.createElement('div');
        element.dataset.id = id;
        document.body.appendChild(element);
        return element;
    }

    function cleanup() {
        container.remove();
        for (const element of document.querySelectorAll('[data-id]')) {
            element.remove();
        }
    }

    return {
        eventBus,
        container,
        core,
        setSelected,
        setObject,
        removeObject,
        setHtmlTextElement,
        cleanup,
    };
}

export function getOnEventCounts(onMock) {
    const counts = new Map();
    for (const [eventName] of onMock.mock.calls) {
        counts.set(eventName, (counts.get(eventName) || 0) + 1);
    }
    return counts;
}
