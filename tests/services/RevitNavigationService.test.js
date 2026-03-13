import { afterEach, describe, expect, it, vi } from 'vitest';
import { RevitNavigationService } from '../../src/services/RevitNavigationService.js';

describe('RevitNavigationService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stops on first successful localhost port', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => 'ok'
            });
        vi.stubGlobal('fetch', fetchMock);

        const service = new RevitNavigationService({ info: () => {} }, {
            portStart: 11210,
            portEnd: 11212,
            requestTimeoutMs: 50
        });

        const result = await service.showInModel('{"view":"1"}', { source: 'test' });
        expect(result.ok).toBe(true);
        expect(result.port).toBe(11211);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns failure when payload is empty', async () => {
        const service = new RevitNavigationService({ info: () => {} });
        const result = await service.showInModel('', { source: 'test' });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('invalid-payload');
    });
});

