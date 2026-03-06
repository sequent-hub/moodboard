import { CoreMoodBoard } from '../../core/index.js';
import { createMoodBoardManagers, wireMoodBoardServices } from './MoodBoardManagersFactory.js';
import { createMoodBoardUi } from './MoodBoardUiFactory.js';
import { bindSaveCallbacks } from '../integration/MoodBoardEventBindings.js';

export async function initCoreMoodBoard(board) {
    const canvasSize = board.workspaceManager.getCanvasSize();

    const moodboardOptions = {
        boardId: board.options.boardId || 'workspace-board',
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: board.options.theme === 'dark' ? 0x2a2a2a : 0xF7FBFF,
        saveEndpoint: board.options.saveEndpoint,
        loadEndpoint: board.options.loadEndpoint,
    };

    board.coreMoodboard = new CoreMoodBoard(board.canvasContainer, moodboardOptions);
    await board.coreMoodboard.init();
}

export async function initializeMoodBoard(board) {
    try {
        if (board.container) {
            board.container.classList.add('moodboard-root');
        }

        const { workspace, toolbar, canvas, topbar } = board.workspaceManager.createWorkspaceStructure();
        board.workspaceElement = workspace;
        board.toolbarContainer = toolbar;
        board.canvasContainer = canvas;
        board.topbarContainer = topbar;

        await initCoreMoodBoard(board);
        createMoodBoardManagers(board);
        createMoodBoardUi(board);
        wireMoodBoardServices(board);
        bindSaveCallbacks(board);

        if (board.options.autoLoad) {
            await board.loadExistingBoard();
        }
    } catch (error) {
        console.error('MoodBoard init failed:', error);
        throw error;
    }
}
