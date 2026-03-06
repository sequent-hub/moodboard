import { WorkspaceManager } from '../WorkspaceManager.js';
import { DataManager } from '../DataManager.js';
import { ActionHandler } from '../ActionHandler.js';
import { AlignmentGuides } from '../../tools/AlignmentGuides.js';
import { ImageUploadService } from '../../services/ImageUploadService.js';
import { SettingsApplier } from '../../services/SettingsApplier.js';

export function createWorkspaceManager(board) {
    board.workspaceManager = new WorkspaceManager(board.container, board.options);
}

export function createMoodBoardManagers(board) {
    board.settingsApplier = new SettingsApplier(
        board.coreMoodboard.eventBus,
        board.coreMoodboard.pixi,
        board.coreMoodboard.boardService || null
    );

    board.coreMoodboard.settingsApplier = board.settingsApplier;

    board.dataManager = new DataManager(board.coreMoodboard);
    board.actionHandler = new ActionHandler(board.dataManager, board.workspaceManager);
}

export function wireMoodBoardServices(board) {
    board.alignmentGuides = new AlignmentGuides(
        board.coreMoodboard.eventBus,
        board.coreMoodboard.pixi.app,
        () => board.coreMoodboard.state.getObjects()
    );

    board.imageUploadService = new ImageUploadService(board.coreMoodboard.apiClient);
    board.coreMoodboard.imageUploadService = board.imageUploadService;

    if (board.settingsApplier && board.topbar) {
        board.settingsApplier.setUI({ topbar: board.topbar });
    }
}
