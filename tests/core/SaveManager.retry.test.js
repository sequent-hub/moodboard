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

describe('SaveManager - retry/backoff', () => {
    let eventBus;
    let manager;
    let apiClient;
    let consoleErrorSpy;

    const boardData = {
        id: 'board-1',
        objects: [{ id: 'img-1', type: 'image', imageId: 'img-1', properties: { src: '/api/v2/images/img-1/download' } }]
    };

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus = createEventBus();
        manager = new SaveManager(eventBus);
        manager.options.maxRetries = 3;
        manager.options.retryDelay = 100;
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        apiClient = { saveBoard: vi.fn() };
        manager.setApiClient(apiClient);
    });

    afterEach(() => {
        manager.options.autoSave = false;
        manager.hasUnsavedChanges = false;
        manager.destroy();
        consoleErrorSpy.mockRestore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('делает повторные попытки с увеличением задержки и завершает успехом', async () => {
        apiClient.saveBoard
            .mockRejectedValueOnce(new Error('timeout-1'))
            .mockRejectedValueOnce(new Error('timeout-2'))
            .mockResolvedValueOnce({ success: true, data: { ok: true } });

        manager.hasUnsavedChanges = true;
        await manager.saveImmediately();
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
        expect(manager.getStatus().saveStatus).toBe('error');

        await vi.advanceTimersByTimeAsync(99);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1); // retry #1 через 100мс
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(2);
        expect(manager.getStatus().saveStatus).toBe('error');

        await vi.advanceTimersByTimeAsync(199);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1); // retry #2 через 200мс
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(3);

        const status = manager.getStatus();
        expect(status.saveStatus).toBe('saved');
        expect(status.retryCount).toBe(0);
        expect(status.hasUnsavedChanges).toBe(false);
    });

    it('останавливает retry после maxRetries', async () => {
        manager.options.maxRetries = 2;
        apiClient.saveBoard.mockRejectedValue(new Error('timeout-always'));

        manager.hasUnsavedChanges = true;
        await manager.saveImmediately(); // попытка 1, планирует retry
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(100); // попытка 2, больше retry не будет
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1000);
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(2);
        expect(manager.getStatus().saveStatus).toBe('error');
    });

    it('после трех неудачных попыток эмитит Save.Error и оставляет hasUnsavedChanges=true', async () => {
        manager.options.maxRetries = 3;
        const saveErrors = [];
        eventBus.on(Events.Save.Error, (payload) => saveErrors.push(payload));
        apiClient.saveBoard.mockRejectedValue(new Error('persistent-timeout'));

        manager.hasUnsavedChanges = true;
        await manager.saveImmediately(); // attempt 1
        await vi.advanceTimersByTimeAsync(100); // attempt 2
        await vi.advanceTimersByTimeAsync(200); // attempt 3
        await vi.advanceTimersByTimeAsync(500);

        expect(apiClient.saveBoard).toHaveBeenCalledTimes(3);
        expect(saveErrors).toHaveLength(3);
        expect(saveErrors[2]).toMatchObject({
            retryCount: 3,
            maxRetries: 3,
        });
        const status = manager.getStatus();
        expect(status.saveStatus).toBe('error');
        expect(status.hasUnsavedChanges).toBe(true);
    });

    it('блокирует сохранение image без imageId до обращения к apiClient', async () => {
        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = {
                id: 'board-1',
                objects: [{ id: 'img-missing', type: 'image', properties: { src: 'data:image/png;base64,AAAA' } }],
            };
        });

        manager.hasUnsavedChanges = true;
        await manager.saveImmediately();

        expect(apiClient.saveBoard).not.toHaveBeenCalled();
        const status = manager.getStatus();
        expect(status.saveStatus).toBe('error');
        expect(status.hasUnsavedChanges).toBe(true);
    });
});
