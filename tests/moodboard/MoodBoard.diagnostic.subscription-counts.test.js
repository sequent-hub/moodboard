import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Events } from '../../src/core/events/Events.js';
import {
    createMoodBoard,
    resetMoodBoardTestState,
    settleMoodBoard,
    setupMoodBoardDom,
} from './MoodBoard.baseline.helpers.js';

function getHandlerCount(board, eventName) {
    return board.coreMoodboard.eventBus.handlers.get(eventName)?.length || 0;
}

describe('MoodBoard diagnostic: event subscription counts', () => {
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

    it('registers one handler per wired event on init', async () => {
        board = createMoodBoard(container, {
            autoLoad: false,
            onSave: vi.fn(),
        });

        await settleMoodBoard(board);

        expect(getHandlerCount(board, Events.UI.ToolbarAction)).toBe(1);
        expect(getHandlerCount(board, Events.UI.PaintPick)).toBe(1);
        expect(getHandlerCount(board, 'save:success')).toBe(1);
        expect(getHandlerCount(board, 'save:error')).toBe(1);
    });

    it('keeps per-instance subscription counts stable across destroy and recreate lifecycle', async () => {
        board = createMoodBoard(container, {
            autoLoad: false,
            onSave: vi.fn(),
        });

        await settleMoodBoard(board);

        expect(getHandlerCount(board, Events.UI.ToolbarAction)).toBe(1);
        expect(getHandlerCount(board, Events.UI.PaintPick)).toBe(1);
        expect(getHandlerCount(board, 'save:success')).toBe(1);
        expect(getHandlerCount(board, 'save:error')).toBe(1);

        board.destroy();

        board = createMoodBoard(container, {
            autoLoad: false,
            onSave: vi.fn(),
        });

        await settleMoodBoard(board);

        expect(getHandlerCount(board, Events.UI.ToolbarAction)).toBe(1);
        expect(getHandlerCount(board, Events.UI.PaintPick)).toBe(1);
        expect(getHandlerCount(board, 'save:success')).toBe(1);
        expect(getHandlerCount(board, 'save:error')).toBe(1);
    });
});
