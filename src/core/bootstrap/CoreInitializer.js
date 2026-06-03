import { ToolManager } from '../../tools/ToolManager.js';
import { SelectTool } from '../../tools/object-tools/SelectTool.js';
import { BoardService } from '../../services/BoardService.js';
import { ZoomPanController } from '../../services/ZoomPanController.js';
import { ZOrderManager } from '../../services/ZOrderManager.js';
import { FrameService } from '../../services/FrameService.js';
import { Events } from '../events/Events.js';

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

        setupViewportResize(core);

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

/**
 * Подписывает рендерер на изменение размера контейнера.
 * Размер берём с контейнера, а не с канваса: PIXI (autoDensity) выставляет
 * канвасу инлайн-размер в px, перебивая CSS width:100%, поэтому
 * canvas.clientWidth «залипает» на стартовом размере и не отражает контейнер.
 * Без этого после ресайза окна (оконный режим → полный экран) канвас остаётся
 * прежнего размера и справа проступает фон рабочей области.
 */
function setupViewportResize(core) {
    if (typeof ResizeObserver === 'undefined' || !core.container) return;

    let rafId = null;
    const applyResize = () => {
        rafId = null;
        if (core.destroyed) return;
        const el = core.container;
        if (!el) return;
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (width <= 0 || height <= 0) return;
        core.pixi.resize(width, height);
        // Пересобираем screen-space сетку под новый размер и репозиционируем
        // её вместе с оверлеями через существующий viewport-флоу.
        core.boardService?.resize?.();
        core.eventBus.emit(Events.Viewport.Changed);
    };

    core.resizeObserver = new ResizeObserver(() => {
        if (rafId !== null) return;
        rafId = (typeof requestAnimationFrame === 'function')
            ? requestAnimationFrame(applyResize)
            : setTimeout(applyResize, 16);
    });
    core.resizeObserver.observe(core.container);
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

    const connectorToolModule = await import('../../tools/object-tools/ConnectorTool.js');
    const connectorTool = new connectorToolModule.ConnectorTool(core.eventBus, core);
    core.toolManager.registerTool(connectorTool);

    const laserToolModule = await import('../../tools/object-tools/LaserPointerTool.js');
    const laserTool = new laserToolModule.LaserPointerTool(core.eventBus);
    core.toolManager.registerTool(laserTool);

    core.selectTool = selectTool;
    core.toolManager.activateTool('select');

    core.setupToolEvents();
    core.setupKeyboardEvents();
    core.setupSaveEvents();
    core.setupHistoryEvents();
}
