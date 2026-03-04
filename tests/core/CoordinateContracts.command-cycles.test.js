import { describe, it, expect, vi } from 'vitest';
import { GroupMoveCommand } from '../../src/core/commands/GroupMoveCommand.js';
import { GroupRotateCommand } from '../../src/core/commands/GroupRotateCommand.js';
import { ResizeObjectCommand } from '../../src/core/commands/ResizeObjectCommand.js';

/**
 * Тесты стабильности циклов execute/undo/execute.
 *
 * Цель:
 * - убедиться, что команды не меняют координатный формат от цикла к циклу;
 * - ловить потенциальный "дрейф" в истории трансформаций.
 */
describe('Coordinate command cycles', () => {
    it('GroupMoveCommand keeps deterministic top-left conversions across execute/undo/execute', () => {
        // Для moves в center-координатах (coordinatesAreTopLeft=false)
        // каждый execute/undo должен давать предсказуемый top-left без накопления ошибки.
        const core = {
            pixi: {
                objects: new Map([
                    ['a', { width: 80, height: 40 }],
                ]),
            },
            updateObjectPositionDirect: vi.fn(),
        };

        const cmd = new GroupMoveCommand(
            core,
            [{ id: 'a', from: { x: 100, y: 100 }, to: { x: 220, y: 180 } }],
            false
        );
        cmd.setEventBus({ emit: vi.fn() });

        cmd.execute();
        cmd.undo();
        cmd.execute();

        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(1, 'a', { x: 180, y: 160 });
        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(2, 'a', { x: 60, y: 80 });
        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(3, 'a', { x: 180, y: 160 });
    });

    it('GroupRotateCommand uses the same payload coordinates on repeated cycles', () => {
        // Этот тест фиксирует контракт команды:
        // она не должна "нормализовывать" fromPos/toPos по-разному на каждом цикле.
        const core = {
            updateObjectRotationDirect: vi.fn(),
            updateObjectPositionDirect: vi.fn(),
        };

        const cmd = new GroupRotateCommand(core, [
            {
                id: 'a',
                fromAngle: 5,
                toAngle: 40,
                fromPos: { x: 100, y: 80 },
                toPos: { x: 160, y: 130 },
            },
        ]);
        cmd.setEventBus({ emit: vi.fn() });

        cmd.execute();
        cmd.undo();
        cmd.execute();

        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(1, 'a', { x: 160, y: 130 });
        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(2, 'a', { x: 100, y: 80 });
        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(3, 'a', { x: 160, y: 130 });
    });

    it('ResizeObjectCommand uses provided top-left with new size in execute/undo cycle', () => {
        // Ключевой координатный контракт ResizeObjectCommand:
        // при заданной позиции top-left в execute/undo центр PIXI
        // должен считаться от переданного размера текущего шага.
        const objState = { id: 'a', type: 'shape', width: 100, height: 50, position: { x: 10, y: 20 } };
        const pixiObj = { x: 60, y: 45 };

        const core = {
            state: {
                state: { objects: [objState] },
                markDirty: vi.fn(),
            },
            pixi: {
                objects: new Map([['a', pixiObj]]),
                updateObjectSize: vi.fn(),
            },
            toolManager: null,
        };

        const cmd = new ResizeObjectCommand(
            core,
            'a',
            { width: 100, height: 50 },
            { width: 140, height: 90 },
            { x: 10, y: 20 },
            { x: 30, y: 40 }
        );
        cmd.setEventBus({ emit: vi.fn() });

        cmd.execute();
        expect(pixiObj.x).toBe(30 + 70);
        expect(pixiObj.y).toBe(40 + 45);

        cmd.undo();
        expect(pixiObj.x).toBe(10 + 50);
        expect(pixiObj.y).toBe(20 + 25);
    });
});

