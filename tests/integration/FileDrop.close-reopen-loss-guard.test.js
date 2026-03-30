import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { SaveManager } from '../../src/core/SaveManager.js';

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

import { ToolManager } from '../../src/tools/ToolManager.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        off: vi.fn((event, handler) => {
            const list = handlers.get(event) || [];
            handlers.set(event, list.filter((h) => h !== handler));
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

describe('Integration: file drop -> close/reopen guard', () => {
    let eventBus;
    let saveManager;
    let toolManager;
    let container;
    let core;
    let localBoardState;
    let serverSnapshot;
    let saveErrors;
    let apiClient;

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus = createEventBus();
        localBoardState = { id: 'mb-1', objects: [] };
        serverSnapshot = { id: 'mb-1', objects: [] };
        saveErrors = [];

        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0 }));

        core = {
            fileUploadService: {
                uploadFile: vi.fn().mockResolvedValue({
                    id: 'file-1',
                    fileId: 'file-1',
                    name: 'report.pdf',
                    size: 123,
                    mimeType: 'application/pdf',
                    formattedSize: '123 B',
                    url: '/api/v2/files/file-1/download',
                }),
            },
            pixi: {
                worldLayer: { x: 0, y: 0, scale: { x: 1 } },
            },
        };

        // Имитируем маршрут UI.ToolbarAction -> createObject(file)
        eventBus.on(Events.UI.ToolbarAction, (action) => {
            if (action?.type !== 'file') return;
            localBoardState.objects.push({
                id: `file-${localBoardState.objects.length + 1}`,
                type: 'file',
                fileId: action.fileId || null,
                properties: { ...(action.properties || {}) },
            });
        });

        saveManager = new SaveManager(eventBus);
        saveManager.options.maxRetries = 1;
        saveManager.options.retryDelay = 10;

        apiClient = {
            saveBoard: vi.fn().mockRejectedValue(new Error('save failed')),
        };
        saveManager.setApiClient(apiClient);

        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = clone(localBoardState);
        });
        eventBus.on(Events.Save.Error, (payload) => {
            saveErrors.push(payload);
        });

        toolManager = new ToolManager(eventBus, container, null, core);
    });

    afterEach(() => {
        toolManager?.destroy();
        saveManager?.destroy();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('при падении save после успешного file drop есть save:error, а reopen не содержит файл', async () => {
        const file = new Blob(['pdf'], { type: 'application/pdf' });
        file.name = 'report.pdf';

        await toolManager.handleDrop({
            preventDefault: vi.fn(),
            clientX: 320,
            clientY: 240,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        });

        expect(localBoardState.objects).toHaveLength(1);
        expect(localBoardState.objects[0]).toEqual(
            expect.objectContaining({
                type: 'file',
                fileId: 'file-1',
                properties: expect.objectContaining({
                    url: '/api/v2/files/file-1/download',
                }),
            })
        );

        saveManager.hasUnsavedChanges = true;
        await saveManager.saveImmediately();

        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
        expect(saveErrors).toHaveLength(1);
        expect(saveManager.getStatus().saveStatus).toBe('error');

        const reopenedBoard = clone(serverSnapshot);
        expect(reopenedBoard.objects).toHaveLength(0);
    });
});
