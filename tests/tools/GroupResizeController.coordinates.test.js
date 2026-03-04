import { describe, it, expect, vi } from 'vitest';
import { GroupResizeController } from '../../src/tools/object-tools/selection/GroupResizeController.js';

/**
 * Диагностические тесты группового ресайза на уровне контроллера.
 *
 * Зачем:
 * - контроллер формирует `newBounds` и `scale`, которые далее потребляет core;
 * - ошибки на этом уровне дают систематические погрешности во всех групповых resize.
 */
describe('GroupResizeController coordinate flow', () => {
    function createController() {
        const emitted = [];
        const selection = { toArray: () => ['a', 'b'] };
        const ctrl = new GroupResizeController({
            emit: (event, payload) => emitted.push({ event, payload }),
            selection,
            getGroupBounds: () => ({ x: 100, y: 50, width: 200, height: 100 }),
            ensureGroupGraphics: vi.fn(),
            updateGroupGraphics: vi.fn(),
        });
        return { ctrl, emitted };
    }

    it('start emits group:resize:start with initial bounds and selected ids', () => {
        // Проверяем стартовый контракт:
        // в событии должны быть и объекты, и исходные границы.
        const { ctrl, emitted } = createController();
        ctrl.start('se', { x: 300, y: 150 });

        expect(emitted[0]).toEqual({
            event: 'group:resize:start',
            payload: {
                objects: ['a', 'b'],
                startBounds: { x: 100, y: 50, width: 200, height: 100 },
                handle: 'se',
            },
        });
    });

    it('update for east handle changes only width and scale.x', () => {
        // Для ручки "e":
        // - x/y/height остаются исходными,
        // - width меняется по deltaX.
        const { ctrl, emitted } = createController();
        ctrl.start('e', { x: 300, y: 100 });
        ctrl.update({ x: 350, y: 130, originalEvent: {} });

        const update = emitted.find((e) => e.event === 'group:resize:update');
        expect(update.payload.newBounds).toEqual({ x: 100, y: 50, width: 250, height: 100 });
        expect(update.payload.scale).toEqual({ x: 1.25, y: 1 });
    });

    it('update clamps to minimum size for west handle', () => {
        // Диагностический минимум:
        // при сильном "сжатии" ширина должна зажиматься не меньше minW (20).
        const { ctrl, emitted } = createController();
        ctrl.start('w', { x: 100, y: 80 });
        ctrl.update({ x: 1000, y: 80, originalEvent: {} });

        const update = emitted.find((e) => e.event === 'group:resize:update');
        expect(update.payload.newBounds.width).toBe(20);
        expect(update.payload.scale.x).toBeCloseTo(0.1, 8);
    });
});

