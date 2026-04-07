import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUploadService } from '../../src/services/FileUploadService.js';

describe('FileUploadService src-only contract', () => {
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

    it('accepts file upload with external data.url and returns src', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    url: 'https://cdn.futurello.futurebim.ru/files/2026/04/spec.pdf',
                    size: 123,
                    name: 'doc.pdf',
                    mime_type: 'application/pdf',
                },
            }),
        });

        const file = new Blob(['pdf-data'], { type: 'application/pdf' });
        const result = await service.uploadFile(file, 'doc.pdf');
        expect(result).toEqual({
            src: 'https://cdn.futurello.futurebim.ru/files/2026/04/spec.pdf',
            size: 123,
            name: 'doc.pdf',
            mimeType: 'application/pdf',
        });
    });

    it('accepts relative data.url from backend', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    url: '/storage/files/spec.pdf',
                    size: 123,
                    name: 'doc.pdf',
                    mime_type: 'application/pdf',
                },
            }),
        });

        const file = new Blob(['pdf-data'], { type: 'application/pdf' });
        const result = await service.uploadFile(file, 'doc.pdf');

        expect(result.src).toBe('/storage/files/spec.pdf');
    });

    it('throws when upload response has no data.url', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    url: '',
                    size: 123,
                    name: 'doc.pdf',
                    mime_type: 'application/pdf',
                },
            }),
        });

        const file = new Blob(['pdf-data'], { type: 'application/pdf' });
        await expect(service.uploadFile(file, 'doc.pdf')).rejects.toThrow('Сервер не вернул data.url');
    });
});

