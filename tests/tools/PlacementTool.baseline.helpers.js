import { vi } from 'vitest';

vi.mock('../../src/assets/icons/i-cursor.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

vi.mock('pixi.js', () => {
    const createGraphicsMock = () => ({
        clear: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawRoundedRect: vi.fn().mockReturnThis(),
        drawRect: vi.fn().mockReturnThis(),
        drawCircle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        addChild: vi.fn(),
        removeChild: vi.fn(),
        destroy: vi.fn(),
        parent: null,
        x: 0,
        y: 0,
        alpha: 1,
        zIndex: 0,
        filters: null,
    });

    const createContainerMock = () => ({
        addChild: vi.fn(),
        removeChild: vi.fn(),
        destroy: vi.fn(),
        children: [],
        alpha: 1,
        x: 0,
        y: 0,
        pivot: { x: 0, y: 0, set: vi.fn() },
    });

    return {
        Container: vi.fn().mockImplementation(() => createContainerMock()),
        Graphics: vi.fn().mockImplementation(() => createGraphicsMock()),
        Text: vi.fn().mockImplementation((content, style) => ({
            text: content || '',
            style: style || {},
            x: 0,
            y: 0,
            width: 100,
            height: 20,
            anchor: { set: vi.fn() },
            getLocalBounds: vi.fn(() => ({ x: 0, y: 0, width: 48, height: 48 })),
            scale: { set: vi.fn() },
        })),
        Sprite: vi.fn().mockImplementation(() => ({
            width: 100,
            height: 100,
        })),
        Point: vi.fn().mockImplementation((x, y) => ({ x, y })),
        Texture: {
            fromURL: vi.fn().mockResolvedValue({ width: 300, height: 200 }),
        },
        filters: {
            BlurFilter: vi.fn().mockImplementation(() => ({ blur: 6 })),
        },
    };
});

export function createMockEventBus({ dispatch = true } = {}) {
    const handlers = new Map();
    const on = vi.fn((eventName, handler) => {
        if (!handlers.has(eventName)) handlers.set(eventName, []);
        handlers.get(eventName).push(handler);
    });
    const off = vi.fn((eventName, handler) => {
        const list = handlers.get(eventName) || [];
        handlers.set(eventName, list.filter((h) => h !== handler));
    });
    const emit = vi.fn((eventName, payload) => {
        if (!dispatch) return;
        const list = handlers.get(eventName) || [];
        for (const handler of list) handler(payload);
    });
    return { on, off, emit, handlers };
}

export function createMockWorld(toLocalImpl = null) {
    return {
        addChild: vi.fn(),
        removeChild: vi.fn(),
        toLocal: vi.fn((point) => (toLocalImpl ? toLocalImpl(point) : { x: point.x, y: point.y })),
    };
}

export function createMockApp(world) {
    const listeners = new Map();
    const addEventListener = vi.fn((eventName, handler) => {
        if (!listeners.has(eventName)) listeners.set(eventName, []);
        listeners.get(eventName).push(handler);
    });
    const removeEventListener = vi.fn((eventName, handler) => {
        const list = listeners.get(eventName) || [];
        listeners.set(eventName, list.filter((h) => h !== handler));
    });

    const view = {
        style: { cursor: '' },
        addEventListener,
        removeEventListener,
        getBoundingClientRect: vi.fn(() => ({
            left: 0,
            top: 0,
            width: 1200,
            height: 800,
            right: 1200,
            bottom: 800,
        })),
        parentElement: {
            getBoundingClientRect: vi.fn(() => ({
                left: 0,
                top: 0,
                width: 1200,
                height: 800,
            })),
        },
        __dispatch(eventName, payload) {
            const list = listeners.get(eventName) || [];
            for (const handler of list) handler(payload);
        },
    };

    return {
        view,
        stage: {
            getChildByName: vi.fn((name) => (name === 'worldLayer' ? world : null)),
        },
        renderer: {
            events: {
                cursorStyles: {
                    pointer: 'pointer',
                    default: 'default',
                },
            },
        },
    };
}

export function collectEventPayloads(eventBus, eventName) {
    return eventBus.emit.mock.calls
        .filter(([name]) => name === eventName)
        .map(([, payload]) => payload);
}
