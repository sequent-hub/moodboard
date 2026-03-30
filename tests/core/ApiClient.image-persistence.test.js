import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient } from '../../src/core/ApiClient.js';

describe('ApiClient - image persistence safety', () => {
    let client;
    let originalFetch;
    let consoleLogSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        client = new ApiClient();
        originalFetch = global.fetch;
        global.fetch = vi.fn();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        global.fetch = originalFetch;
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('cleanObjectData удаляет src только если есть imageId', () => {
        const boardData = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    imageId: 'img-remote-1',
                    src: '/api/images/img-remote-1/file',
                    properties: {
                        src: '/api/images/img-remote-1/file',
                        width: 300,
                        height: 200,
                    },
                },
            ],
        };

        const cleaned = client._cleanObjectData(boardData);
        const image = cleaned.objects[0];

        expect(image.imageId).toBe('img-remote-1');
        expect(image.src).toBeUndefined();
        expect(image.properties.src).toBeUndefined();
        expect(image.properties.width).toBe(300);
    });

    it('cleanObjectData не удаляет src если imageId отсутствует', () => {
        const boardData = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-local-1',
                    type: 'image',
                    src: 'data:image/png;base64,AAAA',
                    properties: {
                        src: 'data:image/png;base64,AAAA',
                        width: 200,
                        height: 100,
                    },
                },
            ],
        };

        const cleaned = client._cleanObjectData(boardData);
        const image = cleaned.objects[0];

        expect(image.imageId).toBeUndefined();
        expect(image.src).toBe('data:image/png;base64,AAAA');
        expect(image.properties.src).toBe('data:image/png;base64,AAAA');
    });

    it('saveBoard отправляет imageId в payload и не теряет image объект', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ success: true }),
        });

        const board = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    imageId: 'img-remote-1',
                    src: '/api/images/img-remote-1/file',
                    properties: {
                        src: '/api/images/img-remote-1/file',
                        width: 300,
                        height: 200,
                    },
                },
                {
                    id: 'note-1',
                    type: 'note',
                    properties: { content: 'hello' },
                },
            ],
        };

        await client.saveBoard('board-1', board);

        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch.mock.calls[0][0]).toBe('/api/v2/moodboard/metadata/save');
        expect(global.fetch.mock.calls[1][0]).toBe('/api/v2/moodboard/history/save');

        const [, historyRequest] = global.fetch.mock.calls[1];
        const historyBody = JSON.parse(historyRequest.body);
        const savedImage = historyBody.state.objects.find((o) => o.id === 'img-1');

        expect(savedImage).toBeDefined();
        expect(savedImage.type).toBe('image');
        expect(savedImage.imageId).toBe('img-remote-1');
        expect(savedImage.src).toBeUndefined();
        expect(savedImage.properties.src).toBeUndefined();
    });

    it('restoreObjectUrls восстанавливает src из imageId после загрузки', async () => {
        const boardData = {
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    imageId: 'img-remote-1',
                    properties: { width: 300, height: 200 },
                },
            ],
        };

        const restored = await client.restoreObjectUrls(boardData);
        const image = restored.objects[0];

        expect(image.src).toBe('/api/images/img-remote-1/file');
        expect(image.properties.src).toBe('/api/images/img-remote-1/file');
        expect(image.imageId).toBe('img-remote-1');
    });

    it('restoreObjectUrls не перезаписывает существующий src', async () => {
        const boardData = {
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    imageId: 'img-remote-1',
                    src: 'data:image/png;base64,AAAA',
                    properties: { src: 'data:image/png;base64,AAAA' },
                },
            ],
        };

        const restored = await client.restoreObjectUrls(boardData);
        const image = restored.objects[0];

        expect(image.src).toBe('data:image/png;base64,AAAA');
        expect(image.properties.src).toBe('data:image/png;base64,AAAA');
    });
});
