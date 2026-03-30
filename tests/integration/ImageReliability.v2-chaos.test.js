import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardManager } from '../../src/core/KeyboardManager.js';
import { SaveManager } from '../../src/core/SaveManager.js';
import { ApiClient } from '../../src/core/ApiClient.js';
import { Events } from '../../src/core/events/Events.js';

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

describe('Integration: image reliability v2 chaos', () => {
    let eventBus;
    let keyboardManager;
    let saveManager;
    let boardState;
    let core;
    let targetElement;
    let apiClient;
    let serverSnapshot;
    let alertSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus = createEventBus();
        targetElement = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
        serverSnapshot = { id: 'mb-1', objects: [] };
        boardState = { id: 'mb-1', objects: [] };
        alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        core = {
            imageUploadService: {
                uploadImage: vi.fn(),
                uploadFromDataUrl: vi.fn(),
            },
        };
        keyboardManager = new KeyboardManager(eventBus, targetElement, core);
        saveManager = new SaveManager(eventBus);
        saveManager.options.maxRetries = 3;
        saveManager.options.retryDelay = 10;

        // Моделируем добавление объекта на доску после успешного server upload.
        eventBus.on(Events.UI.PasteImage, ({ src, name, imageId }) => {
            boardState.objects.push({
                id: `img-${boardState.objects.length + 1}`,
                type: 'image',
                imageId,
                properties: { src, name, width: 300, height: 200 },
            });
        });

        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = clone(boardState);
        });

        apiClient = {
            saveBoard: vi.fn(),
        };
        saveManager.setApiClient(apiClient);
    });

    afterEach(() => {
        saveManager.destroy();
        keyboardManager.destroy();
        alertSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('не добавляет картинку локально, если upload завершился ошибкой', async () => {
        core.imageUploadService.uploadImage.mockRejectedValue(new Error('network-fail'));

        await keyboardManager._handleImageFileUpload(new Blob(['img'], { type: 'image/png' }), 'broken.png');

        expect(boardState.objects).toHaveLength(0);
        expect(eventBus.emit).not.toHaveBeenCalledWith(Events.UI.PasteImage, expect.anything());
        expect(alertSpy).toHaveBeenCalledWith('Ошибка загрузки изображения на сервер. Изображение не добавлено.');
    });

    it('проходит chaos: upload fail -> upload success -> save retries -> reopen restore', async () => {
        // 1) Первая попытка upload падает: на доске ничего не появляется.
        core.imageUploadService.uploadImage
            .mockRejectedValueOnce(new Error('timeout-1'))
            .mockResolvedValueOnce({
                imageId: 'img-remote-77',
                id: 'img-remote-77',
                url: '/api/images/img-remote-77/file',
                name: 'stable.png',
            });

        await keyboardManager._handleImageFileUpload(new Blob(['img'], { type: 'image/png' }), 'stable.png');
        expect(boardState.objects).toHaveLength(0);

        // 2) Вторая попытка upload успешна: объект добавлен только с server URL + imageId.
        await keyboardManager._handleImageFileUpload(new Blob(['img'], { type: 'image/png' }), 'stable.png');
        expect(boardState.objects).toHaveLength(1);
        expect(boardState.objects[0]).toEqual(
            expect.objectContaining({
                type: 'image',
                imageId: 'img-remote-77',
                properties: expect.objectContaining({
                    src: '/api/images/img-remote-77/file',
                }),
            })
        );

        // 3) Save падает 2 раза, на 3-й попытке успешен (retry/ack path).
        apiClient.saveBoard
            .mockRejectedValueOnce(new Error('save-timeout-1'))
            .mockRejectedValueOnce(new Error('save-timeout-2'))
            .mockImplementationOnce(async (_boardId, payload) => {
                const first = payload.objects[0];
                // Эмулируем серверный снимок истории: хранит imageId, без inline src.
                serverSnapshot = {
                    id: payload.id,
                    objects: [
                        {
                            id: first.id,
                            type: 'image',
                            imageId: first.imageId,
                            properties: {
                                width: first.properties.width,
                                height: first.properties.height,
                                name: first.properties.name,
                            },
                        },
                    ],
                };
                return { success: true, data: { historyVersion: 7 } };
            });

        saveManager.hasUnsavedChanges = true;
        await saveManager.saveImmediately(); // attempt 1
        await vi.advanceTimersByTimeAsync(10); // attempt 2
        await vi.advanceTimersByTimeAsync(20); // attempt 3

        expect(apiClient.saveBoard).toHaveBeenCalledTimes(3);
        expect(serverSnapshot.objects).toHaveLength(1);
        expect(serverSnapshot.objects[0].imageId).toBe('img-remote-77');
        expect(serverSnapshot.objects[0].properties.src).toBeUndefined();

        // 4) Reopen: URL восстанавливается из imageId, картинка доступна после загрузки.
        const restorer = new ApiClient();
        const reopened = await restorer.restoreObjectUrls(clone(serverSnapshot));
        expect(reopened.objects).toHaveLength(1);
        expect(reopened.objects[0].imageId).toBe('img-remote-77');
        expect(reopened.objects[0].src).toBe('/api/images/img-remote-77/file');
        expect(reopened.objects[0].properties.src).toBe('/api/images/img-remote-77/file');
    });
});
