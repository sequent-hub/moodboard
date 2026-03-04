import { describe, it, expect, vi } from 'vitest';
import { HtmlTextLayer } from '../../src/ui/HtmlTextLayer.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Диагностические тесты координатных преобразований в HtmlTextLayer.
 *
 * Цель:
 * - зафиксировать, как HTML-высота переводится в world-высоту;
 * - проверить, что updateOne привязывает DOM-позицию к world через toGlobal
 *   и берет угол поворота из PIXI при наличии.
 */
describe('HtmlTextLayer coordinate behavior', () => {
    it('_autoFitTextHeight converts measured CSS height to world height and emits ResizeUpdate', () => {
        const container = document.createElement('div');
        const emitted = [];
        const eventBus = { on: vi.fn(), emit: vi.fn() };
        const core = {
            eventBus: {
                emit: vi.fn((event, payload) => emitted.push({ event, payload })),
            },
            pixi: {
                worldLayer: { scale: { x: 2 } },
                app: { renderer: { resolution: 1 } },
            },
            state: {
                state: {
                    objects: [
                        { id: 't1', width: 120, position: { x: 10, y: 20 } },
                    ],
                },
            },
        };

        const layer = new HtmlTextLayer(container, eventBus, core);
        const el = document.createElement('div');
        Object.defineProperty(el, 'scrollHeight', { value: 42, configurable: true });
        layer.idToEl.set('t1', el);

        layer._autoFitTextHeight('t1');

        const resizeEvt = emitted.find((x) => x.event === Events.Tool.ResizeUpdate);
        expect(resizeEvt).toBeTruthy();
        expect(resizeEvt.payload.object).toBe('t1');
        expect(resizeEvt.payload.size.width).toBe(120);
        expect(resizeEvt.payload.size.height).toBeCloseTo(21, 8);
        expect(resizeEvt.payload.position).toEqual({ x: 10, y: 20 });
    });

    it('updateOne maps world bounds to CSS position using toGlobal and applies PIXI rotation', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const eventBus = { on: vi.fn(), emit: vi.fn() };
        const core = {
            pixi: {
                worldLayer: {
                    scale: { x: 1 },
                    x: 0,
                    y: 0,
                    toGlobal: (p) => ({ x: p.x * 2 + 5, y: p.y * 3 + 7 }),
                },
                app: {
                    renderer: { resolution: 1 },
                    view: {
                        parentElement: {
                            getBoundingClientRect: () => ({ left: 0, top: 0 }),
                        },
                        getBoundingClientRect: () => ({ left: 0, top: 0 }),
                    },
                },
                objects: new Map([
                    ['t1', { rotation: Math.PI / 2 }],
                ]),
            },
            state: {
                state: {
                    objects: [
                        {
                            id: 't1',
                            type: 'text',
                            position: { x: 10, y: 20 },
                            width: 40,
                            height: 20,
                            properties: { content: 'abc', fontSize: 16 },
                        },
                    ],
                },
            },
        };

        const layer = new HtmlTextLayer(container, eventBus, core);
        layer.layer = document.createElement('div');
        const el = document.createElement('div');
        el.dataset.baseFontSize = '16';
        el.dataset.baseW = '40';
        el.dataset.baseH = '20';
        Object.defineProperty(el, 'scrollHeight', { value: 18, configurable: true });
        layer.idToEl.set('t1', el);
        layer.layer.appendChild(el);

        layer.updateOne('t1');

        expect(el.style.left).toBe('25px');
        expect(el.style.top).toBe('67px');
        expect(el.style.width).toBe('80px');
        expect(el.style.height).toBe('20px');
        expect(el.style.transform).toBe('rotate(90deg)');
    });
});

