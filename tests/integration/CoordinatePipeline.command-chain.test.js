import { describe, it, expect, vi } from 'vitest';
import { MoveObjectCommand } from '../../src/core/commands/MoveObjectCommand.js';
import { ResizeObjectCommand } from '../../src/core/commands/ResizeObjectCommand.js';
import { RotateObjectCommand } from '../../src/core/commands/RotateObjectCommand.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Интеграционный тест цепочки трансформаций.
 *
 * Проверяем последовательность:
 * move -> resize -> rotate -> undo rotate -> undo resize -> undo move
 *
 * Цель:
 * - убедиться, что координатная модель не "плывет" при комбинированных операциях;
 * - зафиксировать возврат в исходное состояние после полного undo-цикла.
 */
describe('Coordinate pipeline command chain', () => {
    it('full transform chain returns object to initial state after undo sequence', () => {
        const emitted = [];

        const obj = {
            id: 'o1',
            type: 'shape',
            width: 100,
            height: 50,
            position: { x: 10, y: 20 },
            transform: { rotation: 0 },
        };
        const pixiObj = { x: 60, y: 45, width: 100, height: 50 };

        const core = {
            state: {
                state: { objects: [obj] },
                markDirty: vi.fn(),
            },
            pixi: {
                objects: new Map([['o1', pixiObj]]),
                updateObjectSize: vi.fn((id, size) => {
                    const p = core.pixi.objects.get(id);
                    p.width = size.width;
                    p.height = size.height;
                }),
                updateObjectRotation: vi.fn((id, angleDeg) => {
                    const p = core.pixi.objects.get(id);
                    p.rotation = angleDeg * Math.PI / 180;
                }),
            },
            updateObjectPositionDirect: vi.fn((id, position) => {
                const p = core.pixi.objects.get(id);
                const halfW = (p.width || 0) / 2;
                const halfH = (p.height || 0) / 2;
                p.x = position.x + halfW;
                p.y = position.y + halfH;
                const st = core.state.state.objects.find((x) => x.id === id);
                st.position = { ...position };
            }),
            toolManager: null,
        };

        const eventBus = {
            emit: vi.fn((event, payload) => {
                emitted.push({ event, payload });
                if (event === Events.Object.Rotate) {
                    core.pixi.updateObjectRotation(payload.objectId, payload.angle);
                }
            }),
        };

        const move = new MoveObjectCommand(core, 'o1', { x: 10, y: 20 }, { x: 30, y: 40 });
        const resize = new ResizeObjectCommand(
            core,
            'o1',
            { width: 100, height: 50 },
            { width: 140, height: 90 },
            { x: 30, y: 40 },
            { x: 35, y: 45 }
        );
        const rotate = new RotateObjectCommand(core, 'o1', 0, 45);

        move.setEventBus(eventBus);
        resize.setEventBus(eventBus);
        rotate.setEventBus(eventBus);

        // Прямой ход
        move.execute();
        resize.execute();
        rotate.execute();

        expect(obj.position).toEqual({ x: 35, y: 45 });
        expect(obj.width).toBe(140);
        expect(obj.height).toBe(90);
        expect(obj.transform.rotation).toBe(45);

        // Обратный ход
        rotate.undo();
        resize.undo();
        move.undo();

        expect(obj.position).toEqual({ x: 10, y: 20 });
        expect(obj.width).toBe(100);
        expect(obj.height).toBe(50);
        expect(obj.transform.rotation).toBe(0);

        // Центр PIXI тоже должен вернуться в исходное значение:
        // x = 10 + 100/2 = 60, y = 20 + 50/2 = 45
        expect(pixiObj.x).toBe(60);
        expect(pixiObj.y).toBe(45);
    });
});

