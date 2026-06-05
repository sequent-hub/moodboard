import { CoreMoodBoard } from '../../core/index.js';
import { BOARD_PALETTE } from '../../ui/boardPalette.js';
import { createMoodBoardManagers, wireMoodBoardServices } from './MoodBoardManagersFactory.js';
import { createMoodBoardUi } from './MoodBoardUiFactory.js';
import { bindSaveCallbacks } from '../integration/MoodBoardEventBindings.js';
import { CommentService } from '../../services/comments/CommentService.js';
import { CommentPinLayer } from '../../ui/comments/CommentPinLayer.js';
import { CommentsBar } from '../../ui/CommentsBar.js';
import { CommentThreadPopover } from '../../ui/comments/CommentThreadPopover.js';
import { CommentTool } from '../../tools/object-tools/CommentTool.js';
import { CommentListPanel } from '../../ui/comments/CommentListPanel.js';

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

    board.commentsBar = new CommentsBar(board.workspaceElement, core.eventBus);
    board.commentsBar.attach();

    board.commentListPanel = new CommentListPanel(board.workspaceElement, core.eventBus, core, board.commentService);
    board.commentListPanel.attach();

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
        backgroundColor: board.options.theme === 'dark' ? 0x2a2a2a : parseInt(BOARD_PALETTE[4].board.replace('#', ''), 16),
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
