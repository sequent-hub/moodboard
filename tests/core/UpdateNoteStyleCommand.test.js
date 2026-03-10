/**
 * Unit-тесты команды UpdateNoteStyleCommand.
 * Проверяют execute, undo, merge для свойств fontFamily, fontSize, textColor, backgroundColor.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { UpdateNoteStyleCommand } from '../../src/core/commands/UpdateNoteStyleCommand.js';

function createMockCore(noteObject = null) {
    const objects = noteObject
        ? [noteObject]
        : [
              {
                  id: 'note-1',
                  type: 'note',
                  properties: {
                      content: 'Test',
                      fontFamily: 'Caveat, Arial, cursive',
                      fontSize: 32,
                      textColor: 0x1a1a1a,
                      backgroundColor: 0xfff9c4,
                  },
              },
          ];

    const setStyleSpy = vi.fn();
    const pixiInstance = { setStyle: setStyleSpy };
    const pixiObject = {
        _mb: {
            type: 'note',
            properties: objects[0]?.properties || {},
            instance: pixiInstance,
        },
    };

    const objectsMap = new Map();
    objectsMap.set('note-1', pixiObject);

    const state = {
        getObjects: vi.fn(() => objects),
        markDirty: vi.fn(),
    };

    const eventBus = {
        emit: vi.fn(),
    };

    return {
        state,
        pixi: { objects: objectsMap },
        eventBus,
        setStyleSpy,
        getNoteObject: () => objects[0],
    };
}

describe('UpdateNoteStyleCommand', () => {
    describe('execute', () => {
        it('применяет fontFamily в object.properties и вызывает instance.setStyle', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(
                core,
                'note-1',
                'fontFamily',
                'Caveat, Arial, cursive',
                'Roboto, Arial, sans-serif'
            );

            cmd.execute();

            expect(core.getNoteObject().properties.fontFamily).toBe('Roboto, Arial, sans-serif');
            expect(core.state.markDirty).toHaveBeenCalled();
            expect(core.setStyleSpy).toHaveBeenCalledWith({ fontFamily: 'Roboto, Arial, sans-serif' });
            expect(core.eventBus.emit).toHaveBeenCalledWith(Events.Object.StateChanged, {
                objectId: 'note-1',
                updates: { properties: { fontFamily: 'Roboto, Arial, sans-serif' } },
            });
        });

        it('применяет fontSize в object.properties и вызывает instance.setStyle', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(core, 'note-1', 'fontSize', 32, 24);

            cmd.execute();

            expect(core.getNoteObject().properties.fontSize).toBe(24);
            expect(core.setStyleSpy).toHaveBeenCalledWith({ fontSize: 24 });
        });

        it('применяет textColor в object.properties и вызывает instance.setStyle', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(core, 'note-1', 'textColor', 0x1a1a1a, 0xd32f2f);

            cmd.execute();

            expect(core.getNoteObject().properties.textColor).toBe(0xd32f2f);
            expect(core.setStyleSpy).toHaveBeenCalledWith({ textColor: 0xd32f2f });
        });

        it('применяет backgroundColor в object.properties и вызывает instance.setStyle', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(core, 'note-1', 'backgroundColor', 0xfff9c4, 0xfce4ec);

            cmd.execute();

            expect(core.getNoteObject().properties.backgroundColor).toBe(0xfce4ec);
            expect(core.setStyleSpy).toHaveBeenCalledWith({ backgroundColor: 0xfce4ec });
        });

        it('создаёт object.properties при отсутствии', () => {
            const noteWithoutProps = {
                id: 'note-1',
                type: 'note',
                properties: undefined,
            };
            const core = createMockCore(noteWithoutProps);
            const cmd = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'Arial', 'Roboto, Arial, sans-serif');

            cmd.execute();

            expect(core.getNoteObject().properties.fontFamily).toBe('Roboto, Arial, sans-serif');
        });
    });

    describe('undo', () => {
        it('восстанавливает fontFamily при undo', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(
                core,
                'note-1',
                'fontFamily',
                'Caveat, Arial, cursive',
                'Roboto, Arial, sans-serif'
            );

            cmd.execute();
            expect(core.getNoteObject().properties.fontFamily).toBe('Roboto, Arial, sans-serif');

            cmd.undo();
            expect(core.getNoteObject().properties.fontFamily).toBe('Caveat, Arial, cursive');
            expect(core.setStyleSpy).toHaveBeenLastCalledWith({ fontFamily: 'Caveat, Arial, cursive' });
        });

        it('восстанавливает fontSize при undo', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(core, 'note-1', 'fontSize', 32, 18);

            cmd.execute();
            cmd.undo();

            expect(core.getNoteObject().properties.fontSize).toBe(32);
        });

        it('восстанавливает textColor при undo', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(core, 'note-1', 'textColor', 0x1a1a1a, 0x1976d2);

            cmd.execute();
            cmd.undo();

            expect(core.getNoteObject().properties.textColor).toBe(0x1a1a1a);
        });

        it('восстанавливает backgroundColor при undo', () => {
            const core = createMockCore();
            const cmd = new UpdateNoteStyleCommand(core, 'note-1', 'backgroundColor', 0xfff9c4, 0xe3f2fd);

            cmd.execute();
            cmd.undo();

            expect(core.getNoteObject().properties.backgroundColor).toBe(0xfff9c4);
        });
    });

    describe('canMergeWith', () => {
        it('возвращает true для той же команды, того же objectId и property', () => {
            const core = createMockCore();
            const cmd1 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'A', 'B');
            const cmd2 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'B', 'C');

            expect(cmd1.canMergeWith(cmd2)).toBe(true);
        });

        it('возвращает false для другого objectId', () => {
            const core = createMockCore();
            const cmd1 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'A', 'B');
            const cmd2 = new UpdateNoteStyleCommand(core, 'note-2', 'fontFamily', 'B', 'C');

            expect(cmd1.canMergeWith(cmd2)).toBe(false);
        });

        it('возвращает false для другого property', () => {
            const core = createMockCore();
            const cmd1 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'A', 'B');
            const cmd2 = new UpdateNoteStyleCommand(core, 'note-1', 'fontSize', 32, 24);

            expect(cmd1.canMergeWith(cmd2)).toBe(false);
        });

        it('возвращает false для UpdateTextStyleCommand', () => {
            const core = createMockCore();
            const cmd1 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'A', 'B');
            const fakeOther = { objectId: 'note-1', property: 'fontFamily', constructor: { name: 'UpdateTextStyleCommand' } };

            expect(cmd1.canMergeWith(fakeOther)).toBe(false);
        });
    });

    describe('mergeWith', () => {
        it('обновляет newValue и timestamp', () => {
            const core = createMockCore();
            const cmd1 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'A', 'B');
            const cmd2 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'B', 'C');
            cmd2.timestamp = 12345;

            cmd1.mergeWith(cmd2);

            expect(cmd1.newValue).toBe('C');
            expect(cmd1.timestamp).toBe(12345);
        });

        it('выбрасывает при несовместимой команде', () => {
            const core = createMockCore();
            const cmd1 = new UpdateNoteStyleCommand(core, 'note-1', 'fontFamily', 'A', 'B');
            const cmd2 = new UpdateNoteStyleCommand(core, 'note-2', 'fontFamily', 'B', 'C');

            expect(() => cmd1.mergeWith(cmd2)).toThrow('Cannot merge commands');
        });
    });
});
