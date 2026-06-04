import { CoreMoodBoard } from '../../core/index.js';
import { createMoodBoardManagers, wireMoodBoardServices } from './MoodBoardManagersFactory.js';
import { createMoodBoardUi } from './MoodBoardUiFactory.js';
import { bindSaveCallbacks } from '../integration/MoodBoardEventBindings.js';
import { CommentService } from '../../services/comments/CommentService.js';
import { CommentPinLayer } from '../../ui/comments/CommentPinLayer.js';
import { CommentThreadPopover } from '../../ui/comments/CommentThreadPopover.js';
import { CommentTool } from '../../tools/object-tools/CommentTool.js';

export async function wireCommentsSubsystem(board) {
    if (!board.options.enableComments || !board.options.comments) return;

    const core = board.coreMoodboard;
    const boardId = board.options.boardId || 'workspace-board';

    board.commentService = new CommentService({
        eventBus: core.eventBus,
        boardId,
        adapter: board.options.comments,
        currentUser: board.options.currentUser || null,
    });
    board.commentService.attach();

    board.commentThreadPopover = new CommentThreadPopover(
        board.canvasContainer,
        core.eventBus,
        core,
        board.commentService
    );
    board.commentThreadPopover.attach();

    board.commentPinLayer = new CommentPinLayer(
        board.canvasContainer,
        core.eventBus,
        core,
        board.commentService
    );
    board.commentPinLayer.attach();

    const commentTool = new CommentTool(
        core.eventBus,
        core,
        board.commentService,
        board.commentThreadPopover
    );
    core.toolManager.registerTool(commentTool);

    board.comments = {
        applyRemote: (event) => board.commentService.applyRemote(event),
        openThread: (threadId) => board.commentService.openThread(threadId),
    };

    try {
        await board.commentService.loadInitial();
        board.commentPinLayer.rebuild();
        const initialThreadId = board.options.initialThreadId;
        if (initialThreadId != null) {
            board.commentService.openThread(Number(initialThreadId));
        }
    } catch (err) {
        console.error('Comments load failed:', err);
    }
}

export async function initCoreMoodBoard(board) {
    const canvasSize = board.workspaceManager.getCanvasSize();

    const moodboardOptions = {
        boardId: board.options.boardId || 'workspace-board',
        width: canvasSize.width,
        height: canvasSize.height,
        backgroundColor: board.options.theme === 'dark' ? 0x2a2a2a : 0xDAEEFB,
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
        await wireCommentsSubsystem(board);
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
