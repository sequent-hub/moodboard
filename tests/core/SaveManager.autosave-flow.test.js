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

describe('SaveManager - autosave flow', () => {
    let eventBus;
    let manager;
    let apiClient;
    let consoleErrorSpy;
    const boardData = { id: 'board-autosave-1', objects: [{ id: 'n1', type: 'note' }] };

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus = createEventBus();
        manager = new SaveManager(eventBus);
        manager.options.saveDelay = 400;
        manager.options.periodicSaveInterval = 30000;

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
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('debounce: серия markAsChanged вызывает один save после saveDelay', async () => {
        manager.markAsChanged();
        await vi.advanceTimersByTimeAsync(200);
        manager.markAsChanged();
        await vi.advanceTimersByTimeAsync(200);
        manager.markAsChanged();

        await vi.advanceTimersByTimeAsync(399);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(0);

        await vi.advanceTimersByTimeAsync(1);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
    });

    it('повторное изменение переносит дедлайн автосохранения', async () => {
        manager.markAsChanged();
        await vi.advanceTimersByTimeAsync(300);

        manager.markAsChanged();
        await vi.advanceTimersByTimeAsync(399);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(0);

        await vi.advanceTimersByTimeAsync(1);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
    });

    it('periodic interval сохраняет только при unsavedChanges и отсутствии in-flight запроса', async () => {
        manager.hasUnsavedChanges = false;
        await vi.advanceTimersByTimeAsync(30000);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(0);

        manager.hasUnsavedChanges = true;
        manager.isRequestInProgress = true;
        await vi.advanceTimersByTimeAsync(30000);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(0);

        manager.isRequestInProgress = false;
        await vi.advanceTimersByTimeAsync(30000);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
    });

    it('setAutoSave(false) отменяет pending таймер и блокирует новый schedule', async () => {
        manager.markAsChanged();
        manager.setAutoSave(false);

        await vi.advanceTimersByTimeAsync(1000);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(0);

        manager.markAsChanged();
        await vi.advanceTimersByTimeAsync(1000);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(0);
    });

    it('forceSave очищает pending таймер и выполняет немедленное сохранение один раз', async () => {
        manager.markAsChanged();
        await manager.forceSave();
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1000);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
    });

    it('эмитит корректный порядок статусов для autosave success: pending -> saving -> saved', async () => {
        manager.markAsChanged();
        await vi.advanceTimersByTimeAsync(400);

        const statusEvents = eventBus.emit.mock.calls
            .filter((call) => call[0] === Events.Save.StatusChanged)
            .map((call) => call[1]);

        expect(statusEvents.length).toBeGreaterThanOrEqual(3);
        expect(statusEvents[0].status).toBe('pending');
        expect(statusEvents[1].status).toBe('saving');
        expect(statusEvents[2].status).toBe('saved');

        expect(statusEvents[0].hasUnsavedChanges).toBe(true);
        expect(statusEvents[1].hasUnsavedChanges).toBe(true);
        expect(statusEvents[2].hasUnsavedChanges).toBe(false);
    });

    it('эмитит корректный порядок статусов для autosave error: pending -> saving -> error', async () => {
        apiClient.saveBoard.mockRejectedValueOnce(new Error('network-timeout'));
        manager.options.maxRetries = 1;

        manager.markAsChanged();
        await vi.advanceTimersByTimeAsync(400);

        const statusEvents = eventBus.emit.mock.calls
            .filter((call) => call[0] === Events.Save.StatusChanged)
            .map((call) => call[1]);

        expect(statusEvents.length).toBeGreaterThanOrEqual(3);
        expect(statusEvents[0].status).toBe('pending');
        expect(statusEvents[1].status).toBe('saving');
        expect(statusEvents[2].status).toBe('error');

        expect(statusEvents[2].hasUnsavedChanges).toBe(true);
        expect(statusEvents[2].message).toContain('network-timeout');
    });
});
