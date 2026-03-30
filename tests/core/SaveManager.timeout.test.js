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
            for (const handler of list) {
                handler(payload);
            }
        }),
        _handlers: handlers,
    };
}

describe('SaveManager - таймауты и сохранение', () => {
    let eventBus;
    let manager;
    let consoleErrorSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus = createEventBus();
        manager = new SaveManager(eventBus);
        manager.options.maxRetries = 1;
        manager.options.retryDelay = 10;
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

    it('при timeout в saveBoard сохраняет статус error и unsavedChanges', async () => {
        const boardData = {
            id: 'board-1',
            objects: [{ id: 'img-1', type: 'image', imageId: 'img-1', properties: { src: '/api/images/img-1/file' } }]
        };
        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        const apiClient = {
            saveBoard: vi.fn().mockRejectedValue(new Error('net::ERR_CONNECTION_TIMED_OUT')),
        };
        manager.setApiClient(apiClient);
        manager.hasUnsavedChanges = true;

        await manager.saveImmediately();

        const status = manager.getStatus();
        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
        expect(status.saveStatus).toBe('error');
        expect(status.hasUnsavedChanges).toBe(true);
        expect(status.retryCount).toBe(1);

        const errorEvents = eventBus.emit.mock.calls.filter((call) => call[0] === Events.Save.Error);
        expect(errorEvents).toHaveLength(1);
        expect(errorEvents[0][1].error).toContain('ERR_CONNECTION_TIMED_OUT');
    });

    it('при успешном save сбрасывает unsavedChanges и эмитит save:success', async () => {
        const boardData = {
            id: 'board-1',
            objects: [{ id: 'img-1', type: 'image', imageId: 'img-1', properties: { src: '/api/images/img-1/file' } }]
        };
        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        const apiClient = {
            saveBoard: vi.fn().mockResolvedValue({ success: true, data: { ok: true } }),
        };
        manager.setApiClient(apiClient);
        manager.hasUnsavedChanges = true;

        await manager.saveImmediately();

        const status = manager.getStatus();
        expect(status.saveStatus).toBe('saved');
        expect(status.hasUnsavedChanges).toBe(false);
        expect(status.retryCount).toBe(0);

        const successEvents = eventBus.emit.mock.calls.filter((call) => call[0] === Events.Save.Success);
        expect(successEvents).toHaveLength(1);
        expect(successEvents[0][1].data).toEqual(boardData);
    });

    it('не отправляет повторный save если данные не изменились', async () => {
        const boardData = {
            id: 'board-1',
            objects: [{ id: 'img-1', type: 'image', imageId: 'img-1', properties: { src: '/api/images/img-1/file' } }]
        };
        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        const apiClient = {
            saveBoard: vi.fn().mockResolvedValue({ success: true }),
        };
        manager.setApiClient(apiClient);

        manager.hasUnsavedChanges = true;
        await manager.saveImmediately();

        manager.hasUnsavedChanges = true;
        await manager.saveImmediately();

        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
    });

    it('scheduleAutoSave не использует pending-статус и не падает без данных', () => {
        manager.scheduleAutoSave();
        const statusEvents = eventBus.emit.mock.calls.filter((call) => call[0] === Events.Save.StatusChanged);
        const statuses = statusEvents.map(([, payload]) => payload?.status).filter(Boolean);
        expect(statuses).not.toContain('pending');
    });
});
