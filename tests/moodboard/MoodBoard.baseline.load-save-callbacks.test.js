import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataManager } from '../../src/moodboard/DataManager.js';
import {
    createMoodBoard,
    lastCoreInstance,
    resetMoodBoardTestState,
    settleMoodBoard,
    setupMoodBoardDom,
} from './MoodBoard.baseline.helpers.js';

describe('MoodBoard baseline: auto-load and callback contracts', () => {
    let container;
    let board;

    beforeEach(() => {
        resetMoodBoardTestState();
        container = setupMoodBoardDom();
    });

    afterEach(() => {
        board?.destroy?.();
        container?.remove();
        window.moodboardHtmlTextLayer = null;
        window.moodboardHtmlHandlesLayer = null;
    });

    it('autoLoad without boardId or apiUrl loads seed data and calls onLoad success', async () => {
        const seedData = {
            objects: [{ id: 'seed-note-1', type: 'note', position: { x: 12, y: 18 }, properties: { content: 'seed' } }],
        };
        const onLoad = vi.fn();
        const loadDataSpy = vi.spyOn(DataManager.prototype, 'loadData');

        board = createMoodBoard(container, { autoLoad: true, apiUrl: null, onLoad }, seedData);
        await settleMoodBoard(board);

        expect(loadDataSpy).toHaveBeenCalledWith(seedData);
        expect(board.coreMoodboard.createObjectFromData).toHaveBeenCalledWith(seedData.objects[0]);
        expect(onLoad).toHaveBeenCalledWith({ success: true, data: seedData });
    });

    it('fetches existing board on init and preserves current success payload contract', async () => {
        const serverData = {
            objects: [{ id: 'server-text-1', type: 'text', position: { x: 30, y: 45 }, properties: { content: 'loaded' } }],
            settings: { backgroundColor: '#ffeeaa' },
        };
        const onLoad = vi.fn();
        const loadDataSpy = vi.spyOn(DataManager.prototype, 'loadData');

        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ data: serverData }),
        });

        board = createMoodBoard(container, {
            autoLoad: true,
            boardId: 'board-42',
            apiUrl: '/api/moodboard',
            onLoad,
        });

        await settleMoodBoard(board);

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/moodboard/load/board-42',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': '',
                }),
            })
        );
        expect(loadDataSpy).toHaveBeenCalledWith(serverData);
        expect(onLoad).toHaveBeenCalledWith({ success: true, data: serverData });
    });

    it('falls back to local data on load error without breaking init', async () => {
        const fallbackData = {
            objects: [{ id: 'fallback-1', type: 'note', position: { x: 1, y: 2 }, properties: { content: 'fallback' } }],
        };
        const onLoad = vi.fn();
        const loadDataSpy = vi.spyOn(DataManager.prototype, 'loadData');

        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Server Error',
        });

        board = createMoodBoard(container, {
            autoLoad: true,
            boardId: 'broken-board',
            apiUrl: '/api/moodboard',
            onLoad,
        }, fallbackData);

        await settleMoodBoard(board);

        expect(board.actionHandler).toBeTruthy();
        expect(loadDataSpy).toHaveBeenCalledWith(fallbackData);
        expect(onLoad).toHaveBeenCalledWith({
            success: false,
            error: 'HTTP 500: Server Error',
            data: fallbackData,
        });
    });

    it('keeps onSave callback payload shape for success and error events', async () => {
        const onSave = vi.fn();

        board = createMoodBoard(container, {
            autoLoad: false,
            boardId: 'save-board',
            onSave,
        });
        await settleMoodBoard(board);

        vi.spyOn(board, 'createCombinedScreenshot').mockReturnValue('data:image/jpeg;base64,combined-shot');

        const core = lastCoreInstance();
        core.eventBus.emit('save:success', { revision: 7 });
        core.eventBus.emit('save:error', { error: 'network timeout' });

        expect(onSave).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                success: true,
                data: { revision: 7 },
                screenshot: 'data:image/jpeg;base64,combined-shot',
                boardId: 'save-board',
            })
        );
        expect(onSave).toHaveBeenNthCalledWith(2, {
            success: false,
            error: 'network timeout',
            boardId: 'save-board',
        });
    });

    it('loadFromApi uses provided boardId for the request and restores original boardId', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ data: { objects: [] } }),
        });

        board = createMoodBoard(container, {
            autoLoad: false,
            boardId: 'original-board',
            apiUrl: '/api/moodboard',
        });
        await settleMoodBoard(board);

        global.fetch.mockClear();

        await board.loadFromApi('temporary-board');

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/moodboard/load/temporary-board',
            expect.any(Object)
        );
        expect(board.options.boardId).toBe('original-board');
    });
});
