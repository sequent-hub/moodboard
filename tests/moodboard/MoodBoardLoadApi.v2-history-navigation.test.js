import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadExistingBoard } from '../../src/moodboard/integration/MoodBoardLoadApi.js';

function createBoard(overrides = {}) {
    return {
        options: {
            boardId: 'mb-1',
            apiUrl: '/api/v2/moodboard',
            onLoad: vi.fn(),
            ...overrides.options,
        },
        data: { objects: [] },
        dataManager: {
            loadData: vi.fn(),
        },
        coreMoodboard: {
            eventBus: {
                emit: vi.fn(),
            },
        },
        ...overrides,
    };
}

describe('MoodBoardLoadApi v2 history navigation', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('грузит latest версию по /api/v2/moodboard/{id} и выставляет head/cursor', async () => {
        const board = createBoard();
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    moodboardId: 'mb-1',
                    version: 4,
                    settings: { backgroundColor: '#fff' },
                    state: { objects: [{ id: 'n1', type: 'note' }] },
                },
            }),
        });

        await loadExistingBoard(board);

        expect(global.fetch).toHaveBeenCalledWith('/api/v2/moodboard/mb-1', expect.any(Object));
        expect(board.currentLoadedVersion).toBe(4);
        expect(board.historyCursorVersion).toBe(4);
        expect(board.historyHeadVersion).toBe(4);
        expect(board.dataManager.loadData).toHaveBeenCalledWith(
            expect.objectContaining({
                objects: [{ id: 'n1', type: 'note' }],
                meta: { allowEmptyLoad: true },
                version: 4,
            })
        );
    });

    it('грузит конкретную версию по /api/v2/moodboard/{id}/{version}', async () => {
        const board = createBoard();
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    moodboardId: 'mb-1',
                    version: 2,
                    settings: {},
                    state: { objects: [] },
                },
            }),
        });

        await loadExistingBoard(board, 2);

        expect(global.fetch).toHaveBeenCalledWith('/api/v2/moodboard/mb-1/2', expect.any(Object));
        expect(board.currentLoadedVersion).toBe(2);
        expect(board.historyCursorVersion).toBe(2);
    });

    it('при historyNavigation=true обновляет только cursor, сохраняя head', async () => {
        const board = createBoard({
            historyHeadVersion: 7,
        });
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    moodboardId: 'mb-1',
                    version: 3,
                    settings: {},
                    state: { objects: [{ id: 'n3' }] },
                },
            }),
        });

        await loadExistingBoard(board, 3, { historyNavigation: true });

        expect(board.historyHeadVersion).toBe(7);
        expect(board.historyCursorVersion).toBe(3);
    });

    it('при fallbackToSeedOnError=false пробрасывает ошибку и не очищает доску', async () => {
        const board = createBoard();
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 405,
            statusText: 'Method Not Allowed',
        });

        await expect(loadExistingBoard(board, 22, { fallbackToSeedOnError: false })).rejects.toThrow('HTTP 405');
        expect(board.dataManager.loadData).not.toHaveBeenCalled();
    });

    it('грузит image-объекты из версии с сохранением src', async () => {
        const board = createBoard();
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    moodboardId: 'mb-1',
                    version: 9,
                    settings: {},
                    state: {
                        objects: [
                            {
                                id: 'img-1',
                                type: 'image',
                                src: '/api/v2/images/img-1-id/download',
                                properties: { width: 300, height: 200 },
                            },
                        ],
                    },
                },
            }),
        });

        await loadExistingBoard(board, 9, { historyNavigation: true });

        expect(board.dataManager.loadData).toHaveBeenCalledWith(
            expect.objectContaining({
                version: 9,
                objects: [
                    expect.objectContaining({
                        id: 'img-1',
                        type: 'image',
                        src: '/api/v2/images/img-1-id/download',
                    }),
                ],
            })
        );
        expect(board.historyHeadVersion).toBeUndefined();
        expect(board.historyCursorVersion).toBe(9);
    });
});
