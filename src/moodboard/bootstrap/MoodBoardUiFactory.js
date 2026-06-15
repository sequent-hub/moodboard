import { Toolbar } from '../../ui/Toolbar.js';
import { SaveStatus } from '../../ui/SaveStatus.js';
import { Topbar } from '../../ui/Topbar.js';
import { ZoomPanel } from '../../ui/ZoomPanel.js';
import { MapPanel } from '../../ui/MapPanel.js';
import { DotGridDebugPanel } from '../../ui/DotGridDebugPanel.js';
import { ContextMenu } from '../../ui/ContextMenu.js';
import { HtmlTextLayer } from '../../ui/HtmlTextLayer.js';
import { MindmapHtmlTextLayer } from '../../ui/mindmap/MindmapHtmlTextLayer.js';
import { MindmapConnectionLayer } from '../../ui/mindmap/MindmapConnectionLayer.js';
import { MindmapCollapseLayer } from '../../ui/mindmap/MindmapCollapseLayer.js';
import { ConnectorLayer } from '../../ui/connectors/ConnectorLayer.js';
import { ConnectorLabelLayer } from '../../ui/connectors/ConnectorLabelLayer.js';
import { ConnectionAnchorsLayer } from '../../ui/connectors/ConnectionAnchorsLayer.js';
import { ConnectorHandlesLayer } from '../../ui/connectors/ConnectorHandlesLayer.js';
import { HtmlHandlesLayer } from '../../ui/HtmlHandlesLayer.js';
import { TextPropertiesPanel } from '../../ui/TextPropertiesPanel.js';
import { FramePropertiesPanel } from '../../ui/FramePropertiesPanel.js';
import { NotePropertiesPanel } from '../../ui/NotePropertiesPanel.js';
import { FilePropertiesPanel } from '../../ui/FilePropertiesPanel.js';
import { ImagePropertiesPanel } from '../../ui/ImagePropertiesPanel.js';
import { ConnectorPropertiesPanel } from '../../ui/ConnectorPropertiesPanel.js';
import { ShapePropertiesPanel } from '../../ui/ShapePropertiesPanel.js';
import { DrawingPropertiesPanel } from '../../ui/DrawingPropertiesPanel.js';
import { ChatWindow } from '../../ui/chat/ChatWindow.js';
import { bindToolbarEvents, bindTopbarEvents } from '../integration/MoodBoardEventBindings.js';

function initToolbar(board) {
    board.toolbar = new Toolbar(
        board.toolbarContainer,
        board.coreMoodboard.eventBus,
        board.options.theme,
        {
            emojiBasePath: board.options.emojiBasePath || null,
        }
    );
    board.toolbar.enableComments = !!board.options.enableComments;

    if (typeof window !== 'undefined') {
        window.reloadIcon = (iconName) => board.toolbar.reloadToolbarIcon(iconName);
    }

    board.saveStatus = new SaveStatus(
        board.workspaceElement,
        board.coreMoodboard.eventBus
    );

    bindToolbarEvents(board);
}

function initTopbar(board) {
    board.topbar = new Topbar(
        board.topbarContainer,
        board.coreMoodboard.eventBus,
        board.options.theme
    );

    try {
        const app = board.coreMoodboard?.pixi?.app;
        const colorInt = (app?.renderer?.background && app.renderer.background.color) || app?.renderer?.backgroundColor;
        if (typeof colorInt === 'number') {
            const boardHex = `#${colorInt.toString(16).padStart(6, '0')}`;
            const btnHex = board.topbar.mapBoardToBtnHex(boardHex);
            board.topbar.setPaintButtonHex(btnHex || '#B3E5FC');
        }
    } catch (_) {}

    bindTopbarEvents(board);
}

function initZoombar(board) {
    board.zoombar = new ZoomPanel(
        board.workspaceElement,
        board.coreMoodboard.eventBus
    );
}

function initMapbar(board) {
    board.mapbar = new MapPanel(
        board.workspaceElement,
        board.coreMoodboard.eventBus
    );
}

function initDotGridDebugPanel(board) {
    board.dotGridDebugPanel = new DotGridDebugPanel(
        board.workspaceElement,
        board.coreMoodboard
    );
}

