import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AiClient } from '../../src/services/ai/AiClient.js';

/**
 * Минимальный fake-File: возвращает переданные байты через arrayBuffer(),
 * имитируя достаточно File API для filesToBase64.
 */
function makeFakeFile(content = 'img', type = 'image/png') {
    const bytes = new TextEncoder().encode(content);
    return {
        type,
        arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer),
    };
}

/** Оборачивает успешный ответ fetch. */
function okResponse(data) {
    return {
        ok: true,
        json: vi.fn().mockResolvedValue(data),
    };
}

/** Оборачивает ответ с HTTP-ошибкой. */
function errResponse(status = 422, body = '{"error":"bad input"}') {
    return {
        ok: false,
        status,
        statusText: 'Error',
        text: vi.fn().mockResolvedValue(body),
    };
}

describe('AiClient — методы 3D-модели', () => {
    let mockFetch;
    let client;

    beforeEach(() => {
        mockFetch = vi.fn();
        client = new AiClient({ fetchImpl: mockFetch });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ─── submit3dModel ──────────────────────────────────────────────────────────

    describe('submit3dModel', () => {
        it('mode="text" — body содержит prompt, нет image/multiViewImages', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'j1' }));

            await client.submit3dModel({ mode: 'text', prompt: 'a robot', downloadFormat: 'glb' });

            const [url, opts] = mockFetch.mock.calls[0];
            const body = JSON.parse(opts.body);

            expect(url).toContain('/model3d');
            expect(opts.method).toBe('POST');
            expect(body.mode).toBe('text');
            expect(body.prompt).toBe('a robot');
            expect(body.image).toBeUndefined();
            expect(body.multiViewImages).toBeUndefined();
        });

        it('mode="image" — body содержит image{mimeType,data}, нет prompt', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'j2' }));
            const file = makeFakeFile('imgbytes', 'image/jpeg');

            await client.submit3dModel({ mode: 'image', image: file, downloadFormat: 'glb' });

            const [, opts] = mockFetch.mock.calls[0];
            const body = JSON.parse(opts.body);

            expect(body.mode).toBe('image');
            expect(body.image).toBeDefined();
            expect(body.image.mimeType).toBe('image/jpeg');
            expect(typeof body.image.data).toBe('string');
            expect(body.image.data.length).toBeGreaterThan(0);
            expect(body.prompt).toBeUndefined();
            expect(body.multiViewImages).toBeUndefined();
        });

        it('mode="multi" — body содержит multiViewImages[{mimeType,data,viewType}], нет prompt/image', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'j3' }));
            const file = makeFakeFile('frontbytes', 'image/png');

            await client.submit3dModel({
                mode: 'multi',
                multiViewImages: [{ file, viewType: 'front' }],
                downloadFormat: 'fbx',
            });

            const [, opts] = mockFetch.mock.calls[0];
            const body = JSON.parse(opts.body);

            expect(body.mode).toBe('multi');
            expect(Array.isArray(body.multiViewImages)).toBe(true);
            expect(body.multiViewImages).toHaveLength(1);
            expect(body.multiViewImages[0].viewType).toBe('front');
            expect(body.multiViewImages[0].mimeType).toBe('image/png');
            expect(typeof body.multiViewImages[0].data).toBe('string');
            expect(body.image).toBeUndefined();
            expect(body.prompt).toBeUndefined();
        });

        it('downloadFormat всегда присутствует в body', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'j4' }));

            await client.submit3dModel({ mode: 'text', prompt: 'x', downloadFormat: 'stl' });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.downloadFormat).toBe('stl');
        });

        it('model по умолчанию "3.1"', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'j5' }));

            await client.submit3dModel({ mode: 'text', prompt: 'x', downloadFormat: 'glb' });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.model).toBe('3.1');
        });

        it('HTTP-ошибка — выбрасывает с кодом статуса', async () => {
            mockFetch.mockResolvedValueOnce(errResponse(422));

            await expect(
                client.submit3dModel({ mode: 'text', prompt: 'x', downloadFormat: 'glb' })
            ).rejects.toThrow('422');
        });
    });

    // ─── poll3dModel ────────────────────────────────────────────────────────────

    describe('poll3dModel', () => {
        it('добавляет ?format= в URL если format передан', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ status: 'running' }));

            await client.poll3dModel('job-123', undefined, 'hunyuan-3d', 'fbx');

            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/model3d/job-123?format=fbx');
        });

        it('не добавляет ?format= если format не передан', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ status: 'running' }));

            await client.poll3dModel('job-123', undefined, 'hunyuan-3d');

            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/model3d/job-123');
            expect(url).not.toContain('?format=');
        });

        it('HTTP-ошибка — выбрасывает', async () => {
            mockFetch.mockResolvedValueOnce(errResponse(500, '{}'));

            await expect(
                client.poll3dModel('job-123', undefined, 'hunyuan-3d', 'glb')
            ).rejects.toThrow('500');
        });
    });

    // ─── submitConvert3d ────────────────────────────────────────────────────────

    describe('submitConvert3d', () => {
        it('POST /convert3d с glbUrl и format', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'conv-1' }));

            const result = await client.submitConvert3d({ glbUrl: '/models/gen.glb', format: 'fbx' });

            const [url, opts] = mockFetch.mock.calls[0];
            const body = JSON.parse(opts.body);

            expect(url).toContain('/convert3d');
            expect(opts.method).toBe('POST');
            expect(body.glbUrl).toBe('/models/gen.glb');
            expect(body.format).toBe('fbx');
            expect(result.jobId).toBe('conv-1');
        });

        it('HTTP-ошибка — выбрасывает', async () => {
            mockFetch.mockResolvedValueOnce(errResponse(503, '{}'));

            await expect(
                client.submitConvert3d({ glbUrl: '/x.glb', format: 'fbx' })
            ).rejects.toThrow('503');
        });
    });

    // ─── pollConvert3d ──────────────────────────────────────────────────────────

    describe('pollConvert3d', () => {
        it('добавляет ?format= в URL если format передан', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ status: 'running' }));

            await client.pollConvert3d('conv-123', undefined, 'fbx');

            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/convert3d/conv-123?format=fbx');
        });

        it('не добавляет ?format= если format не передан', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ status: 'done' }));

            await client.pollConvert3d('conv-123');

            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('/convert3d/conv-123');
            expect(url).not.toContain('?format=');
        });
    });

    // ─── негатив: конфликт mode + payload ──────────────────────────────────────

    describe('негатив — одновременно prompt и image', () => {
        it('mode="image" c prompt+image — в body нет prompt (mode выбирает ветку)', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'j' }));
            const file = makeFakeFile();

            await client.submit3dModel({
                mode: 'image',
                prompt: 'ignored',
                image: file,
                downloadFormat: 'glb',
            });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            // mode='image' → ветка else: только image, prompt не пишется
            expect(body.image).toBeDefined();
            expect(body.prompt).toBeUndefined();
        });

        it('mode="text" c prompt+image — в body нет image', async () => {
            mockFetch.mockResolvedValueOnce(okResponse({ jobId: 'j' }));
            const file = makeFakeFile();

            await client.submit3dModel({
                mode: 'text',
                prompt: 'a cat',
                image: file,
                downloadFormat: 'glb',
            });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            // mode='text' → ветка if: только prompt, image не пишется
            expect(body.prompt).toBe('a cat');
            expect(body.image).toBeUndefined();
        });
    });
});
