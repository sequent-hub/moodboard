import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUploadService } from '../../src/services/FileUploadService.js';

describe('FileUploadService URL normalization', () => {
    let service;
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = vi.fn();
        service = new FileUploadService(null, { csrfToken: 'token-1' });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('throws when upload response has legacy non-v2 file url', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    fileId: 'file-1',
                    url: '/api/files/file-1/download',
                    size: 123,
                    name: 'doc.pdf',
                    type: 'application/pdf',
                },
            }),
        });

        const file = new Blob(['pdf-data'], { type: 'application/pdf' });
        await expect(service.uploadFile(file, 'doc.pdf')).rejects.toThrow('Некорректный URL файла');
    });

    it('accepts absolute v2 file url from backend', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    fileId: 'file-abs-1',
                    url: 'https://dev.futurello.futurebim.ru/api/v2/files/file-abs-1/download',
                    size: 123,
                    name: 'doc.pdf',
                    type: 'application/pdf',
                },
            }),
        });

        const file = new Blob(['pdf-data'], { type: 'application/pdf' });
        const result = await service.uploadFile(file, 'doc.pdf');

        expect(result.fileId).toBe('file-abs-1');
        expect(result.url).toBe('https://dev.futurello.futurebim.ru/api/v2/files/file-abs-1/download');
    });

    it('throws when upload response has invalid file url and no fileId', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    id: null,
                    url: 'https://example.com/file.pdf',
                    size: 123,
                    name: 'doc.pdf',
                    type: 'application/pdf',
                },
            }),
        });

        const file = new Blob(['pdf-data'], { type: 'application/pdf' });
        await expect(service.uploadFile(file, 'doc.pdf')).rejects.toThrow('Сервер не вернул fileId');
    });

    it('throws when fileId does not match id inside URL', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    fileId: 'file-1',
                    url: '/api/v2/files/file-2/download',
                    size: 123,
                    name: 'doc.pdf',
                    type: 'application/pdf',
                },
            }),
        });

        const file = new Blob(['pdf-data'], { type: 'application/pdf' });
        await expect(service.uploadFile(file, 'doc.pdf')).rejects.toThrow('fileId не совпадает');
    });
});

