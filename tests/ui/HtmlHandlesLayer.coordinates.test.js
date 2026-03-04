import { describe, it, expect, vi } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Диагностические тесты координатного контракта HtmlHandlesLayer.
 *
 * Важный сценарий: групповой rotate.
 * Core-поток поворота группы использует центр вращения, поэтому
 * стартовый payload должен содержать center в world-координатах.
 */
describe('HtmlHandlesLayer group rotate payload contract', () => {
    it('GroupRotateStart payload should include center for group rotation pipeline', () => {
        const emitted = [];
        const eventBus = {
            emit: vi.fn((event, payload) => {
                emitted.push({ event, payload });
                if (event === Events.Tool.GetSelection) {
                    payload.selection = ['a', 'b'];
                }
            }),
        };

        const layer = new HtmlHandlesLayer(document.createElement('div'), eventBus, null);

        const box = document.createElement('div');
        box.style.left = '100px';
        box.style.top = '200px';
        box.style.width = '300px';
        box.style.height = '100px';

        const rotateHandle = document.createElement('div');
        rotateHandle.dataset.id = '__group__';

        const event = {
            currentTarget: rotateHandle,
            clientX: 250,
            clientY: 260,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };

        layer._onRotateHandleDown(event, box);

        const startEvent = emitted.find((x) => x.event === Events.Tool.GroupRotateStart);
        expect(startEvent).toBeTruthy();

        // Контрактный чек:
        // центр обязателен, иначе downstream в core использует fallback {0,0},
        // что может давать некорректную геометрию поворота.
        expect(startEvent.payload).toEqual(
            expect.objectContaining({
                objects: ['a', 'b'],
                center: expect.any(Object),
            })
        );
    });
});

