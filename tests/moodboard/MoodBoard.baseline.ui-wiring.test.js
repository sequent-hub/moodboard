import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Events } from '../../src/core/events/Events.js';
import {
    createMoodBoard,
    lastCoreInstance,
    mockState,
    resetMoodBoardTestState,
    settleMoodBoard,
    setupMoodBoardDom,
} from './MoodBoard.baseline.helpers.js';

describe('MoodBoard baseline: UI wiring contracts', () => {
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

    it('constructs toolbar, panels and overlays with current dependency contract', async () => {
        board = createMoodBoard(container, {
            autoLoad: false,
            theme: 'dark',
            emojiBasePath: '/emoji-assets',
        });

        await settleMoodBoard(board);

        const core = lastCoreInstance();
        const toolbar = mockState.toolbarInstances[0];
        const saveStatus = mockState.saveStatusInstances[0];
        const topbar = mockState.topbarInstances[0];
        const zoomPanel = mockState.zoomPanelInstances[0];
        const mapPanel = mockState.mapPanelInstances[0];
        const contextMenu = mockState.contextMenuInstances[0];
        const htmlTextLayer = mockState.htmlTextLayerInstances[0];
        const htmlHandlesLayer = mockState.htmlHandlesLayerInstances[0];
        const commentPopover = mockState.commentPopoverInstances[0];
        const textPropertiesPanel = mockState.textPropertiesPanelInstances[0];
        const framePropertiesPanel = mockState.framePropertiesPanelInstances[0];
        const notePropertiesPanel = mockState.notePropertiesPanelInstances[0];
        const filePropertiesPanel = mockState.filePropertiesPanelInstances[0];
        const alignmentGuides = mockState.alignmentGuidesInstances[0];
        const settingsApplier = mockState.settingsApplierInstances[0];

        expect(toolbar.args).toEqual([
            board.toolbarContainer,
            core.eventBus,
            'dark',
            { emojiBasePath: '/emoji-assets' },
        ]);
        expect(saveStatus.args).toEqual([board.workspaceElement, core.eventBus]);
        expect(topbar.args).toEqual([board.topbarContainer, core.eventBus, 'dark']);
        expect(zoomPanel.args).toEqual([board.workspaceElement, core.eventBus]);
        expect(mapPanel.args).toEqual([board.workspaceElement, core.eventBus]);
        expect(contextMenu.args).toEqual([board.canvasContainer, core.eventBus]);
        expect(htmlTextLayer.args).toEqual([board.canvasContainer, core.eventBus, core]);
        expect(htmlHandlesLayer.args).toEqual([board.canvasContainer, core.eventBus, core]);
        expect(commentPopover.args).toEqual([board.canvasContainer, core.eventBus, core]);
        expect(textPropertiesPanel.args).toEqual([board.canvasContainer, core.eventBus, core]);
        expect(framePropertiesPanel.args).toEqual([core.eventBus, board.canvasContainer, core]);
        expect(notePropertiesPanel.args).toEqual([core.eventBus, board.canvasContainer, core]);
        expect(filePropertiesPanel.args).toEqual([core.eventBus, board.canvasContainer, core]);
        expect(alignmentGuides.args).toEqual([core.eventBus, core.pixi.app, expect.any(Function)]);

        expect(topbar.mapBoardToBtnHex).toHaveBeenCalledWith('#f7fbff');
        expect(topbar.setPaintButtonHex).toHaveBeenCalledWith('#f7fbff-btn');
        expect(settingsApplier.setUI).toHaveBeenCalledWith({ topbar });
    });

    it('routes toolbar events to ActionHandler and keeps global subscriptions', async () => {
        board = createMoodBoard(container, { autoLoad: false });
        await settleMoodBoard(board);

        const core = lastCoreInstance();
        const action = { type: 'note', position: { x: 100, y: 50 }, properties: { content: 'wired' } };
        const handleSpy = vi.spyOn(board.actionHandler, 'handleToolbarAction');

        core.eventBus.emit(Events.UI.ToolbarAction, action);

        expect(handleSpy).toHaveBeenCalledWith(action);

        const subscribedEvents = core.eventBus.on.mock.calls.map(([eventName]) => eventName);
        expect(subscribedEvents).toContain(Events.UI.ToolbarAction);
        expect(subscribedEvents).toContain(Events.UI.PaintPick);
    });

    it('routes paint-pick events through SettingsApplier', async () => {
        board = createMoodBoard(container, { autoLoad: false });
        await settleMoodBoard(board);

        const core = lastCoreInstance();
        const settingsApplier = mockState.settingsApplierInstances[0];

        core.eventBus.emit(Events.UI.PaintPick, { color: '#ff00aa' });

        expect(settingsApplier.set).toHaveBeenCalledWith({ backgroundColor: '#ff00aa' });
    });

    it('registers save event subscriptions only when onSave callback is provided', async () => {
        board = createMoodBoard(container, {
            autoLoad: false,
            onSave: vi.fn(),
        });
        await settleMoodBoard(board);

        const core = lastCoreInstance();
        const subscribedEvents = core.eventBus.on.mock.calls.map(([eventName]) => eventName);

        expect(subscribedEvents).toContain('save:success');
        expect(subscribedEvents).toContain('save:error');
    });
});
