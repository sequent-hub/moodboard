import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../../src/core/SaveManager.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        off: vi.fn(),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

describe('SaveManager - history-triggered save flow', () => {
    let eventBus;
    let manager;
    let apiClient;
    let consoleErrorSpy;
    const boardData = { id: 'board-autosave-1', objects: [{ id: 'n1', type: 'note' }] };

    beforeEach(() => {
        eventBus = createEventBus();
        manager = new SaveManager(eventBus);

        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        apiClient = { saveBoard: vi.fn().mockResolvedValue({ success: true, data: { ok: true } }) };
        manager.setApiClient(apiClient);
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        manager.options.autoSave = false;
        manager.hasUnsavedChanges = false;
        manager.destroy();
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('сохраняет по событию history:changed', async () => {
        eventBus.emit(Events.History.Changed, {});
        await vi.waitFor(() => {
            expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
        });
    });

    it('не сохраняет по object:* событиям (лишние триггеры отключены)', async () => {
        eventBus.emit(Events.Object.Created, {});
        eventBus.emit(Events.Object.Updated, {});
        eventBus.emit(Events.Object.Deleted, {});
        eventBus.emit(Events.Object.StateChanged, {});
        await Promise.resolve();
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(0);
    });

    it('повторное history:changed с теми же данными не вызывает лишний save', async () => {
        eventBus.emit(Events.History.Changed, {});
        await vi.waitFor(() => {
            expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
        });

        eventBus.emit(Events.History.Changed, {});
        await vi.waitFor(() => {
            expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
        });
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
    });

    it('forceSave выполняет сохранение немедленно', async () => {
        await manager.forceSave();
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
    });

    it('эмитит корректный порядок статусов: saving -> saved', async () => {
        eventBus.emit(Events.History.Changed, {});
        await vi.waitFor(() => {
            const statusEvents = eventBus.emit.mock.calls
                .filter((call) => call[0] === Events.Save.StatusChanged)
                .map((call) => call[1]);
            expect(statusEvents.length).toBeGreaterThanOrEqual(2);
        });

        const statusEvents = eventBus.emit.mock.calls
            .filter((call) => call[0] === Events.Save.StatusChanged)
            .map((call) => call[1]);

        expect(statusEvents.length).toBeGreaterThanOrEqual(2);
        expect(statusEvents[0].status).toBe('saving');
        expect(statusEvents[1].status).toBe('saved');

        expect(statusEvents[0].hasUnsavedChanges).toBe(true);
        expect(statusEvents[1].hasUnsavedChanges).toBe(false);
    });

    it('эмитит корректный порядок статусов для ошибки: saving -> error', async () => {
        vi.useFakeTimers();
        apiClient.saveBoard.mockRejectedValueOnce(new Error('network-timeout'));
        manager.options.maxRetries = 1;

        eventBus.emit(Events.History.Changed, {});
        await vi.runAllTimersAsync();

        const statusEvents = eventBus.emit.mock.calls
            .filter((call) => call[0] === Events.Save.StatusChanged)
            .map((call) => call[1]);

        expect(statusEvents.length).toBeGreaterThanOrEqual(2);
        expect(statusEvents[0].status).toBe('saving');
        expect(statusEvents[1].status).toBe('error');

        expect(statusEvents[1].hasUnsavedChanges).toBe(true);
        expect(statusEvents[1].message).toContain('network-timeout');
        vi.useRealTimers();
    });
});
