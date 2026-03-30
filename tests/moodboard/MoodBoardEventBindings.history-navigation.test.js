import { describe, it, expect, vi } from 'vitest';
import { bindToolbarEvents } from '../../src/moodboard/integration/MoodBoardEventBindings.js';
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

describe('MoodBoardEventBindings history navigation', () => {
    it('ui:load-prev-version грузит предыдущую версию через loadFromApi', async () => {
        const eventBus = createEventBus();
        const board = {
            options: { boardId: 'mb-1' },
            historyCursorVersion: 4,
            historyHeadVersion: 4,
            loadFromApi: vi.fn().mockResolvedValue(undefined),
            actionHandler: { handleToolbarAction: vi.fn() },
            coreMoodboard: { eventBus },
        };

        bindToolbarEvents(board);
        eventBus.emit(Events.UI.LoadPrevVersion);
        await Promise.resolve();

        expect(board.loadFromApi).toHaveBeenCalledWith('mb-1', 3, {
            fallbackToSeedOnError: false,
            historyNavigation: true,
        });
    });

    it('ui:load-next-version не грузит, если cursor уже на head', async () => {
        const eventBus = createEventBus();
        const board = {
            options: { boardId: 'mb-1' },
            historyCursorVersion: 4,
            historyHeadVersion: 4,
            loadFromApi: vi.fn().mockResolvedValue(undefined),
            actionHandler: { handleToolbarAction: vi.fn() },
            coreMoodboard: { eventBus },
        };

        bindToolbarEvents(board);
        eventBus.emit(Events.UI.LoadNextVersion);
        await Promise.resolve();

        expect(board.loadFromApi).not.toHaveBeenCalled();
    });

    it('ui:load-next-version грузит следующую версию, если cursor < head', async () => {
        const eventBus = createEventBus();
        const board = {
            options: { boardId: 'mb-1' },
            historyCursorVersion: 2,
            historyHeadVersion: 4,
            loadFromApi: vi.fn().mockResolvedValue(undefined),
            actionHandler: { handleToolbarAction: vi.fn() },
            coreMoodboard: { eventBus },
        };

        bindToolbarEvents(board);
        eventBus.emit(Events.UI.LoadNextVersion);
        await Promise.resolve();

        expect(board.loadFromApi).toHaveBeenCalledWith('mb-1', 3, {
            fallbackToSeedOnError: false,
            historyNavigation: true,
        });
    });
});
