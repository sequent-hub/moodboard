import { describe, it, expect, vi } from 'vitest';
import { GroupMoveCommand } from '../../src/core/commands/GroupMoveCommand.js';
import { GroupResizeCommand } from '../../src/core/commands/GroupResizeCommand.js';
import { GroupRotateCommand } from '../../src/core/commands/GroupRotateCommand.js';

/**
 * Этот файл фиксирует контракт координат в групповых командах undo/redo.
 *
 * В проекте есть риск смешения двух представлений:
 * - top-left (state),
 * - center (PIXI).
 *
 * Ниже мы проверяем, что команды применяют координаты именно в том виде,
 * в котором их ожидает ядро. Эти тесты важны для диагностики:
 * если тест падает, это сразу указывает на точку рассинхронизации
 * между интерактивной логикой и историей команд.
 */
describe('Group command coordinate contracts', () => {
    it('GroupMoveCommand converts center coordinates to top-left when coordinatesAreTopLeft=false', () => {
        // Сценарий "обычное групповое перемещение":
        // команда получает координаты центров объектов (PIXI),
        // а в core нужно отправить top-left.
        //
        // Для объекта 100x60:
        // topLeft.x = 220 - 50 = 170
        // topLeft.y = 190 - 30 = 160
        const core = {
            pixi: {
                objects: new Map([
                    ['a', { width: 100, height: 60 }],
                ]),
            },
            updateObjectPositionDirect: vi.fn(),
        };

        const cmd = new GroupMoveCommand(
            core,
            [{ id: 'a', from: { x: 120, y: 90 }, to: { x: 220, y: 190 } }],
            false
        );
        cmd.setEventBus({ emit: vi.fn() });

        cmd.execute();

        expect(core.updateObjectPositionDirect).toHaveBeenCalledWith('a', { x: 170, y: 160 });
    });

    it('GroupResizeCommand forwards toPos/fromPos as-is to updateObjectSizeAndPositionDirect', () => {
        // Сценарий "групповой resize":
        // команда должна передавать в core ровно те позиции/размеры,
        // которые ей передали при формировании changes.
        //
        // Этот тест помогает поймать скрытую нормализацию координат
        // внутри команды (если она вдруг появится и начнет менять данные).
        const core = {
            updateObjectSizeAndPositionDirect: vi.fn(),
        };

        const change = {
            id: 'a',
            fromSize: { width: 80, height: 40 },
            toSize: { width: 160, height: 80 },
            fromPos: { x: 10, y: 20 },
            toPos: { x: 30, y: 50 },
            type: 'shape',
        };

        const cmd = new GroupResizeCommand(core, [change]);
        cmd.setEventBus({ emit: vi.fn() });
        cmd.execute();
        cmd.undo();

        expect(core.updateObjectSizeAndPositionDirect).toHaveBeenNthCalledWith(
            1,
            'a',
            change.toSize,
            change.toPos,
            'shape'
        );
        expect(core.updateObjectSizeAndPositionDirect).toHaveBeenNthCalledWith(
            2,
            'a',
            change.fromSize,
            change.fromPos,
            'shape'
        );
    });

    it('GroupRotateCommand forwards positions directly to updateObjectPositionDirect', () => {
        // Сценарий "групповой поворот":
        // команда хранит угол + позицию для execute/undo.
        // Проверяем, что позиция прокидывается напрямую (без дополнительных
        // преобразований), иначе возможен накопительный дрейф после нескольких
        // undo/redo циклов.
        const core = {
            updateObjectRotationDirect: vi.fn(),
            updateObjectPositionDirect: vi.fn(),
        };

        const change = {
            id: 'a',
            fromAngle: 10,
            toAngle: 35,
            fromPos: { x: 100, y: 80 },
            toPos: { x: 140, y: 120 },
        };

        const cmd = new GroupRotateCommand(core, [change]);
        cmd.setEventBus({ emit: vi.fn() });
        cmd.execute();
        cmd.undo();

        expect(core.updateObjectRotationDirect).toHaveBeenNthCalledWith(1, 'a', 35);
        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(1, 'a', { x: 140, y: 120 });
        expect(core.updateObjectRotationDirect).toHaveBeenNthCalledWith(2, 'a', 10);
        expect(core.updateObjectPositionDirect).toHaveBeenNthCalledWith(2, 'a', { x: 100, y: 80 });
    });
});

