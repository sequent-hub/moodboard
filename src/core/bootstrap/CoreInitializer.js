import { ToolManager } from '../../tools/ToolManager.js';
import { SelectTool } from '../../tools/object-tools/SelectTool.js';
import { BoardService } from '../../services/BoardService.js';
import { ZoomPanController } from '../../services/ZoomPanController.js';
import { ZOrderManager } from '../../services/ZOrderManager.js';
import { FrameService } from '../../services/FrameService.js';

export async function initializeCore(core) {
    try {
        await core.pixi.init();
        core.keyboard.startListening();
        await initializeCoreTools(core);

        core.boardService = new BoardService(core.eventBus, core.pixi);
        await core.boardService.init(() => (core.workspaceSize?.() || { width: core.options.width, height: core.options.height }));
        core.zoomPan = new ZoomPanController(core.eventBus, core.pixi);
        core.zoomPan.attach();
        core.zOrder = new ZOrderManager(core.eventBus, core.pixi, core.state);
        core.zOrder.attach();
        core.frameService = new FrameService(core.eventBus, core.pixi, core.state);
        core.frameService.attach();

        core.state.loadBoard({
            id: core.options.boardId || 'demo',
            name: 'Demo Board',
            objects: [],
            viewport: { x: 0, y: 0, zoom: 1 }
        });
    } catch (error) {
        console.error('MoodBoard init failed:', error);
    }
}

export async function initializeCoreTools(core) {
    const canvasElement = core.pixi.app.view;
    core.workspaceSize = () => ({ width: canvasElement.clientWidth, height: canvasElement.clientHeight });
    core.toolManager = new ToolManager(core.eventBus, canvasElement, core.pixi.app, core);

    const selectTool = new SelectTool(core.eventBus);
    core.toolManager.registerTool(selectTool);

    const panToolModule = await import('../../tools/board-tools/PanTool.js');
    const panTool = new panToolModule.PanTool(core.eventBus);
    core.toolManager.registerTool(panTool);

    const drawingToolModule = await import('../../tools/object-tools/DrawingTool.js');
    const drawingTool = new drawingToolModule.DrawingTool(core.eventBus);
    core.toolManager.registerTool(drawingTool);

    const placementToolModule = await import('../../tools/object-tools/PlacementTool.js');
    const placementTool = new placementToolModule.PlacementTool(core.eventBus, core);
    core.toolManager.registerTool(placementTool);

    const textToolModule = await import('../../tools/object-tools/TextTool.js');
    const textTool = new textToolModule.TextTool(core.eventBus);
    core.toolManager.registerTool(textTool);

    core.selectTool = selectTool;
    core.toolManager.activateTool('select');

    core.setupToolEvents();
    core.setupKeyboardEvents();
    core.setupSaveEvents();
    core.setupHistoryEvents();
}
