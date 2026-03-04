import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Тесты финального payload для ResizeEnd в HtmlHandlesLayer.
 *
 * Цель:
 * - подтвердить, что на завершении resize передаются old/new size и old/new position;
 * - зафиксировать разницу поведения для правой и левой ручки.
 */
describe('HtmlHandlesLayer ResizeEnd payload contracts', () => {
    let listeners;
    let addSpy;
    let removeSpy;

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

    function setup() {
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
                    view: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
                },
            },
        };

        const layer = new HtmlHandlesLayer(container, eventBus, core);
        return { layer, emitted };
    }

    it('east handle keeps top-left in ResizeEnd newPosition', () => {
        // Ручка "e" растягивает вправо, поэтому left/top должны остаться прежними.
        const { layer, emitted } = setup();
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
                clientY: 100,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            },
            box
        );

        listeners.mousemove({ clientX: 360, clientY: 100 });
        listeners.mouseup();

        const endEvt = emitted.find((x) => x.event === Events.Tool.ResizeEnd);
        expect(endEvt).toBeTruthy();
        expect(endEvt.payload.oldSize).toEqual({ width: 200, height: 100 });
        expect(endEvt.payload.newSize).toEqual({ width: 260, height: 100 });
        expect(endEvt.payload.oldPosition).toEqual({ x: 100, y: 100 });
        expect(endEvt.payload.newPosition).toEqual({ x: 100, y: 100 });
    });

    it('west handle updates top-left in ResizeEnd newPosition', () => {
        // Ручка "w" двигает левую грань, значит newPosition.x должен измениться.
        const { layer, emitted } = setup();
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
                clientY: 100,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            },
            box
        );

        listeners.mousemove({ clientX: 160, clientY: 100 });
        listeners.mouseup();

        const endEvt = emitted.find((x) => x.event === Events.Tool.ResizeEnd);
        expect(endEvt).toBeTruthy();
        expect(endEvt.payload.oldSize).toEqual({ width: 200, height: 100 });
        expect(endEvt.payload.newSize).toEqual({ width: 140, height: 100 });
        expect(endEvt.payload.oldPosition).toEqual({ x: 100, y: 100 });
        expect(endEvt.payload.newPosition).toEqual({ x: 160, y: 100 });
    });
});

