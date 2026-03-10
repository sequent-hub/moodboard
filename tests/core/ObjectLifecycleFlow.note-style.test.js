/**
 * Тесты ObjectLifecycleFlow: перехват StateChanged для записки и создание UpdateNoteStyleCommand.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { setupObjectLifecycleFlow } from '../../src/core/flows/ObjectLifecycleFlow.js';
import { UpdateNoteStyleCommand } from '../../src/core/commands/UpdateNoteStyleCommand.js';

function createMinimalCoreForNote() {
    const noteObject = {
        id: 'note-flow-1',
        type: 'note',
        properties: {
            content: 'Test',
            fontFamily: 'Caveat, Arial, cursive',
            fontSize: 32,
            textColor: 0x1a1a1a,
            backgroundColor: 0xfff9c4,
        },
    };

    const setStyleSpy = vi.fn();
    const pixiInstance = { setStyle: setStyleSpy };
    const pixiObject = {
        _mb: {
            type: 'note',
            properties: { ...noteObject.properties },
            instance: pixiInstance,
        },
    };

    const executeCommandSpy = vi.fn();
    const history = { executeCommand: executeCommandSpy };

    const state = {
        getObjects: vi.fn(() => [noteObject]),
        markDirty: vi.fn(),
    };

    const objectsMap = new Map([['note-flow-1', pixiObject]]);
    const pixi = { objects: objectsMap };

    const eventBus = {
        on: vi.fn((eventName, handler) => {
            eventBus._handlers = eventBus._handlers || {};
            eventBus._handlers[eventName] = handler;
        }),
        emit: vi.fn((eventName, data) => {
            const handler = eventBus._handlers?.[eventName];
            if (handler) handler(data);
        }),
        _handlers: {},
    };

    const core = {
        eventBus,
        state,
        pixi,
        history,
    };

    return {
        core,
        noteObject,
        executeCommandSpy,
        setStyleSpy,
    };
}

describe('ObjectLifecycleFlow: StateChanged для note', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('StateChanged с properties.fontFamily для note вызывает history.executeCommand с UpdateNoteStyleCommand', () => {
        const { core, noteObject, executeCommandSpy } = createMinimalCoreForNote();
        setupObjectLifecycleFlow(core);

        core.eventBus.emit(Events.Object.StateChanged, {
            objectId: 'note-flow-1',
            updates: { properties: { fontFamily: 'Roboto, Arial, sans-serif' } },
        });

        expect(executeCommandSpy).toHaveBeenCalledTimes(1);
        const command = executeCommandSpy.mock.calls[0][0];
        expect(command).toBeInstanceOf(UpdateNoteStyleCommand);
        expect(command.objectId).toBe('note-flow-1');
        expect(command.property).toBe('fontFamily');
        expect(command.oldValue).toBe('Caveat, Arial, cursive');
        expect(command.newValue).toBe('Roboto, Arial, sans-serif');
    });

    it('StateChanged с properties.fontSize для note вызывает UpdateNoteStyleCommand', () => {
        const { core, executeCommandSpy } = createMinimalCoreForNote();
        setupObjectLifecycleFlow(core);

        core.eventBus.emit(Events.Object.StateChanged, {
            objectId: 'note-flow-1',
            updates: { properties: { fontSize: 18 } },
        });

        const command = executeCommandSpy.mock.calls[0][0];
        expect(command).toBeInstanceOf(UpdateNoteStyleCommand);
        expect(command.property).toBe('fontSize');
        expect(command.oldValue).toBe(32);
        expect(command.newValue).toBe(18);
    });

    it('StateChanged с properties.textColor для note вызывает UpdateNoteStyleCommand', () => {
        const { core, executeCommandSpy } = createMinimalCoreForNote();
        setupObjectLifecycleFlow(core);

        core.eventBus.emit(Events.Object.StateChanged, {
            objectId: 'note-flow-1',
            updates: { properties: { textColor: 0xd32f2f } },
        });

        const command = executeCommandSpy.mock.calls[0][0];
        expect(command).toBeInstanceOf(UpdateNoteStyleCommand);
        expect(command.property).toBe('textColor');
    });

    it('StateChanged с properties.backgroundColor для note вызывает UpdateNoteStyleCommand', () => {
        const { core, executeCommandSpy } = createMinimalCoreForNote();
        setupObjectLifecycleFlow(core);

        core.eventBus.emit(Events.Object.StateChanged, {
            objectId: 'note-flow-1',
            updates: { properties: { backgroundColor: 0xe3f2fd } },
        });

        const command = executeCommandSpy.mock.calls[0][0];
        expect(command).toBeInstanceOf(UpdateNoteStyleCommand);
        expect(command.property).toBe('backgroundColor');
    });

    it('StateChanged для text по-прежнему использует UpdateTextStyleCommand (не перехватывается note)', () => {
        const textObject = {
            id: 'text-1',
            type: 'text',
            properties: { fontFamily: 'Roboto, Arial, sans-serif' },
            fontSize: 18,
            color: '#000000',
            backgroundColor: 'transparent',
        };
        const executeCommandSpy = vi.fn();
        const history = { executeCommand: executeCommandSpy };
        const state = { getObjects: vi.fn(() => [textObject]), markDirty: vi.fn() };
        const pixi = { objects: new Map() };
        const eventBus = {
            on: vi.fn((eventName, handler) => {
                eventBus._handlers = eventBus._handlers || {};
                eventBus._handlers[eventName] = handler;
            }),
            emit: vi.fn((eventName, data) => {
                const handler = eventBus._handlers?.[eventName];
                if (handler) handler(data);
            }),
            _handlers: {},
        };

        const core = { eventBus, state, pixi, history };
        setupObjectLifecycleFlow(core);

        core.eventBus.emit(Events.Object.StateChanged, {
            objectId: 'text-1',
            updates: { properties: { fontFamily: 'Oswald, Arial, sans-serif' } },
        });

        expect(executeCommandSpy).toHaveBeenCalledTimes(1);
        const command = executeCommandSpy.mock.calls[0][0];
        expect(command.constructor.name).toBe('UpdateTextStyleCommand');
        expect(command).not.toBeInstanceOf(UpdateNoteStyleCommand);
    });
});
