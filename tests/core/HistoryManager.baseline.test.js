/**
 * Тесты механизма добавления команд в историю и перемещения по истории (undo/redo).
 * Покрывает HistoryManager: executeCommand, undo, redo, merge, maxHistorySize, события.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoryManager } from '../../src/core/HistoryManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { Events } from '../../src/core/events/Events.js';

/** Мок-команда: execute/undo, без merge */
function createMockCommand(id, executeFn = vi.fn(), undoFn = vi.fn()) {
    return {
        type: 'mock',
        id,
        description: `cmd-${id}`,
        timestamp: Date.now(),
        execute: executeFn,
        undo: undoFn,
        canMergeWith: () => false,
        toString: () => `mock: cmd-${id}`,
    };
}

/** Мок-команда с поддержкой merge (для тестов слияния) */
function createMergeableCommand(id, mergeTarget, executeFn = vi.fn(), undoFn = vi.fn()) {
    const cmd = {
        type: 'mergeable',
        id,
        description: `mergeable-${id}`,
        timestamp: Date.now(),
        execute: executeFn,
        undo: undoFn,
        canMergeWith: (other) => other === mergeTarget || other?.type === 'mergeable',
        mergeWith: vi.fn((other) => {
            cmd.timestamp = other.timestamp;
        }),
        toString: () => `mergeable: ${id}`,
    };
    return cmd;
}

