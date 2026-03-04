import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Матрица scale/resolution для CSS->world преобразования в HtmlHandlesLayer.
 *
 * Формула в коде:
 * world = (screen * resolution - worldOffset) / scale
 *
 * Здесь проверяем, что payload ResizeUpdate соответствует этой формуле
 * в нескольких типовых комбинациях scale/resolution.
 */
describe('HtmlHandlesLayer scale-resolution conversion matrix', () => {
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

    function runCase(scale, resolution) {
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
                worldLayer: { scale: { x: scale }, x: 0, y: 0 },
                app: {
                    renderer: { resolution },
                    view: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
                },
            },
        };

        const layer = new HtmlHandlesLayer(container, eventBus, core);
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

        // +50px по ширине в CSS
        listeners.mousemove({ clientX: 350, clientY: 100 });
        return emitted.find((x) => x.event === Events.Tool.ResizeUpdate)?.payload;
    }

    it('case s=1, res=1', () => {
        const payload = runCase(1, 1);
        expect(payload.size).toEqual({ width: 250, height: 100 });
        expect(payload.position).toEqual({ x: 100, y: 100 });
    });

    it('case s=2, res=1', () => {
        const payload = runCase(2, 1);
        expect(payload.size).toEqual({ width: 125, height: 50 });
        expect(payload.position).toEqual({ x: 50, y: 50 });
    });

    it('case s=1, res=2', () => {
        const payload = runCase(1, 2);
        expect(payload.size).toEqual({ width: 500, height: 200 });
        expect(payload.position).toEqual({ x: 200, y: 200 });
    });

    it('case s=2, res=2', () => {
        const payload = runCase(2, 2);
        expect(payload.size).toEqual({ width: 250, height: 100 });
        expect(payload.position).toEqual({ x: 100, y: 100 });
    });
});

