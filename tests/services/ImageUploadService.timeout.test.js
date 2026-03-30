import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageUploadService } from '../../src/services/ImageUploadService.js';

describe('ImageUploadService - таймауты и ошибки загрузки', () => {
    let service;
    let originalFetch;
    let consoleErrorSpy;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = vi.fn();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        service = new ImageUploadService(null, { csrfToken: 'token-1' });
        vi.spyOn(service, '_getImageDimensions').mockResolvedValue({ width: 910, height: 617 });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('пробрасывает timeout-ошибку fetch при uploadImage', async () => {
        const timeoutError = new TypeError('net::ERR_CONNECTION_TIMED_OUT');
        global.fetch.mockRejectedValue(timeoutError);

        const file = new Blob(['png-data'], { type: 'image/png' });

        await expect(service.uploadImage(file, 'special.png')).rejects.toThrow('ERR_CONNECTION_TIMED_OUT');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            '/api/v2/images/upload',
            expect.objectContaining({
                method: 'POST',
                credentials: 'same-origin',
                headers: expect.objectContaining({
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': 'token-1',
                }),
            })
        );
    });

    it('возвращает сообщение сервера при неуспешном HTTP ответе', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 422,
            statusText: 'Unprocessable Entity',
            json: vi.fn().mockResolvedValue({ message: 'Файл не прошел валидацию' }),
        });

        const file = new Blob(['png-data'], { type: 'image/png' });

        await expect(service.uploadImage(file, 'special.png')).rejects.toThrow('Файл не прошел валидацию');
    });

    it('останавливает загрузку если CSRF обязателен и отсутствует', async () => {
        const noCsrfService = new ImageUploadService(null, { requireCsrf: true });
        vi.spyOn(noCsrfService, '_getImageDimensions').mockResolvedValue({ width: 100, height: 100 });

        const file = new Blob(['png-data'], { type: 'image/png' });

        await expect(noCsrfService.uploadImage(file, 'no-csrf.png')).rejects.toThrow('CSRF токен не найден');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('корректно принимает успешный ответ с imageId', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    imageId: 'img-1',
                    url: '/api/v2/images/img-1/download',
                    width: 910,
                    height: 617,
                    name: 'special.png',
                    size: 470515,
                },
            }),
        });

        const file = new Blob(['png-data'], { type: 'image/png' });
        const result = await service.uploadImage(file, 'special.png');

        expect(result).toEqual({
            id: 'img-1',
            imageId: 'img-1',
            url: '/api/v2/images/img-1/download',
            width: 910,
            height: 617,
            name: 'special.png',
            size: 470515,
        });
    });
});
