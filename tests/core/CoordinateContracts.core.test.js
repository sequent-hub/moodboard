import { describe, it, expect, vi } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';

/**
 * Этот файл проверяет базовый контракт координат внутри CoreMoodBoard:
 * - в state позиция хранится как левый верх;
 * - в PIXI позиция хранится как центр объекта (при pivot/anchor в центре).
 *
 * Эти проверки нужны как "якорь" перед более сложными тестами
 * (resize/rotate/group), чтобы однозначно понимать, где именно появляется
 * погрешность: в самом преобразовании координат или в последующих шагах.
 */
function createCoreLikeContext() {
    const objects = [];
    return {
        pixi: {
            objects: new Map(),
            updateObjectSize: vi.fn(),
        },
        state: {
            state: { objects },
            markDirty: vi.fn(),
            getObjects: () => objects,
        },
    };
}

describe('CoreMoodBoard coordinate contracts', () => {
    it('updateObjectPositionDirect translates top-left to PIXI center', () => {
        // Сценарий:
        // Передаем координаты левого верхнего угла (state-координаты)
        // и ожидаем, что в PIXI запишется центр:
        // centerX = left + width/2, centerY = top + height/2.
        //
        // Если этот контракт нарушен, дальше "поплывут" drag/resize/rotate,
        // потому что разные подсистемы начнут работать в разных системах координат.
        const ctx = createCoreLikeContext();
        const pixiObject = { x: 0, y: 0, width: 200, height: 80 };
        ctx.pixi.objects.set('obj-1', pixiObject);
        ctx.state.state.objects.push({ id: 'obj-1', position: { x: 0, y: 0 } });

        CoreMoodBoard.prototype.updateObjectPositionDirect.call(ctx, 'obj-1', { x: 100, y: 50 });

        expect(pixiObject.x).toBe(200);
        expect(pixiObject.y).toBe(90);
        expect(ctx.state.state.objects[0].position).toEqual({ x: 100, y: 50 });
        expect(ctx.state.markDirty).toHaveBeenCalled();
    });

    it('updateObjectSizeAndPositionDirect keeps previous center when position is not passed', () => {
        // Сценарий:
        // Во время resize иногда передается только размер без новой позиции.
        // В этом случае код должен сохранить прежний центр в PIXI,
        // чтобы не возникал визуальный дрейф объекта.
        //
        // Проверяем, что:
        // 1) размер обновился;
        // 2) центр (x/y в PIXI) остался прежним.
        const ctx = createCoreLikeContext();
        const pixiObject = { x: 220, y: 180, width: 120, height: 60 };
        ctx.pixi.objects.set('obj-2', pixiObject);
        ctx.state.state.objects.push({
            id: 'obj-2',
            width: 120,
            height: 60,
            position: { x: 160, y: 150 },
        });

        CoreMoodBoard.prototype.updateObjectSizeAndPositionDirect.call(
            ctx,
            'obj-2',
            { width: 200, height: 100 },
            null,
            'shape'
        );

        expect(ctx.pixi.updateObjectSize).toHaveBeenCalledWith('obj-2', { width: 200, height: 100 }, 'shape');
        expect(pixiObject.x).toBe(220);
        expect(pixiObject.y).toBe(180);
        expect(ctx.state.state.objects[0].width).toBe(200);
        expect(ctx.state.state.objects[0].height).toBe(100);
    });
});

