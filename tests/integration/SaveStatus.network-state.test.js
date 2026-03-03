import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../../src/core/SaveManager.js';
import { SaveStatus } from '../../src/ui/SaveStatus.js';
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

describe('Integration: SaveManager + SaveStatus при сетевых сценариях', () => {
    let eventBus;
    let manager;
    let status;
    let container;
    let apiClient;
    let consoleErrorSpy;
    let consoleLogSpy;
    const boardData = { id: 'board-1', objects: [{ id: 'img-1', type: 'image' }] };

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus = createEventBus();
        manager = new SaveManager(eventBus);
        manager.options.maxRetries = 1;
        manager.options.retryDelay = 50;

        container = document.createElement('div');
        document.body.appendChild(container);
        status = new SaveStatus(container, eventBus, { autoHide: false });

        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        apiClient = { saveBoard: vi.fn() };
        manager.setApiClient(apiClient);
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        manager.options.autoSave = false;
        manager.hasUnsavedChanges = false;
        manager.destroy();
        status.destroy();
        container.remove();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('при успешном save индикатор доходит до "Сохранено" и hasUnsavedChanges=false', async () => {
        apiClient.saveBoard.mockResolvedValue({ success: true, data: { ok: true } });

        manager.markAsChanged();
        expect(container.querySelector('.save-text')?.textContent).toBe('Изменения...');

        await manager.saveImmediately();
        expect(container.querySelector('.save-text')?.textContent).toBe('Сохранено');

        const statusEvents = eventBus.emit.mock.calls
            .filter((call) => call[0] === Events.Save.StatusChanged)
            .map((call) => call[1]);
        const last = statusEvents[statusEvents.length - 1];
        expect(last.status).toBe('saved');
        expect(last.hasUnsavedChanges).toBe(false);
    });

    it('при timeout save индикатор показывает ошибку и hasUnsavedChanges остается true', async () => {
        apiClient.saveBoard.mockRejectedValue(new Error('net::ERR_CONNECTION_TIMED_OUT'));

        manager.markAsChanged();
        await manager.saveImmediately();

        expect(container.querySelector('.save-text')?.textContent).toContain('ERR_CONNECTION_TIMED_OUT');

        const statusEvents = eventBus.emit.mock.calls
            .filter((call) => call[0] === Events.Save.StatusChanged)
            .map((call) => call[1]);
        const last = statusEvents[statusEvents.length - 1];
        expect(last.status).toBe('error');
        expect(last.hasUnsavedChanges).toBe(true);
    });
});
