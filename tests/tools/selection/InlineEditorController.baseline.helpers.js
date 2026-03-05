import { beforeEach, vi } from 'vitest';
import { Events } from '../../../src/core/events/Events.js';

vi.mock('pixi.js', () => ({
    Point: vi.fn().mockImplementation((x, y) => ({ x, y })),
}));

export function createMockEventBus() {
    const handlers = new Map();
    const responders = new Map();

    const on = vi.fn((eventName, handler) => {
        if (!handlers.has(eventName)) handlers.set(eventName, new Set());
        handlers.get(eventName).add(handler);
    });

    const off = vi.fn((eventName, handler) => {
        const set = handlers.get(eventName);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) handlers.delete(eventName);
    });

    const emit = vi.fn((eventName, payload) => {
        const responder = responders.get(eventName);
        if (responder) responder(payload);

        const set = handlers.get(eventName);
        if (!set) return;
        for (const handler of set) handler(payload);
    });

    return {
        on,
        off,
        emit,
        setResponder(eventName, responder) {
            responders.set(eventName, responder);
        },
        clearResponders() {
            responders.clear();
        },
    };
}

export function createDomApp({ resolution = 1, withWorldLayer = true, toGlobal, toLocal } = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const view = document.createElement('canvas');
    view.width = 1000;
    Object.defineProperty(view, 'clientWidth', { configurable: true, value: 1000 });
    container.appendChild(view);

    const containerRect = { left: 0, top: 0, width: 1000, height: 700 };
    const viewRect = { left: 0, top: 0, width: 1000, height: 700 };
    container.getBoundingClientRect = vi.fn(() => containerRect);
    view.getBoundingClientRect = vi.fn(() => viewRect);

    const worldLayer = {
        scale: { x: 1, y: 1 },
        toGlobal: vi.fn((point) => (toGlobal ? toGlobal(point) : { x: point.x, y: point.y })),
        toLocal: vi.fn((point) => (toLocal ? toLocal(point) : { x: point.x, y: point.y })),
    };

    const stage = {
        scale: { x: 1, y: 1 },
        toGlobal: vi.fn((point) => ({ x: point.x, y: point.y })),
        toLocal: vi.fn((point) => ({ x: point.x, y: point.y })),
        getChildByName: vi.fn((name) => (name === 'worldLayer' && withWorldLayer ? worldLayer : null)),
    };

    const app = {
        stage,
        view,
        renderer: { resolution },
    };

    return {
        app,
        worldLayer,
        container,
        setRects({ containerLeft = 0, containerTop = 0, viewLeft = 0, viewTop = 0 } = {}) {
            containerRect.left = containerLeft;
            containerRect.top = containerTop;
            viewRect.left = viewLeft;
            viewRect.top = viewTop;
        },
        cleanup() {
            container.remove();
        },
    };
}

export function createInlineEditorContext({ eventBus, app } = {}) {
    const bus = eventBus || createMockEventBus();
    const domApp = app || createDomApp().app;

    const ctx = {
        eventBus: bus,
        app: domApp,
        textEditor: {
            active: false,
            objectId: null,
            textarea: null,
            wrapper: null,
            world: null,
            position: null,
            properties: null,
            objectType: 'text',
        },
    };

    return ctx;
}

export function collectEventPayloads(eventBus, eventName) {
    return eventBus.emit.mock.calls
        .filter(([name]) => name === eventName)
        .map(([, payload]) => payload);
}

export function installDeterministicComputedStyle() {
    return vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        paddingTop: '0',
        paddingLeft: '0',
        lineHeight: '20',
        fontSize: '20',
        fontFamily: 'Arial',
    }));
}

export function installDefaultGlobals() {
    beforeEach(() => {
        delete window.moodboardHtmlTextLayer;
        delete window.moodboardHtmlHandlesLayer;
    });
}

export function setupNoteResponders(eventBus, { objectId, position, size, pixiInstance } = {}) {
    let posRef = position || { x: 100, y: 100 };
    let sizeRef = size || { width: 160, height: 100 };

    eventBus.setResponder(Events.Tool.GetObjectPosition, (payload) => {
        if (payload && payload.objectId === objectId) payload.position = { ...posRef };
    });
    eventBus.setResponder(Events.Tool.GetObjectSize, (payload) => {
        if (payload && payload.objectId === objectId) payload.size = { ...sizeRef };
    });
    eventBus.setResponder(Events.Tool.GetObjectPixi, (payload) => {
        if (payload && payload.objectId === objectId) {
            payload.pixiObject = {
                _mb: {
                    instance: pixiInstance || null,
                    properties: {},
                },
            };
        }
    });

    return {
        setPosition(nextPos) {
            posRef = { ...nextPos };
        },
        setSize(nextSize) {
            sizeRef = { ...nextSize };
        },
    };
}
