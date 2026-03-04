import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Диагностика payload для resize в HtmlHandlesLayer (_onHandleDown).
 *
 * Проверяем ключевой контракт:
 * - для правой ручки (`e`) позиция должна оставаться стартовой;
 * - для левой ручки (`w`) позиция должна смещаться вместе с левым краем.
 */
describe('HtmlHandlesLayer resize payload contracts', () => {
    let addSpy;
    let removeSpy;
    let listeners;

    beforeEach(() => {
        listeners = {};
        addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((name, fn) => {
            listeners[name] = fn;
        });
        removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});
    });

    afterEach(() => {
        addSpy.mockRestore();
        removeSpy.mockRestore();
        vi.restoreAllMocks();
    });

    function createLayerAndDeps() {
        const emitted = [];
        const container = document.createElement('div');
        container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });

        const eventBus = {
            emit: vi.fn((event, payload) => {
                emitted.push({ event, payload });
                if (event === Events.Tool.GetObjectPixi) {
                    payload.pixiObject = { _mb: { type: 'shape' } };
                }
            }),
        };

        const core = {
            pixi: {
                worldLayer: { scale: { x: 1 }, x: 0, y: 0 },
                app: {
                    renderer: { resolution: 1 },
                    view: {
                        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
                    },
                },
            },
        };

        const layer = new HtmlHandlesLayer(container, eventBus, core);
        return { layer, emitted };
    }

    it('east handle keeps start position in ResizeUpdate payload', () => {
        const { layer, emitted } = createLayerAndDeps();
        const box = document.createElement('div');
        box.style.left = '100px';
        box.style.top = '100px';
        box.style.width = '200px';
        box.style.height = '100px';

        const handle = document.createElement('div');
        handle.dataset.dir = 'e';
        handle.dataset.id = 'obj-1';

        layer._onHandleDown(
            {
                currentTarget: handle,
                clientX: 300,
                clientY: 120,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            },
            box
        );

        listeners.mousemove({ clientX: 350, clientY: 120 });

        const update = emitted.find((x) => x.event === Events.Tool.ResizeUpdate);
        expect(update).toBeTruthy();
        expect(update.payload.object).toBe('obj-1');
        expect(update.payload.size).toEqual({ width: 250, height: 100 });
        expect(update.payload.position).toEqual({ x: 100, y: 100 });
    });

    it('west handle shifts x-position in ResizeUpdate payload', () => {
        const { layer, emitted } = createLayerAndDeps();
        const box = document.createElement('div');
        box.style.left = '100px';
        box.style.top = '100px';
        box.style.width = '200px';
        box.style.height = '100px';

        const handle = document.createElement('div');
        handle.dataset.dir = 'w';
        handle.dataset.id = 'obj-1';

        layer._onHandleDown(
            {
                currentTarget: handle,
                clientX: 100,
                clientY: 120,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            },
            box
        );

        listeners.mousemove({ clientX: 150, clientY: 120 });

        const update = emitted.find((x) => x.event === Events.Tool.ResizeUpdate);
        expect(update).toBeTruthy();
        expect(update.payload.object).toBe('obj-1');
        expect(update.payload.size).toEqual({ width: 150, height: 100 });
        expect(update.payload.position).toEqual({ x: 150, y: 100 });
    });
});

