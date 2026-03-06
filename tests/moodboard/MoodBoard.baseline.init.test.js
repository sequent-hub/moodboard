import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createMoodBoard,
    lastCoreInstance,
    mockState,
    resetMoodBoardTestState,
    settleMoodBoard,
    setupMoodBoardDom,
} from './MoodBoard.baseline.helpers.js';

describe('MoodBoard baseline: init flow and public API smoke', () => {
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

    it('creates workspace structure, core, managers and UI on happy-path init', async () => {
        board = createMoodBoard(container, {
            autoLoad: false,
            boardId: 'baseline-board',
            theme: 'dark',
            saveEndpoint: '/save-endpoint',
            loadEndpoint: '/load-endpoint',
            emojiBasePath: '/emoji',
        });

        await settleMoodBoard(board);

        const core = lastCoreInstance();

        expect(container).toHaveClass('moodboard-root');
        expect(board.workspaceElement).toBe(container.querySelector('.moodboard-workspace'));
        expect(board.toolbarContainer).toBe(container.querySelector('.moodboard-workspace__toolbar'));
        expect(board.canvasContainer).toBe(container.querySelector('.moodboard-workspace__canvas'));
        expect(board.topbarContainer).toBe(container.querySelector('.moodboard-workspace__topbar'));

        expect(core.options).toEqual(
            expect.objectContaining({
                boardId: 'baseline-board',
                backgroundColor: 0x2a2a2a,
                saveEndpoint: '/save-endpoint',
                loadEndpoint: '/load-endpoint',
            })
        );
        expect(core.init).toHaveBeenCalledTimes(1);

        expect(board.dataManager).toBeTruthy();
        expect(board.actionHandler).toBeTruthy();
        expect(board.toolbar).toBe(mockState.toolbarInstances[0]);
        expect(board.saveStatus).toBe(mockState.saveStatusInstances[0]);
        expect(board.topbar).toBe(mockState.topbarInstances[0]);
        expect(board.zoombar).toBe(mockState.zoomPanelInstances[0]);
        expect(board.mapbar).toBe(mockState.mapPanelInstances[0]);
        expect(board.contextMenu).toBe(mockState.contextMenuInstances[0]);
        expect(board.htmlTextLayer).toBe(mockState.htmlTextLayerInstances[0]);
        expect(board.htmlHandlesLayer).toBe(mockState.htmlHandlesLayerInstances[0]);
        expect(board.commentPopover).toBe(mockState.commentPopoverInstances[0]);
        expect(board.textPropertiesPanel).toBe(mockState.textPropertiesPanelInstances[0]);
        expect(board.framePropertiesPanel).toBe(mockState.framePropertiesPanelInstances[0]);
        expect(board.notePropertiesPanel).toBe(mockState.notePropertiesPanelInstances[0]);
        expect(board.filePropertiesPanel).toBe(mockState.filePropertiesPanelInstances[0]);
        expect(board.alignmentGuides).toBe(mockState.alignmentGuidesInstances[0]);
        expect(board.imageUploadService).toBe(mockState.imageUploadServiceInstances[0]);
        expect(board.settingsApplier).toBe(mockState.settingsApplierInstances[0]);
        expect(board.coreMoodboard.settingsApplier).toBe(board.settingsApplier);
        expect(board.coreMoodboard.imageUploadService).toBe(board.imageUploadService);

        expect(board.htmlTextLayer.attach).toHaveBeenCalledTimes(1);
        expect(board.htmlHandlesLayer.attach).toHaveBeenCalledTimes(1);
        expect(board.commentPopover.attach).toHaveBeenCalledTimes(1);
        expect(board.textPropertiesPanel.attach).toHaveBeenCalledTimes(1);

        expect(window.moodboardHtmlTextLayer).toBe(board.htmlTextLayer);
        expect(window.moodboardHtmlHandlesLayer).toBe(board.htmlHandlesLayer);
        expect(window.reloadIcon).toBeTypeOf('function');
    });

    it('keeps public API smoke contract for create/delete/clear/export/screenshot', async () => {
        board = createMoodBoard(container, { autoLoad: false, boardId: 'public-api-board' });
        await settleMoodBoard(board);

        const created = board.createObject('note', { x: 10, y: 15 }, { content: 'baseline note' });
        expect(created).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                type: 'note',
                position: { x: 10, y: 15 },
                properties: { content: 'baseline note' },
            })
        );
        expect(board.coreMoodboard.createObject).toHaveBeenCalledWith(
            'note',
            { x: 10, y: 15 },
            { content: 'baseline note' },
            {}
        );

        board.deleteObject(created.id);
        expect(board.coreMoodboard.deleteObject).toHaveBeenCalledWith(created.id);

        board.createObject('note', { x: 20, y: 25 }, { content: 'one' });
        board.createObject('text', { x: 30, y: 35 }, { content: 'two' });
        const cleared = board.clearBoard();
        expect(typeof cleared).toBe('number');
        expect(cleared).toBeGreaterThan(0);
        expect(board.coreMoodboard.deleteObject).toHaveBeenCalled();

        const exported = board.exportBoard();
        expect(exported).toBe(board.coreMoodboard.boardData);
        expect(board.coreMoodboard.eventBus.emit).toHaveBeenCalledWith('board:export', board.coreMoodboard.boardData);

        const screenshotSpy = vi
            .spyOn(board, 'createCombinedScreenshot')
            .mockReturnValue('data:image/png;base64,baseline-shot');

        expect(board.exportScreenshot('image/png', 0.8)).toBe('data:image/png;base64,baseline-shot');
        expect(screenshotSpy).toHaveBeenCalledWith('image/png', 0.8);
    });
});
