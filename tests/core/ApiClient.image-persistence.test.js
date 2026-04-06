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

    it('cleanObjectData сохраняет src на верхнем уровне и убирает properties.src', () => {
        const boardData = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    src: '/api/v2/images/img-remote-1/download',
                    properties: {
                        src: '/api/v2/images/img-remote-1/download',
                        width: 300,
                        height: 200,
                    },
                },
            ],
        };

        const cleaned = client._cleanObjectData(boardData);
        const image = cleaned.objects[0];

        expect(image.src).toBe('/api/v2/images/img-remote-1/download');
        expect(image.properties.src).toBeUndefined();
        expect(image.properties.width).toBe(300);
    });

    it('cleanObjectData не блокирует image без src (broken placeholder)', () => {
        const boardData = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-local-1',
                    type: 'image',
                    properties: {
                        width: 200,
                        height: 100,
                    },
                },
            ],
        };

        const cleaned = client._cleanObjectData(boardData);
        const image = cleaned.objects[0];
        expect(image).toBeDefined();
        expect(image.id).toBe('img-local-1');
        expect(image.type).toBe('image');
        expect(image.src).toBeUndefined();
    });

    it('cleanObjectData блокирует image с blob/data src', () => {
        const boardData = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-blob-1',
                    type: 'image',
                    src: 'blob://temporary-image',
                    properties: {
                        src: 'blob://temporary-image',
                        width: 200,
                        height: 100,
                    },
                },
            ],
        };

        expect(() => client._cleanObjectData(boardData)).toThrow('forbidden data/blob src');
    });

    it('cleanObjectData блокирует image с legacy src без /api/v2', () => {
        const boardData = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-legacy-1',
                    type: 'image',
                    src: '/api/images/img-legacy-1/file',
                    properties: {
                        src: '/api/images/img-legacy-1/file',
                        width: 200,
                        height: 100,
                    },
                },
            ],
        };

        expect(() => client._cleanObjectData(boardData)).toThrow('legacy src URL');
    });

    it('saveBoard отправляет src в payload и не теряет image объект', async () => {
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
                    src: '/api/v2/images/img-remote-1/download',
                    properties: {
                        src: '/api/v2/images/img-remote-1/download',
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
        expect(savedImage.src).toBe('/api/v2/images/img-remote-1/download');
        expect(savedImage.properties.src).toBeUndefined();
    });

    it('saveBoard не отбрасывает image без src и сохраняет рядом валидные image', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ success: true }),
        });

        const board = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-broken',
                    type: 'image',
                    properties: {
                        width: 300,
                        height: 200,
                    },
                },
                {
                    id: 'img-valid',
                    type: 'image',
                    src: '/api/v2/images/img-valid/download',
                    properties: {
                        src: '/api/v2/images/img-valid/download',
                        width: 300,
                        height: 200,
                    },
                },
            ],
        };

        await client.saveBoard('board-1', board);

        const [, historyRequest] = global.fetch.mock.calls[1];
        const historyBody = JSON.parse(historyRequest.body);
        const broken = historyBody.state.objects.find((o) => o.id === 'img-broken');
        const valid = historyBody.state.objects.find((o) => o.id === 'img-valid');

        expect(broken).toBeDefined();
        expect(broken.src).toBeUndefined();
        expect(valid).toBeDefined();
        expect(valid.src).toBe('/api/v2/images/img-valid/download');
    });

    it('saveBoard блокирует отправку, если image содержит data/blob src', async () => {
        const board = {
            id: 'board-1',
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    properties: {
                        src: 'data:image/png;base64,AAAA',
                        width: 300,
                        height: 200,
                    },
                },
            ],
        };

        await expect(client.saveBoard('board-1', board)).rejects.toThrow('forbidden data/blob src');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('restoreObjectUrls нормализует src из properties.src', async () => {
        const boardData = {
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    properties: { width: 300, height: 200, src: '/cdn/yandex/img-1.png' },
                },
            ],
        };

        const restored = await client.restoreObjectUrls(boardData);
        const image = restored.objects[0];

        expect(image.src).toBe('/cdn/yandex/img-1.png');
        expect(image.properties.src).toBeUndefined();
    });

    it('restoreObjectUrls сохраняет текущий src и удаляет properties.src', async () => {
        const boardData = {
            objects: [
                {
                    id: 'img-1',
                    type: 'image',
                    src: 'data:image/png;base64,AAAA',
                    properties: { src: 'data:image/png;base64,AAAA' },
                },
            ],
        };

        const restored = await client.restoreObjectUrls(boardData);
        const image = restored.objects[0];

        expect(image.src).toBe('data:image/png;base64,AAAA');
        expect(image.properties.src).toBeUndefined();
    });
});
