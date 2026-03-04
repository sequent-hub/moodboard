import { describe, it, expect, vi } from 'vitest';
import { GroupDragController } from '../../src/tools/object-tools/selection/GroupDragController.js';

/**
 * Диагностические тесты GroupDragController.
 *
 * Цель:
 * - проверить вычисление groupDragOffset на старте;
 * - проверить расчет delta в update;
 * - проверить контракт Alt-клонирования (group:duplicate:request).
 */
describe('GroupDragController coordinate behavior', () => {
    function createController() {
        const emitted = [];
        const ctrl = new GroupDragController({
            emit: (event, payload) => emitted.push({ event, payload }),
            selection: { toArray: () => ['a', 'b'] },
            updateGroupBoundsByTopLeft: vi.fn(),
        });
        return { ctrl, emitted };
    }

    it('start computes drag offset from mouse and group top-left', () => {
        const { ctrl } = createController();
        ctrl.start({ x: 100, y: 50, width: 200, height: 100 }, { x: 130, y: 90 });

        expect(ctrl.groupDragOffset).toEqual({ x: 30, y: 40 });
        expect(ctrl.isActive).toBe(true);
    });

    it('update emits group:drag:update with delta from initial bounds', () => {
        // Проверяем основной контракт:
        // delta всегда считается относительно стартовых bounds группы.
        const { ctrl, emitted } = createController();
        ctrl.start({ x: 100, y: 50, width: 200, height: 100 }, { x: 130, y: 90 });
        ctrl.update({ x: 230, y: 190, originalEvent: {} });

        const upd = emitted.find((e) => e.event === 'group:drag:update');
        expect(upd).toBeTruthy();
        // newTopLeft = (230-30, 190-40) = (200, 150)
        // delta = (200-100, 150-50) = (100, 100)
        expect(upd.payload).toEqual({
            objects: ['a', 'b'],
            delta: { dx: 100, dy: 100 },
        });
    });

    it('Alt key triggers one duplicate request and does not emit drag:update in same tick', () => {
        // Диагностический контракт:
        // при первом Alt в update отправляется запрос на клон и текущий update прерывается.
        const { ctrl, emitted } = createController();
        ctrl.start({ x: 100, y: 50, width: 200, height: 100 }, { x: 130, y: 90 });
        ctrl.update({ x: 150, y: 100, originalEvent: { altKey: true } });

        const duplicateEvt = emitted.find((e) => e.event === 'group:duplicate:request');
        const dragUpdEvt = emitted.find((e) => e.event === 'group:drag:update');
        expect(duplicateEvt).toBeTruthy();
        expect(duplicateEvt.payload).toEqual({ objects: ['a', 'b'] });
        expect(dragUpdEvt).toBeUndefined();
    });
});

