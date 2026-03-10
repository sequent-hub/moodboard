/**
 * Baseline-тесты жизненного цикла FrameObject.
 * Проверяют: подписку на ZoomPercent, корректную отписку в destroy (без утечки).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

vi.mock('pixi.js', () => {
    const createGraphicsMock = () => ({
        clear: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawRoundedRect: vi.fn().mockReturnThis(),
        pivot: { set: vi.fn(), x: 0, y: 0 },
        hitArea: null,
        containsPoint: null,
        getBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
    });

    const createTextMock = () => ({
        text: '',
        anchor: { set: vi.fn(), x: 0, y: 0 },
        scale: { set: vi.fn(), x: 1, y: 1 },
        x: 0,
        y: 0,
        style: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold' },
    });

    const createContainerMock = () => ({
        addChild: vi.fn(),
        pivot: { set: vi.fn(), x: 0, y: 0 },
        x: 0,
        y: 0,
        rotation: 0,
        destroy: vi.fn(),
    });

    return {
        Container: vi.fn().mockImplementation(() => createContainerMock()),
        Graphics: vi.fn().mockImplementation(() => createGraphicsMock()),
        Text: vi.fn().mockImplementation((content, style) => createTextMock()),
        TextMetrics: { measureText: vi.fn(() => ({ width: 50 })) },
        TextStyle: vi.fn(),
        Rectangle: vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h })),
    };
});

import { FrameObject } from '../../src/objects/FrameObject.js';

function createEventBusWithHandlerTracking() {
    const zoomHandlers = [];
    return {
        on: vi.fn((event, handler) => {
            if (event === Events.UI.ZoomPercent) {
                zoomHandlers.push(handler);
            }
        }),
        off: vi.fn((event, handler) => {
            if (event === Events.UI.ZoomPercent && handler) {
                const idx = zoomHandlers.indexOf(handler);
                if (idx >= 0) zoomHandlers.splice(idx, 1);
            }
        }),
        emit: vi.fn((event, data) => {
            if (event === Events.UI.ZoomPercent) {
                zoomHandlers.forEach((h) => h(data));
            }
        }),
        _getZoomHandlerCount: () => zoomHandlers.length,
        _handlers: zoomHandlers,
    };
}

describe('FrameObject lifecycle', () => {
    let eventBus;

    beforeEach(() => {
        eventBus = createEventBusWithHandlerTracking();
    });

    it('subscribes to ZoomPercent on construction when eventBus provided', () => {
        new FrameObject({ width: 100, height: 100 }, eventBus);
        expect(eventBus.on).toHaveBeenCalledWith(Events.UI.ZoomPercent, expect.any(Function));
    });

    it('does not subscribe when eventBus is null', () => {
        new FrameObject({ width: 100, height: 100 }, null);
        expect(eventBus.on).not.toHaveBeenCalled();
    });

    it('destroy calls off with the SAME handler reference used in on (no leak)', () => {
        const handlerRef = [];
        const capturingBus = {
            on: vi.fn((event, handler) => {
                if (event === Events.UI.ZoomPercent) handlerRef[0] = handler;
            }),
            off: vi.fn((event, handler) => {
                expect(handler).toBe(handlerRef[0]);
            }),
        };

        const frame = new FrameObject({ width: 100, height: 100 }, capturingBus);
        expect(capturingBus.on).toHaveBeenCalledWith(Events.UI.ZoomPercent, expect.any(Function));

        frame.destroy();
        expect(capturingBus.off).toHaveBeenCalledWith(Events.UI.ZoomPercent, handlerRef[0]);
    });

    it('after destroy, ZoomPercent emit does not call handler (handler was removed)', () => {
        const frame = new FrameObject({ width: 100, height: 100 }, eventBus);
        const handlerCalls = [];
        eventBus.emit = vi.fn((event, data) => {
            if (event === Events.UI.ZoomPercent) {
                eventBus._handlers.forEach((h) => {
                    try {
                        h(data);
                        handlerCalls.push('called');
                    } catch (_) {}
                });
            }
        });

        eventBus.emit(Events.UI.ZoomPercent, { percentage: 100 });
        expect(handlerCalls.length).toBeGreaterThan(0);

        frame.destroy();
        handlerCalls.length = 0;
        eventBus.emit(Events.UI.ZoomPercent, { percentage: 150 });
        expect(handlerCalls.length).toBe(0);
    });

    it('destroy without eventBus does not throw', () => {
        const frame = new FrameObject({ width: 100, height: 100 }, null);
        expect(() => frame.destroy()).not.toThrow();
    });
});
