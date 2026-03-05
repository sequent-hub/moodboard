import { vi } from 'vitest';

vi.mock('pixi.js', () => {
    const createGraphics = () => ({
        clear: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawRect: vi.fn().mockReturnThis(),
        drawRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        zIndex: 0,
        name: '',
        parent: null,
        position: { set: vi.fn() },
        pivot: { set: vi.fn() },
        rotation: 0,
    });

    const createContainer = () => ({
        addChild: vi.fn(),
        removeChild: vi.fn(),
        destroy: vi.fn(),
        children: [],
        visible: true,
        name: '',
        position: { set: vi.fn() },
        pivot: { set: vi.fn() },
        scale: { x: 1, y: 1 },
    });

    return {
        Container: vi.fn().mockImplementation(() => createContainer()),
        Graphics: vi.fn().mockImplementation(() => createGraphics()),
        Text: vi.fn().mockImplementation(() => ({
            text: '',
            style: {},
            x: 0,
            y: 0,
            anchor: { set: vi.fn() },
        })),
        Point: vi.fn().mockImplementation((x, y) => ({ x, y })),
        Rectangle: vi.fn().mockImplementation((x, y, width, height) => ({ x, y, width, height })),
    };
});

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="50px" height="50px"></svg>',
}));

vi.mock('../../src/tools/ResizeHandles.js', () => ({
    ResizeHandles: vi.fn().mockImplementation((app) => ({
        app,
        container: { visible: false, children: [] },
        hideHandles: vi.fn(),
        updateHandles: vi.fn(),
        destroy: vi.fn(),
        getHandleInfo: vi.fn(() => null),
    })),
}));

import { SelectTool } from '../../src/tools/object-tools/SelectTool.js';

export function createMockEventBus({ dispatch = false } = {}) {
    const handlers = new Map();
    const on = vi.fn((event, handler) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(handler);
    });
    const off = vi.fn((event, handler) => {
        const set = handlers.get(event);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) handlers.delete(event);
    });
    const emit = vi.fn((event, payload) => {
        if (!dispatch) return;
        const set = handlers.get(event);
        if (!set) return;
        for (const handler of set) handler(payload);
    });
    return { on, off, emit, handlers };
}

export function createMockApp() {
    const worldLayer = {
        name: 'worldLayer',
        toLocal: vi.fn((p) => ({ x: p.x, y: p.y })),
        toGlobal: vi.fn((p) => ({ x: p.x, y: p.y })),
        getChildByName: vi.fn(() => null),
        scale: { x: 1, y: 1 },
    };
    const stage = {
        children: [],
        sortableChildren: true,
        addChild: vi.fn((child) => {
            child.parent = stage;
            stage.children.push(child);
        }),
        removeChild: vi.fn((child) => {
            stage.children = stage.children.filter((c) => c !== child);
            if (child) child.parent = null;
        }),
        getChildByName: vi.fn((name) => (name === 'worldLayer' ? worldLayer : null)),
    };
    return {
        stage,
        view: {
            style: { cursor: '' },
            width: 1000,
            clientWidth: 1000,
            getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 1000, height: 700 })),
            parentElement: {
                getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 1000, height: 700 })),
                appendChild: vi.fn(),
            },
        },
        renderer: {
            resolution: 1,
            events: { cursorStyles: {} },
        },
    };
}

export function createMouseEvent(x, y, overrides = {}) {
    return {
        x,
        y,
        button: 0,
        originalEvent: {
            ctrlKey: false,
            metaKey: false,
            altKey: false,
            shiftKey: false,
            clientX: x,
            clientY: y,
            preventDefault: vi.fn(),
            ...overrides.originalEvent,
        },
        ...overrides,
    };
}

export function createSelectToolContext(options = {}) {
    const eventBus = createMockEventBus(options);
    const tool = new SelectTool(eventBus);
    const app = createMockApp();
    return { eventBus, tool, app };
}

export function collectEventPayloads(eventBus, eventName) {
    return eventBus.emit.mock.calls
        .filter(([name]) => name === eventName)
        .map(([, payload]) => payload);
}

