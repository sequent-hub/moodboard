/**
 * Unit-тесты команды UpdateFramePropertiesCommand.
 * Проверяют execute, undo для title и backgroundColor.
 */
import { describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { UpdateFramePropertiesCommand } from '../../src/core/commands/UpdateFramePropertiesCommand.js';

function createMockCore(frameObject = null) {
    const objects = frameObject
        ? [frameObject]
        : [
              {
                  id: 'frame-1',
                  type: 'frame',
                  backgroundColor: 0xffffff,
                  properties: { title: 'A4', type: 'a4' },
              },
          ];

    const setTitleSpy = vi.fn();
    const setBackgroundColorSpy = vi.fn();
    const pixiInstance = {
        setTitle: setTitleSpy,
        setBackgroundColor: setBackgroundColorSpy,
    };
    const pixiObject = {
        _mb: { type: 'frame', instance: pixiInstance },
    };

    const objectsMap = new Map();
    objectsMap.set('frame-1', pixiObject);

    const state = {
        getObjects: vi.fn(() => objects),
        markDirty: vi.fn(),
    };

    const eventBus = { emit: vi.fn() };

    return {
        state,
        pixi: { objects: objectsMap },
        eventBus,
        setTitleSpy,
        setBackgroundColorSpy,
        getFrameObject: () => objects[0],
    };
}

describe('UpdateFramePropertiesCommand', () => {
    describe('execute', () => {
        it('применяет title в object.properties и вызывает instance.setTitle', () => {
            const core = createMockCore();
            const cmd = new UpdateFramePropertiesCommand(
                core,
                'frame-1',
                'title',
                'A4',
                'Мой фрейм'
            );

            cmd.execute();

            expect(core.getFrameObject().properties.title).toBe('Мой фрейм');
            expect(core.state.markDirty).toHaveBeenCalled();
            expect(core.setTitleSpy).toHaveBeenCalledWith('Мой фрейм');
            expect(core.eventBus.emit).toHaveBeenCalledWith(Events.Object.StateChanged, {
                objectId: 'frame-1',
                updates: { properties: { title: 'Мой фрейм' } },
            });
        });

        it('применяет backgroundColor на верхний уровень объекта', () => {
            const core = createMockCore();
            const cmd = new UpdateFramePropertiesCommand(
                core,
                'frame-1',
                'backgroundColor',
                0xffffff,
                0xe3f2fd
            );

            cmd.execute();

            expect(core.getFrameObject().backgroundColor).toBe(0xe3f2fd);
            expect(core.setBackgroundColorSpy).toHaveBeenCalledWith(0xe3f2fd);
        });
    });

    describe('undo', () => {
        it('восстанавливает title при undo', () => {
            const core = createMockCore();
            const cmd = new UpdateFramePropertiesCommand(
                core,
                'frame-1',
                'title',
                'A4',
                'Мой фрейм'
            );

            cmd.execute();
            expect(core.getFrameObject().properties.title).toBe('Мой фрейм');

            cmd.undo();
            expect(core.getFrameObject().properties.title).toBe('A4');
            expect(core.setTitleSpy).toHaveBeenLastCalledWith('A4');
        });

        it('восстанавливает backgroundColor при undo', () => {
            const core = createMockCore();
            const cmd = new UpdateFramePropertiesCommand(
                core,
                'frame-1',
                'backgroundColor',
                0xffffff,
                0xe8f5e8
            );

            cmd.execute();
            expect(core.getFrameObject().backgroundColor).toBe(0xe8f5e8);

            cmd.undo();
            expect(core.getFrameObject().backgroundColor).toBe(0xffffff);
            expect(core.setBackgroundColorSpy).toHaveBeenLastCalledWith(0xffffff);
        });
    });
});