function initContextMenu(board) {
    board.contextMenu = new ContextMenu(
        board.canvasContainer,
        board.coreMoodboard.eventBus
    );
    if (board.options.enableComments) {
        board.contextMenu.setEnableComments(true);
    }
}

function initChatWindow(board) {
    if (board?.options?.disableChat === true) return;
    board.chatWindow = new ChatWindow(board.workspaceElement, {
        boardCore: board.coreMoodboard
    });
    board.chatWindow.attach();
}

function initHtmlLayersAndPanels(board) {
    board.htmlTextLayer = new HtmlTextLayer(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.htmlTextLayer.attach();
    board.mindmapHtmlTextLayer = new MindmapHtmlTextLayer(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.mindmapHtmlTextLayer.attach();
    board.mindmapConnectionLayer = new MindmapConnectionLayer(board.coreMoodboard.eventBus, board.coreMoodboard);
    board.mindmapConnectionLayer.attach();
    board.mindmapCollapseLayer = new MindmapCollapseLayer(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.mindmapCollapseLayer.attach();

    board.connectorLayer = new ConnectorLayer(board.coreMoodboard.eventBus, board.coreMoodboard);
    board.connectorLayer.attach();
    board.coreMoodboard.connectorLayer = board.connectorLayer;

    board.connectorLabelLayer = new ConnectorLabelLayer(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.connectorLabelLayer.attach();
    board.coreMoodboard.connectorLabelLayer = board.connectorLabelLayer;

    board.connectionAnchorsLayer = new ConnectionAnchorsLayer(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.connectionAnchorsLayer.attach();

    board.connectorHandlesLayer = new ConnectorHandlesLayer(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.connectorHandlesLayer.attach();

    board.htmlHandlesLayer = new HtmlHandlesLayer(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.htmlHandlesLayer.attach();

    if (typeof window !== 'undefined') {
        window.moodboardHtmlTextLayer = board.htmlTextLayer;
        window.moodboardMindmapHtmlTextLayer = board.mindmapHtmlTextLayer;
        window.moodboardMindmapConnectionLayer = board.mindmapConnectionLayer;
        window.moodboardMindmapCollapseLayer = board.mindmapCollapseLayer;
        window.moodboardConnectorLayer = board.connectorLayer;
        window.moodboardConnectorLabelLayer = board.connectorLabelLayer;
        window.moodboardConnectionAnchorsLayer = board.connectionAnchorsLayer;
        window.moodboardConnectorHandlesLayer = board.connectorHandlesLayer;
        window.moodboardHtmlHandlesLayer = board.htmlHandlesLayer;
    }

    board.textPropertiesPanel = new TextPropertiesPanel(board.canvasContainer, board.coreMoodboard.eventBus, board.coreMoodboard);
    board.textPropertiesPanel.attach();

    board.framePropertiesPanel = new FramePropertiesPanel(board.coreMoodboard.eventBus, board.canvasContainer, board.coreMoodboard);
    board.notePropertiesPanel = new NotePropertiesPanel(board.coreMoodboard.eventBus, board.canvasContainer, board.coreMoodboard);
    board.filePropertiesPanel = new FilePropertiesPanel(board.coreMoodboard.eventBus, board.canvasContainer, board.coreMoodboard);
    board.imagePropertiesPanel = new ImagePropertiesPanel(board.coreMoodboard.eventBus, board.canvasContainer, board.coreMoodboard, board.options.currentUser || null);
    board.connectorPropertiesPanel = new ConnectorPropertiesPanel(board.coreMoodboard.eventBus, board.canvasContainer, board.coreMoodboard);
    board.shapePropertiesPanel = new ShapePropertiesPanel(board.coreMoodboard.eventBus, board.canvasContainer, board.coreMoodboard);
    board.drawingPropertiesPanel = new DrawingPropertiesPanel(board.coreMoodboard.eventBus, board.canvasContainer, board.coreMoodboard);
}

export function createMoodBoardUi(board) {
    initToolbar(board);
    initTopbar(board);
    initZoombar(board);
    initMapbar(board);
    // Debug-панель сетки оставляем в проекте, но не показываем по умолчанию.
    // Для включения: передать showGridDebugPanel: true в options MoodBoard.
    if (board?.options?.showGridDebugPanel === true) {
        initDotGridDebugPanel(board);
    }
    initContextMenu(board);
    initHtmlLayersAndPanels(board);
    initChatWindow(board);
}
