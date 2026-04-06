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

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

describe('Integration: image persistence при сетевых сбоях', () => {
    let boardState;
    let serverSnapshot;
    let manager;
    let eventBus;
    let apiClient;
    let consoleErrorSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        boardState = { id: 'board-1', objects: [] };
        serverSnapshot = { id: 'board-1', objects: [] };

        eventBus = createEventBus();
        manager = new SaveManager(eventBus);
        manager.options.maxRetries = 1;
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = clone(boardState);
        });

        apiClient = {
            saveBoard: vi.fn().mockImplementation(async (_boardId, payload) => {
                serverSnapshot = clone(payload);
                return { success: true };
            }),
        };
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

    it('локально изображение видно, но после reopen пропадает при timeout save', async () => {
        boardState.objects.push({
            id: 'img-local',
            type: 'image',
            src: 'data:image/png;base64,AAAA',
            properties: { width: 300, height: 200 },
        });

        manager.hasUnsavedChanges = true;
        apiClient.saveBoard.mockRejectedValue(new Error('net::ERR_CONNECTION_TIMED_OUT'));

        await manager.saveImmediately();

        expect(boardState.objects).toHaveLength(1); // локально отрисовано
        expect(serverSnapshot.objects).toHaveLength(0); // сервер не обновлен

        const reopenedBoard = clone(serverSnapshot);
        expect(reopenedBoard.objects).toHaveLength(0); // после переоткрытия исчезает
    });

    it('после успешного save изображение остается после reopen', async () => {
        boardState.objects.push({
            id: 'img-local',
            type: 'image',
            src: '/api/v2/images/img-remote-1/download',
            properties: { width: 300, height: 200 },
        });

        manager.hasUnsavedChanges = true;
        await manager.saveImmediately();

        const reopenedBoard = clone(serverSnapshot);
        expect(reopenedBoard.objects).toHaveLength(1);
        expect(reopenedBoard.objects[0].id).toBe('img-local');
        expect(reopenedBoard.objects[0].type).toBe('image');
    });
});
