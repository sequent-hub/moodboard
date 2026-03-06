import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createMoodBoard,
    mockState,
    resetMoodBoardTestState,
    settleMoodBoard,
    setupMoodBoardDom,
} from './MoodBoard.baseline.helpers.js';

describe('MoodBoard baseline: destroy lifecycle contracts', () => {
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

    it('destroys created components, clears primary references and calls onDestroy once', async () => {
        const onDestroy = vi.fn();

        board = createMoodBoard(container, {
            autoLoad: false,
            onDestroy,
        });
        await settleMoodBoard(board);

        const workspaceDestroySpy = vi.spyOn(board.workspaceManager, 'destroy');
        const initialTextLayer = board.htmlTextLayer;
        const initialHandlesLayer = board.htmlHandlesLayer;

        expect(() => board.destroy()).not.toThrow();

        expect(board.destroyed).toBe(true);
        expect(board.toolbar).toBeNull();
        expect(board.saveStatus).toBeNull();
        expect(board.textPropertiesPanel).toBeNull();
        expect(board.framePropertiesPanel).toBeNull();
        expect(board.notePropertiesPanel).toBeNull();
        expect(board.alignmentGuides).toBeNull();
        expect(board.htmlTextLayer).toBeNull();
        expect(board.htmlHandlesLayer).toBeNull();
        expect(board.commentPopover).toBeNull();
        expect(board.contextMenu).toBeNull();
        expect(board.zoombar).toBeNull();
        expect(board.mapbar).toBeNull();
        expect(board.coreMoodboard).toBeNull();
        expect(board.workspaceManager).toBeNull();
        expect(board.dataManager).toBeNull();
        expect(board.actionHandler).toBeNull();
        expect(board.container).toBeNull();

        expect(container.classList.contains('moodboard-root')).toBe(false);
        expect(container.querySelector('.moodboard-workspace')).toBeNull();

        expect(mockState.toolbarInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.saveStatusInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.textPropertiesPanelInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.framePropertiesPanelInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.notePropertiesPanelInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.alignmentGuidesInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(initialTextLayer.destroy).toHaveBeenCalledTimes(1);
        expect(initialHandlesLayer.destroy).toHaveBeenCalledTimes(1);
        expect(mockState.commentPopoverInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.contextMenuInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.zoomPanelInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.mapPanelInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(mockState.coreInstances[0].destroy).toHaveBeenCalledTimes(1);
        expect(workspaceDestroySpy).toHaveBeenCalledTimes(1);
        expect(onDestroy).toHaveBeenCalledTimes(1);
    });

    it('keeps repeated destroy idempotent and post-destroy API safe', async () => {
        board = createMoodBoard(container, { autoLoad: false });
        await settleMoodBoard(board);

        expect(() => board.destroy()).not.toThrow();
        expect(() => board.destroy()).not.toThrow();

        expect(board.createObject('note', { x: 1, y: 2 })).toBeNull();
        expect(board.clearBoard()).toBe(0);
        expect(board.exportBoard()).toBeNull();
    });
});
