import { describe, it, expect, vi } from 'vitest';
import { MoveObjectCommand } from '../../src/core/commands/MoveObjectCommand.js';
import { GroupMoveCommand } from '../../src/core/commands/GroupMoveCommand.js';

/**
 * Регрессионный тест: команды перемещения не должны повторно применять
 * привязку к сетке при выполнении. Объект должен остаться ровно там,
 * где его отпустили (позиция из DragEnd), без диагонального смещения.
 */

function createCoreLike(objectId, pixiObject, statePosition) {
    const objects = [{ id: objectId, position: { ...statePosition } }];
    // Снап со сдвигом +7,+7 — если бы сработал, это было бы заметно
    const snapOffset = 7;
    const gridSnapResolver = {
        snapWorldTopLeft: vi.fn((pos) => ({
            x: pos.x + snapOffset,
            y: pos.y + snapOffset,
        })),
    };
    const boardService = { grid: { enabled: true, snapEnabled: true } };
    return {
        pixi: {
            objects: new Map([[objectId, pixiObject]]),
            updateObjectSize: vi.fn(),
        },
        state: {
            state: { objects },
            markDirty: vi.fn(),
        },
        gridSnapResolver,
        boardService,
        // updateObjectPositionDirect — реальный метод из CoreMoodBoard
        updateObjectPositionDirect: null,
    };
}

// Подключаем реальный метод из ядра
import { CoreMoodBoard } from '../../src/core/index.js';

describe('MoveObjectCommand — snap не применяется при execute()', () => {
    it('execute() не изменяет newPosition через снап', () => {
        const pixiObject = { x: 150, y: 100, width: 100, height: 60 };
        const ctx = createCoreLike('obj-1', pixiObject, { x: 100, y: 70 });
        ctx.updateObjectPositionDirect = CoreMoodBoard.prototype.updateObjectPositionDirect.bind(ctx);

        const oldPos = { x: 50, y: 30 };
        const newPos = { x: 100, y: 70 };

        const cmd = new MoveObjectCommand(ctx, 'obj-1', oldPos, newPos);
        cmd.execute();

        // Позиция в state должна быть ровно newPos, без сдвига +7,+7
        expect(ctx.state.state.objects[0].position).toEqual(newPos);
        // gridSnapResolver.snapWorldTopLeft не должен вызываться
        expect(ctx.gridSnapResolver.snapWorldTopLeft).not.toHaveBeenCalled();
    });
});

describe('GroupMoveCommand — snap не применяется при execute()', () => {
    it('coordinatesAreTopLeft=true: execute() не изменяет to через снап', () => {
        const pixiObject = { x: 200, y: 150, width: 80, height: 40 };
        const ctx = createCoreLike('obj-2', pixiObject, { x: 160, y: 130 });
        ctx.updateObjectPositionDirect = CoreMoodBoard.prototype.updateObjectPositionDirect.bind(ctx);

        const toPos = { x: 160, y: 130 };
        const cmd = new GroupMoveCommand(ctx, [{ id: 'obj-2', from: { x: 100, y: 90 }, to: toPos }], true);
        cmd.execute();

        expect(ctx.state.state.objects[0].position).toEqual(toPos);
        expect(ctx.gridSnapResolver.snapWorldTopLeft).not.toHaveBeenCalled();
    });

    it('coordinatesAreTopLeft=false: execute() не изменяет позицию через снап', () => {
        const pixiObject = { x: 200, y: 150, width: 80, height: 40 };
        const ctx = createCoreLike('obj-3', pixiObject, { x: 160, y: 130 });
        ctx.updateObjectPositionDirect = CoreMoodBoard.prototype.updateObjectPositionDirect.bind(ctx);

        // Центры PIXI: to — это center, команда сама вычитает halfW/halfH
        const centerTo = { x: 200, y: 150 };
        const cmd = new GroupMoveCommand(ctx, [{ id: 'obj-3', from: { x: 120, y: 100 }, to: centerTo }], false);
        cmd.execute();

        // topLeft = center - half = 200 - 40, 150 - 20
        const expectedTopLeft = { x: 160, y: 130 };
        expect(ctx.state.state.objects[0].position).toEqual(expectedTopLeft);
        expect(ctx.gridSnapResolver.snapWorldTopLeft).not.toHaveBeenCalled();
    });
});
