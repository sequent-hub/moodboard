import { describe, it, expect } from 'vitest';
import { RotateController } from '../../src/tools/object-tools/selection/RotateController.js';

/**
 * Диагностические тесты RotateController.
 *
 * Что фиксируем:
 * - корректный стартовый угол от EventBus/getter;
 * - snap угла к шагу 15° при зажатом Shift;
 * - корректный финальный payload rotate:end.
 */
describe('RotateController coordinate behavior', () => {
    it('start uses current object rotation and center-based mouse angle', () => {
        const emitted = [];
        const ctrl = new RotateController({
            emit: (event, payload) => {
                emitted.push({ event, payload });
                if (event === 'get:object:rotation') {
                    payload.rotation = 30;
                }
            },
        });

        ctrl.start('obj-1', { x: 20, y: 10 }, { x: 10, y: 10 });

        // Начальный угол мыши относительно центра = atan2(0, 10) = 0.
        expect(ctrl.rotateStartAngle).toBe(30);
        expect(ctrl.rotateStartMouseAngle).toBeCloseTo(0, 8);
        expect(emitted).toContainEqual({
            event: 'rotate:start',
            payload: { object: 'obj-1' },
        });
    });

    it('update snaps angle to 15° increments when Shift is pressed', () => {
        const emitted = [];
        const ctrl = new RotateController({
            emit: (event, payload) => {
                emitted.push({ event, payload });
                if (event === 'get:object:rotation') payload.rotation = 0;
            },
        });

        // Старт: курсор справа от центра -> 0°.
        ctrl.start('obj-1', { x: 10, y: 0 }, { x: 0, y: 0 });

        // Текущий угол ~22° (tan ~= 0.404), со Shift должен округлиться до 15°.
        ctrl.update({
            x: 10,
            y: 4.04,
            originalEvent: { shiftKey: true },
        });

        const upd = emitted.find((x) => x.event === 'rotate:update');
        expect(upd).toBeTruthy();
        expect(upd.payload.object).toBe('obj-1');
        expect(upd.payload.angle).toBe(15);
    });

    it('end emits rotate:end with old/new angles', () => {
        const emitted = [];
        const ctrl = new RotateController({
            emit: (event, payload) => {
                emitted.push({ event, payload });
                if (event === 'get:object:rotation') payload.rotation = 45;
            },
        });

        ctrl.start('obj-1', { x: 10, y: 0 }, { x: 0, y: 0 });
        ctrl.update({ x: 0, y: 10, originalEvent: {} }); // +90° -> итог 135°
        ctrl.end();

        const endEvt = emitted.find((x) => x.event === 'rotate:end');
        expect(endEvt).toBeTruthy();
        expect(endEvt.payload.object).toBe('obj-1');
        expect(endEvt.payload.oldAngle).toBe(45);
        expect(endEvt.payload.newAngle).toBeCloseTo(135, 8);
    });
});

