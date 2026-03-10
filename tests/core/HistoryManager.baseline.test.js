/**
 * Тесты механизма добавления команд в историю и перемещения по истории (undo/redo).
 * Покрывает HistoryManager: executeCommand, undo, redo, merge, maxHistorySize, события.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoryManager } from '../../src/core/HistoryManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Создаёт мок-команду для тестов.
 * Имитирует контракт BaseCommand: execute, undo, canMergeWith.
 * Не поддерживает слияние (canMergeWith всегда false).
 * @param {string} id — идентификатор команды для отладки
 * @param {Function} executeFn — шпион для execute()
 * @param {Function} undoFn — шпион для undo()
 */
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

/**
 * Создаёт мок-команду с поддержкой merge для тестов слияния.
 * Используется при проверке логики canMergeWith и mergeTimeout.
 * @param {string} id — идентификатор команды
 * @param {object|null} mergeTarget — целевая команда для canMergeWith (или null для проверки по type)
 * @param {Function} executeFn — шпион для execute()
 * @param {Function} undoFn — шпион для undo()
 */
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

/**
 * Группа тестов: механизм добавления команд в историю.
 * Проверяет executeCommand, накопление, отсечение redo-ветки, maxHistorySize, merge.
 */
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

    // Базовый сценарий: одна команда попадает в историю и currentIndex сдвигается на 0
    it('executeCommand добавляет команду и увеличивает currentIndex', () => {
        const cmd = createMockCommand('a');
        history.executeCommand(cmd);

        expect(history.history).toHaveLength(1);
        expect(history.currentIndex).toBe(0);
        expect(history.history[0]).toBe(cmd);
    });

    // Команда должна быть выполнена до добавления в историю
    it('executeCommand вызывает command.execute()', () => {
        const execute = vi.fn();
        const cmd = createMockCommand('a', execute);
        history.executeCommand(cmd);

        expect(execute).toHaveBeenCalledTimes(1);
    });

    // UI подписан на History.Changed для обновления кнопок undo/redo
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

    // canUndo/canRedo — предикаты для состояния кнопок (currentIndex >= 0 для undo)
    it('при пустой истории canUndo false, после execute canUndo true', () => {
        expect(history.canUndo()).toBe(false);
        expect(history.canRedo()).toBe(false);

        history.executeCommand(createMockCommand('a'));
        expect(history.canUndo()).toBe(true);
        expect(history.canRedo()).toBe(false);
    });

    // Последовательные команды выстраиваются в линейную историю
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

    // Важный контракт: после undo новая команда отсекает «будущее» (redo-ветку),
    // чтобы история оставалась линейной
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

    // Защита от неограниченного роста истории: FIFO при превышении лимита
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

    // Merge: если lastCommand.canMergeWith(command) и разница timestamp < mergeTimeout,
    // то вызывается lastCommand.mergeWith(command), входящая команда НЕ добавляется и НЕ выполняется
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

    // За пределами mergeTimeout merge не применяется — добавляется новая запись в историю
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

    // Во время undo/redo isExecutingCommand = true: вложенные executeCommand не добавляют в историю,
    // иначе undo одной команды мог бы породить новую запись
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

/**
 * Группа тестов: перемещение по истории (undo/redo).
 * Проверяет undo, redo, события, полные циклы, реакцию на keyboard:undo/redo.
 */
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

    // undo вызывает undo() текущей команды и сдвигает currentIndex назад
    it('undo вызывает command.undo и уменьшает currentIndex', () => {
        const undo = vi.fn();
        const cmd = createMockCommand('a', vi.fn(), undo);
        history.executeCommand(cmd);

        const result = history.undo();

        expect(result).toBe(true);
        expect(undo).toHaveBeenCalledTimes(1);
        expect(history.currentIndex).toBe(-1);
    });

    // Безопасный вызов undo при пустой истории
    it('undo при пустой истории возвращает false', () => {
        const result = history.undo();
        expect(result).toBe(false);
    });

    // После undo UI получает lastUndone для отображения (например, в тултипе)
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

    // redo повторно выполняет команду и сдвигает currentIndex вперёд
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

    // redo возможен только когда currentIndex < length-1 (есть «будущее»)
    it('redo при невозможности возвращает false', () => {
        expect(history.redo()).toBe(false);

        const cmd = createMockCommand('a');
        history.executeCommand(cmd);
        expect(history.redo()).toBe(false);
    });

    // Аналогично undo — lastRedone для UI
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

    // Двойной undo возвращает к состоянию до первой команды (currentIndex = -1)
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

    // undo затем redo восстанавливает выполненное состояние; execute вызывается дважды
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

    // История подписана на keyboard:undo (Ctrl+Z) — интеграция с клавиатурой
    it('событие keyboard:undo вызывает undo', () => {
        const cmd = createMockCommand('a');
        history.executeCommand(cmd);

        const undoSpy = vi.spyOn(history, 'undo');
        eventBus.emit(Events.Keyboard.Undo);

        expect(undoSpy).toHaveBeenCalledTimes(1);
        undoSpy.mockRestore();
    });

    // Аналогично keyboard:redo (Ctrl+Shift+Z)
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

/**
 * Группа тестов: служебные методы HistoryManager.
 * getLastCommand, getHistoryInfo, clear, destroy.
 */
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

    // getLastCommand нужен для проверки merge (последняя команда в истории)
    it('getLastCommand возвращает последнюю команду или null', () => {
        expect(history.getLastCommand()).toBeNull();

        const cmd = createMockCommand('a');
        history.executeCommand(cmd);
        expect(history.getLastCommand()).toBe(cmd);

        const cmd2 = createMockCommand('b');
        history.executeCommand(cmd2);
        expect(history.getLastCommand()).toBe(cmd2);
    });

    // Используется для отладки (debugHistory) и диагностики
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

    // clear сбрасывает history и currentIndex, уведомляет UI
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

    // destroy снимает только свои подписки (keyboard:undo/redo, history:debug), не затрагивая другие
    it('destroy снимает подписки и не трогает сторонние слушатели', () => {
        const external = vi.fn();
        eventBus.on(Events.UI.ZoomIn, external);
        history.destroy();

        eventBus.emit(Events.UI.ZoomIn, {});
        expect(external).toHaveBeenCalledTimes(1);
    });
});
