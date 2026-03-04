import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Контрактный тест завершения группового resize в HtmlHandlesLayer.
 *
 * Проверяем, что:
 * - на старте есть GroupResizeStart;
 * - на завершении эмитится GroupResizeEnd с актуальным списком выбранных объектов.
 */
describe('HtmlHandlesLayer GroupResizeEnd contract', () => {
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

    it('emits GroupResizeStart and GroupResizeEnd with selected object ids', () => {
        const emitted = [];
        const container = document.createElement('div');
        container.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });

        const eventBus = {
            emit: vi.fn((event, payload) => {
                emitted.push({ event, payload });
                if (event === Events.Tool.GetSelection) {
                    payload.selection = ['a', 'b', 'c'];
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

        const box = document.createElement('div');
        box.style.left = '100px';
        box.style.top = '100px';
        box.style.width = '300px';
        box.style.height = '200px';

        const handle = document.createElement('div');
        handle.dataset.dir = 'se';
        handle.dataset.id = '__group__';

        layer._onHandleDown(
            {
                currentTarget: handle,
                clientX: 400,
                clientY: 300,
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            },
            box
        );

        listeners.mousemove({ clientX: 450, clientY: 330 });
        listeners.mouseup();

        const startEvt = emitted.find((x) => x.event === Events.Tool.GroupResizeStart);
        const endEvt = emitted.find((x) => x.event === Events.Tool.GroupResizeEnd);

        expect(startEvt).toBeTruthy();
        expect(startEvt.payload.objects).toEqual(['a', 'b', 'c']);
        expect(endEvt).toBeTruthy();
        expect(endEvt.payload.objects).toEqual(['a', 'b', 'c']);
    });
});

