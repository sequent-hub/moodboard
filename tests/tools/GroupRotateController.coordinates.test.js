import { describe, it, expect, vi } from 'vitest';
import { GroupRotateController } from '../../src/tools/object-tools/selection/GroupRotateController.js';

/**
 * Диагностические тесты GroupRotateController.
 *
 * Проверяем:
 * - вычисление центра группы от bounds;
 * - передачу center/angle в update/end payload;
 * - snap по 15° при Shift.
 */
describe('GroupRotateController coordinate behavior', () => {
    function createCtrl() {
        const emitted = [];
        const updateHandles = vi.fn();
        const ctrl = new GroupRotateController({
            emit: (event, payload) => emitted.push({ event, payload }),
            selection: { toArray: () => ['a', 'b'] },
            getGroupBounds: () => ({ x: 100, y: 50, width: 200, height: 100 }),
            ensureGroupGraphics: vi.fn(),
            updateHandles,
        });
        return { ctrl, emitted, updateHandles };
    }

    it('start emits group:rotate:start with computed center', () => {
        const { ctrl, emitted } = createCtrl();
        ctrl.start({ x: 300, y: 100 });

        // Центр bounds: (200, 100)
        expect(ctrl.center).toEqual({ x: 200, y: 100 });
        expect(emitted[0]).toEqual({
            event: 'group:rotate:start',
            payload: { objects: ['a', 'b'], center: { x: 200, y: 100 } },
        });
    });

    it('update emits snapped angle with Shift and includes center', () => {
        const { ctrl, emitted, updateHandles } = createCtrl();
        ctrl.start({ x: 300, y: 100 }); // стартовый угол 0°

        // Целевой угол ~22°, при Shift ожидаем snap до 15°.
        ctrl.update({
            x: 300,
            y: 140.4,
            originalEvent: { shiftKey: true },
        });

        const upd = emitted.find((x) => x.event === 'group:rotate:update');
        expect(upd).toBeTruthy();
        expect(upd.payload.objects).toEqual(['a', 'b']);
        expect(upd.payload.center).toEqual({ x: 200, y: 100 });
        expect(upd.payload.angle).toBe(15);
        expect(updateHandles).toHaveBeenCalled();
    });

    it('end emits group:rotate:end with last computed angle', () => {
        const { ctrl, emitted } = createCtrl();
        ctrl.start({ x: 300, y: 100 });
        ctrl.update({ x: 200, y: 200, originalEvent: {} }); // около 90°
        ctrl.end();

        const endEvt = emitted.find((x) => x.event === 'group:rotate:end');
        expect(endEvt).toBeTruthy();
        expect(endEvt.payload.objects).toEqual(['a', 'b']);
        expect(endEvt.payload.angle).toBeCloseTo(90, 6);
    });
});

