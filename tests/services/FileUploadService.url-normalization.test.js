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
});

