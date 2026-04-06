import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { setupClipboardFlow } from '../../src/core/flows/ClipboardFlow.js';
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

describe('Integration: image drop -> close/reopen guard', () => {
    let eventBus;
    let saveManager;
    let toolManager;
    let container;
    let core;
    let localBoardState;
    let serverSnapshot;
    let saveErrors;
    let alertSpy;
    let originalImage;
    let apiClient;

    beforeEach(() => {
        vi.useFakeTimers();
        originalImage = global.Image;
        global.Image = class {
            constructor() {
                this.onload = null;
                this.onerror = null;
                this.naturalWidth = 1000;
                this.naturalHeight = 500;
            }
            set src(_value) {
                if (this.onload) this.onload();
            }
        };

        eventBus = createEventBus();
        localBoardState = { id: 'mb-1', objects: [] };
        serverSnapshot = { id: 'mb-1', objects: [] };
        saveErrors = [];
        alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});

        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0 }));

        core = {
            eventBus,
            imageUploadService: {
                uploadImage: vi.fn().mockResolvedValue({
                    url: '/api/v2/images/img-remote-1/download',
                    name: 'dropped.png',
                }),
            },
            pixi: {
                app: { stage: {}, view: { clientWidth: 1200, clientHeight: 800 } },
                worldLayer: { x: 0, y: 0, scale: { x: 1 } },
            },
            state: { state: { objects: [] } },
            history: { executeCommand: vi.fn() },
            toolManager: { getActiveTool: vi.fn(() => null) },
            selectTool: null,
            createObject: vi.fn((type, position, properties, extraData = {}) => {
                const obj = {
                    id: `img-${localBoardState.objects.length + 1}`,
                    type,
                    position,
                    src: properties?.src || null,
                    properties: { ...properties },
                };
                localBoardState.objects.push(obj);
                return obj;
            }),
        };

        setupClipboardFlow(core);

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
        alertSpy.mockRestore();
        global.Image = originalImage;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('при падении save после успешного drop пользователь получает save:error, а reopen не содержит картинку', async () => {
        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'dropped.png';

        await toolManager.handleDrop({
            preventDefault: vi.fn(),
            clientX: 320,
            clientY: 240,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        });

        await vi.waitFor(() => {
            expect(localBoardState.objects).toHaveLength(1);
        });

        // Пользователь видит картинку локально.
        expect(localBoardState.objects[0]).toEqual(
            expect.objectContaining({
                type: 'image',
                src: '/api/v2/images/img-remote-1/download',
                properties: expect.objectContaining({
                    src: '/api/v2/images/img-remote-1/download',
                }),
            })
        );

        // Но сохранение истории не удалось.
        saveManager.hasUnsavedChanges = true;
        await saveManager.saveImmediately();

        expect(apiClient.saveBoard).toHaveBeenCalledTimes(1);
        expect(saveErrors).toHaveLength(1);
        expect(saveManager.getStatus().saveStatus).toBe('error');

        // Симуляция "закрыли и открыли доску": серверный snapshot пустой, картинка не восстановится.
        const reopenedBoard = clone(serverSnapshot);
        expect(reopenedBoard.objects).toHaveLength(0);
    });
});
