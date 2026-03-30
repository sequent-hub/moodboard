import { describe, it, expect, vi } from 'vitest';
import { bindToolbarEvents, bindSaveCallbacks } from '../../src/moodboard/integration/MoodBoardEventBindings.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

describe('History navigation append-only scenario', () => {
    it('навигация по версиям не создает новых записей, новая версия появляется только после изменения', async () => {
        const eventBus = createEventBus();
        const loadCalls = [];

        const board = {
            options: {
                boardId: 'mb-1',
                onSave: vi.fn(),
            },
            historyHeadVersion: 4,
            historyCursorVersion: 4,
            currentLoadedVersion: 4,
            loadFromApi: vi.fn(async (_boardId, version, options = {}) => {
                loadCalls.push({ version, options });
                // Эмулируем успешную загрузку версии с сервера.
                board.currentLoadedVersion = version;
                board.historyCursorVersion = version;
                if (!options.historyNavigation) {
                    board.historyHeadVersion = version;
                }
            }),
            actionHandler: {
                handleToolbarAction: vi.fn(),
            },
            coreMoodboard: {
                eventBus,
                pixi: null,
            },
        };

        bindToolbarEvents(board);
        bindSaveCallbacks(board);

        // Было: 1,2,3,4. Стоим на 4.
        expect(board.historyHeadVersion).toBe(4);
        expect(board.historyCursorVersion).toBe(4);

        // Назад: 4 -> 3
        eventBus.emit(Events.UI.LoadPrevVersion);
        await Promise.resolve();
        expect(board.historyCursorVersion).toBe(3);
        expect(board.historyHeadVersion).toBe(4);

        // Назад: 3 -> 2
        eventBus.emit(Events.UI.LoadPrevVersion);
        await Promise.resolve();
        expect(board.historyCursorVersion).toBe(2);
        expect(board.historyHeadVersion).toBe(4);

        // Вперед: 2 -> 3
        eventBus.emit(Events.UI.LoadNextVersion);
        await Promise.resolve();
        expect(board.historyCursorVersion).toBe(3);
        expect(board.historyHeadVersion).toBe(4);

        // Проверяем, что ходили только загрузками версий без создания новой версии.
        expect(loadCalls.map((c) => c.version)).toEqual([3, 2, 3]);
        expect(loadCalls.every((c) => c.options?.historyNavigation === true)).toBe(true);

        // Пользователь изменил контент на загруженной версии (например 3),
        // backend сохранил новый head = 5.
        eventBus.emit(Events.Save.Success, {
            response: { historyVersion: 5 },
        });

        expect(board.historyHeadVersion).toBe(5);
        expect(board.historyCursorVersion).toBe(5);
        expect(board.currentLoadedVersion).toBe(5);
    });
});