describe('HistoryManager: добавление команд в историю', () => {
    let eventBus;
    let history;

    beforeEach(() => {
        eventBus = new EventBus();
        history = new HistoryManager(eventBus);
    });

    afterEach(() => {
        history?.destroy();
    });

    it('executeCommand добавляет команду и увеличивает currentIndex', () => {
        const cmd = createMockCommand('a');
        history.executeCommand(cmd);

        expect(history.history).toHaveLength(1);
        expect(history.currentIndex).toBe(0);
        expect(history.history[0]).toBe(cmd);
    });

    it('executeCommand вызывает command.execute()', () => {
        const execute = vi.fn();
        const cmd = createMockCommand('a', execute);
        history.executeCommand(cmd);

        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('executeCommand эмитит Events.History.Changed с корректными canUndo/canRedo/historySize', () => {
        const changed = vi.fn();
        eventBus.on(Events.History.Changed, changed);

        const cmd = createMockCommand('a');
        history.executeCommand(cmd);

        expect(changed).toHaveBeenCalledWith(
            expect.objectContaining({
                canUndo: true,
                canRedo: false,
                historySize: 1,
                currentCommand: expect.stringContaining('cmd-a'),
            })
        );
    });

    it('при пустой истории canUndo false, после execute canUndo true', () => {
        expect(history.canUndo()).toBe(false);
        expect(history.canRedo()).toBe(false);

        history.executeCommand(createMockCommand('a'));
        expect(history.canUndo()).toBe(true);
        expect(history.canRedo()).toBe(false);
    });

    it('несколько executeCommand накапливают команды и двигают currentIndex', () => {
        const cmd1 = createMockCommand('1');
        const cmd2 = createMockCommand('2');
        const cmd3 = createMockCommand('3');

        history.executeCommand(cmd1);
        history.executeCommand(cmd2);
        history.executeCommand(cmd3);

        expect(history.history).toHaveLength(3);
        expect(history.currentIndex).toBe(2);
        expect(history.history[0]).toBe(cmd1);
        expect(history.history[1]).toBe(cmd2);
        expect(history.history[2]).toBe(cmd3);
    });

    it('новая команда после undo отсекает хвост (redo-ветка)', () => {
        const cmd1 = createMockCommand('1');
        const cmd2 = createMockCommand('2');
        const cmd3 = createMockCommand('3');

        history.executeCommand(cmd1);
        history.executeCommand(cmd2);
        history.executeCommand(cmd3);
        history.undo();
        history.undo();
        expect(history.currentIndex).toBe(0);

        const cmdNew = createMockCommand('new');
        history.executeCommand(cmdNew);

        expect(history.history).toHaveLength(2);
        expect(history.history[0]).toBe(cmd1);
        expect(history.history[1]).toBe(cmdNew);
        expect(history.currentIndex).toBe(1);
    });

    it('ограничение maxHistorySize: при переполнении удаляется самая старая команда', () => {
        const opts = { maxHistorySize: 3 };
        const h = new HistoryManager(eventBus, opts);

        for (let i = 0; i < 5; i++) {
            h.executeCommand(createMockCommand(`cmd-${i}`));
        }

        expect(h.history).toHaveLength(3);
        expect(h.currentIndex).toBe(2);
        expect(h.history.map((c) => c.id)).toEqual(
            expect.arrayContaining([expect.stringContaining('cmd-2'), expect.stringContaining('cmd-3'), expect.stringContaining('cmd-4')])
        );
        expect(h.history.some((c) => String(c.id).includes('cmd-0'))).toBe(false);
        expect(h.history.some((c) => String(c.id).includes('cmd-1'))).toBe(false);

        h.destroy();
    });

    it('merge: при canMergeWith и в mergeTimeout команда объединяется, новая не добавляется', () => {
        vi.useFakeTimers();
        const opts = { mergeTimeout: 2000 };
        const h = new HistoryManager(eventBus, opts);

        const first = createMergeableCommand('first', null);
        const second = createMergeableCommand('second', first);

        h.executeCommand(first);
        expect(h.history).toHaveLength(1);

        vi.advanceTimersByTime(500);
        second.timestamp = Date.now();
        h.executeCommand(second);

        expect(h.history).toHaveLength(1);
        expect(first.mergeWith).toHaveBeenCalledWith(second);
        expect(second.execute).not.toHaveBeenCalled();

        vi.useRealTimers();
        h.destroy();
    });

    it('merge: за пределами mergeTimeout добавляется новая команда', () => {
        vi.useFakeTimers();
        const opts = { mergeTimeout: 500 };
        const h = new HistoryManager(eventBus, opts);

        const first = createMergeableCommand('first', null);
        const second = createMergeableCommand('second', first);

        h.executeCommand(first);
        vi.advanceTimersByTime(600);
        second.timestamp = Date.now();
        h.executeCommand(second);

        expect(h.history).toHaveLength(2);
        expect(first.mergeWith).not.toHaveBeenCalled();

        vi.useRealTimers();
        h.destroy();
    });

    it('при isExecutingCommand команда выполняется, но не добавляется в историю', () => {
        const cmd = createMockCommand('during-undo');
        const undo = vi.fn(() => {
            history.executeCommand(cmd);
        });

        const innerCmd = createMockCommand('inner', vi.fn(), undo);
        history.executeCommand(innerCmd);
        expect(history.history).toHaveLength(1);

        history.undo();
        expect(innerCmd.undo).toHaveBeenCalled();
        expect(cmd.execute).toHaveBeenCalledTimes(1);
        expect(history.history).toHaveLength(1);
    });
});

describe('HistoryManager: перемещение по истории (undo/redo)', () => {
    let eventBus;
    let history;

    beforeEach(() => {
        eventBus = new EventBus();
        history = new HistoryManager(eventBus);
    });

    afterEach(() => {
        history?.destroy();
    });

    it('undo вызывает command.undo и уменьшает currentIndex', () => {
        const undo = vi.fn();
        const cmd = createMockCommand('a', vi.fn(), undo);
        history.executeCommand(cmd);

        const result = history.undo();

        expect(result).toBe(true);
        expect(undo).toHaveBeenCalledTimes(1);
        expect(history.currentIndex).toBe(-1);
    });

    it('undo при пустой истории возвращает false', () => {
        const result = history.undo();
        expect(result).toBe(false);
    });

    it('undo эмитит Events.History.Changed с lastUndone', () => {
        const changed = vi.fn();
        eventBus.on(Events.History.Changed, changed);

        const cmd = createMockCommand('a');
        history.executeCommand(cmd);
        changed.mockClear();

        history.undo();

        expect(changed).toHaveBeenCalledWith(
            expect.objectContaining({
                canUndo: false,
                canRedo: true,
                historySize: 1,
                lastUndone: expect.stringContaining('cmd-a'),
            })
        );
    });

    it('redo вызывает command.execute и увеличивает currentIndex', () => {
        const execute = vi.fn();
        const cmd = createMockCommand('a', execute);
        history.executeCommand(cmd);
        history.undo();
        execute.mockClear();

        const result = history.redo();

        expect(result).toBe(true);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(history.currentIndex).toBe(0);
    });

    it('redo при невозможности возвращает false', () => {
        expect(history.redo()).toBe(false);

        const cmd = createMockCommand('a');
        history.executeCommand(cmd);
        expect(history.redo()).toBe(false);
    });

    it('redo эмитит Events.History.Changed с lastRedone', () => {
        const changed = vi.fn();
        eventBus.on(Events.History.Changed, changed);

        const cmd = createMockCommand('a');
        history.executeCommand(cmd);
        history.undo();
        changed.mockClear();

        history.redo();

        expect(changed).toHaveBeenCalledWith(
            expect.objectContaining({
                canUndo: true,
                canRedo: false,
                historySize: 1,
                lastRedone: expect.stringContaining('cmd-a'),
            })
        );
    });

    it('полный цикл: execute A, execute B, undo, undo — возврат к началу', () => {
        const u1 = vi.fn();
        const u2 = vi.fn();
        const cmd1 = createMockCommand('1', vi.fn(), u1);
        const cmd2 = createMockCommand('2', vi.fn(), u2);

        history.executeCommand(cmd1);
        history.executeCommand(cmd2);

        history.undo();
        expect(history.currentIndex).toBe(0);
        expect(u2).toHaveBeenCalledTimes(1);

        history.undo();
        expect(history.currentIndex).toBe(-1);
        expect(u1).toHaveBeenCalledTimes(1);
    });

    it('полный цикл: execute A, undo, redo — восстановление', () => {
        const execute = vi.fn();
        const undo = vi.fn();
        const cmd = createMockCommand('a', execute, undo);

        history.executeCommand(cmd);
        expect(execute).toHaveBeenCalledTimes(1);

        history.undo();
        expect(undo).toHaveBeenCalledTimes(1);

        history.redo();
        expect(execute).toHaveBeenCalledTimes(2);
        expect(history.currentIndex).toBe(0);
    });

    it('событие keyboard:undo вызывает undo', () => {
        const cmd = createMockCommand('a');
        history.executeCommand(cmd);

        const undoSpy = vi.spyOn(history, 'undo');
        eventBus.emit(Events.Keyboard.Undo);

        expect(undoSpy).toHaveBeenCalledTimes(1);
        undoSpy.mockRestore();
    });

    it('событие keyboard:redo вызывает redo', () => {
        const cmd = createMockCommand('a');
        history.executeCommand(cmd);
        history.undo();

        const redoSpy = vi.spyOn(history, 'redo');
        eventBus.emit(Events.Keyboard.Redo);

        expect(redoSpy).toHaveBeenCalledTimes(1);
        redoSpy.mockRestore();
    });
});

describe('HistoryManager: служебные методы', () => {
    let eventBus;
    let history;

    beforeEach(() => {
        eventBus = new EventBus();
        history = new HistoryManager(eventBus);
    });

    afterEach(() => {
        history?.destroy();
    });

    it('getLastCommand возвращает последнюю команду или null', () => {
        expect(history.getLastCommand()).toBeNull();

        const cmd = createMockCommand('a');
        history.executeCommand(cmd);
        expect(history.getLastCommand()).toBe(cmd);

        const cmd2 = createMockCommand('b');
        history.executeCommand(cmd2);
        expect(history.getLastCommand()).toBe(cmd2);
    });

    it('getHistoryInfo возвращает totalCommands, currentIndex, canUndo, canRedo, commands', () => {
        const cmd = createMockCommand('a');
        history.executeCommand(cmd);

        const info = history.getHistoryInfo();

        expect(info).toMatchObject({
            totalCommands: 1,
            currentIndex: 0,
            canUndo: true,
            canRedo: false,
        });
        expect(info.commands).toHaveLength(1);
        expect(info.commands[0]).toMatchObject({ index: 0, isCurrent: true });
    });

    it('clear очищает историю и эмитит Changed', () => {
        const cmd = createMockCommand('a');
        history.executeCommand(cmd);

        const changed = vi.fn();
        eventBus.on(Events.History.Changed, changed);

        history.clear();

        expect(history.history).toHaveLength(0);
        expect(history.currentIndex).toBe(-1);
        expect(changed).toHaveBeenCalledWith({
            canUndo: false,
            canRedo: false,
            historySize: 0,
        });
    });

    it('destroy снимает подписки и не трогает сторонние слушатели', () => {
        const external = vi.fn();
        eventBus.on(Events.UI.ZoomIn, external);
        history.destroy();

        eventBus.emit(Events.UI.ZoomIn, {});
        expect(external).toHaveBeenCalledTimes(1);
    });
});
