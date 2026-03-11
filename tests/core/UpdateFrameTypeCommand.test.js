/**
 * Unit-тесты команды UpdateFrameTypeCommand.
 * Проверяют execute, undo для смены типа фрейма (custom ↔ preset) с размером и позицией.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { UpdateFrameTypeCommand } from '../../src/core/commands/UpdateFrameTypeCommand.js';

function createMockCore(frameObject = null) {
    const objects = frameObject
        ? [frameObject]
        : [
              {
                  id: 'frame-1',
                  type: 'frame',
                  width: 200,
                  height: 280,
                  position: { x: 50, y: 80 },
                  properties: { type: 'custom', lockedAspect: false, title: 'Test' },
              },
          ];

    const pixiObject = {
        x: 150,
        y: 220,
        width: objects[0].width,
        height: objects[0].height,
    };

    const objectsMap = new Map();
    objectsMap.set('frame-1', pixiObject);

    const state = {
        getObjects: vi.fn(() => objects),
        markDirty: vi.fn(),
    };

    const eventBus = { emit: vi.fn() };

    const pixi = {
        objects: objectsMap,
        updateObjectSize: vi.fn(),
    };

    return {
        state,
        pixi,
        eventBus,
        getFrameObject: () => objects[0],
        getPixiObject: () => pixiObject,
    };
}

describe('UpdateFrameTypeCommand', () => {
    describe('execute', () => {
        it('применяет type и lockedAspect в properties (без resize)', () => {
            const core = createMockCore();
            const cmd = new UpdateFrameTypeCommand(
                core,
                'frame-1',
                'custom',
                'a4',
                null,
                null,
                null,
                null
            );

            cmd.execute();

            expect(core.getFrameObject().properties.type).toBe('a4');
            expect(core.getFrameObject().properties.lockedAspect).toBe(true);
            expect(core.state.markDirty).toHaveBeenCalled();
            expect(core.eventBus.emit).toHaveBeenCalledWith(
                Events.Object.StateChanged,
                expect.objectContaining({
                    objectId: 'frame-1',
                    updates: { properties: { type: 'a4', lockedAspect: true } },
                })
            );
        });

        it('применяет type + size + position при смене preset', () => {
            const core = createMockCore();
            const oldSize = { width: 200, height: 280 };
            const newSize = { width: 210, height: 297 };
            const oldPos = { x: 50, y: 80 };
            const newPos = { x: 45, y: 75 };

            const cmd = new UpdateFrameTypeCommand(
                core,
                'frame-1',
                'custom',
                'a4',
                oldSize,
                newSize,
                oldPos,
                newPos
            );

            cmd.execute();

            expect(core.getFrameObject().properties.type).toBe('a4');
            expect(core.getFrameObject().properties.lockedAspect).toBe(true);
            expect(core.getFrameObject().width).toBe(210);
            expect(core.getFrameObject().height).toBe(297);
            expect(core.getFrameObject().position).toEqual({ x: 45, y: 75 });
            expect(core.pixi.updateObjectSize).toHaveBeenCalledWith('frame-1', newSize, 'frame');
        });
    });

    describe('undo', () => {
        it('восстанавливает type и lockedAspect при undo (без resize)', () => {
            const core = createMockCore();
            const cmd = new UpdateFrameTypeCommand(
                core,
                'frame-1',
                'custom',
                'a4',
                null,
                null,
                null,
                null
            );

            cmd.execute();
            expect(core.getFrameObject().properties.type).toBe('a4');

            cmd.undo();
            expect(core.getFrameObject().properties.type).toBe('custom');
            expect(core.getFrameObject().properties.lockedAspect).toBe(false);
        });

        it('восстанавливает type, size, position при undo preset', () => {
            const frame = {
                id: 'frame-1',
                type: 'frame',
                width: 200,
                height: 280,
                position: { x: 50, y: 80 },
                properties: { type: 'custom', lockedAspect: false },
            };
            const core = createMockCore(frame);
            const oldSize = { width: 200, height: 280 };
            const newSize = { width: 210, height: 297 };
            const oldPos = { x: 50, y: 80 };
            const newPos = { x: 45, y: 75 };

            const cmd = new UpdateFrameTypeCommand(
                core,
                'frame-1',
                'custom',
                'a4',
                oldSize,
                newSize,
                oldPos,
                newPos
            );

            cmd.execute();
            expect(core.getFrameObject().width).toBe(210);
            expect(core.getFrameObject().position.x).toBe(45);

            cmd.undo();
            expect(core.getFrameObject().properties.type).toBe('custom');
            expect(core.getFrameObject().width).toBe(200);
            expect(core.getFrameObject().height).toBe(280);
            expect(core.getFrameObject().position).toEqual({ x: 50, y: 80 });
        });
    });
});
