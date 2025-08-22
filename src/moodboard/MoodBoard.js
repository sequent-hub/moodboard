import { CoreMoodBoard } from '../core/index.js';
import { Events } from '../core/events/Events.js';
import { Toolbar } from '../ui/Toolbar.js';
import { SaveStatus } from '../ui/SaveStatus.js';
import { Topbar } from '../ui/Topbar.js';
import { ZoomPanel } from '../ui/ZoomPanel.js';
import { MapPanel } from '../ui/MapPanel.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { WorkspaceManager } from './WorkspaceManager.js';
import { DataManager } from './DataManager.js';
import { ActionHandler } from './ActionHandler.js';
import { HtmlTextLayer } from '../ui/HtmlTextLayer.js';
import { HtmlHandlesLayer } from '../ui/HtmlHandlesLayer.js';
import { CommentPopover } from '../ui/CommentPopover.js';

/**
 * Готовый MoodBoard с UI - главный класс пакета
 */
export class MoodBoard {
    constructor(container, options = {}, data = null) {
        this.containerSelector = container;
        this.container = typeof container === 'string' 
            ? document.querySelector(container)
            : container;
            
        if (!this.container) {
            throw new Error('Container not found');
        }
        
        // Настройки по умолчанию
        this.options = {
            theme: 'light',
            ...options
        };
        
        this.data = data;
        
        // Основные компоненты
        this.coreMoodboard = null;
        this.toolbar = null;
        this.saveStatus = null;
        this.contextMenu = null;
        
        // Менеджеры
        this.workspaceManager = new WorkspaceManager(this.container, this.options);
        this.dataManager = null;
        this.actionHandler = null;
        
        this.init();
    }
    
    /**
     * Инициализация рабочего пространства
     */
    async init() {
        try {
            // Создаем HTML структуру
            const { workspace, toolbar, canvas, topbar } = this.workspaceManager.createWorkspaceStructure();
            this.workspaceElement = workspace;
            this.toolbarContainer = toolbar;
            this.canvasContainer = canvas;
            this.topbarContainer = topbar;
            
            // Инициализируем CoreMoodBoard
            await this.initCoreMoodBoard();
            
            // Создаем менеджеры
            this.dataManager = new DataManager(this.coreMoodboard);
            this.actionHandler = new ActionHandler(this.dataManager, this.workspaceManager);
            
            // Инициализируем UI
            this.initToolbar();
            this.initTopbar();
            this.initZoombar();
            this.initMapbar();
            this.initContextMenu();
            // HTML-слои: сверхчёткий текст и единые ручки
            this.htmlTextLayer = new HtmlTextLayer(this.canvasContainer, this.coreMoodboard.eventBus, this.coreMoodboard);
            this.htmlTextLayer.attach();
            this.htmlHandlesLayer = new HtmlHandlesLayer(this.canvasContainer, this.coreMoodboard.eventBus, this.coreMoodboard);
            this.htmlHandlesLayer.attach();
            // Поповер для комментариев
            this.commentPopover = new CommentPopover(this.canvasContainer, this.coreMoodboard.eventBus, this.coreMoodboard);
            this.commentPopover.attach();
            
            // Загружаем данные (сначала пробуем загрузить с сервера, потом дефолтные)
            await this.loadExistingBoard();
            
            console.log('MoodBoard initialized');
        } catch (error) {
            console.error('MoodBoard init failed:', error);
            throw error;
        }
    }
    
    /**
     * Инициализирует CoreMoodBoard
     */
    async initCoreMoodBoard() {
        const canvasSize = this.workspaceManager.getCanvasSize();
        
        const moodboardOptions = {
            boardId: this.options.boardId || 'workspace-board',
            width: canvasSize.width,
            height: canvasSize.height,
            // Цвет фона по умолчанию: #f7fbff (светлый голубовато-белый)
            backgroundColor: this.options.theme === 'dark' ? 0x2a2a2a : 0xF7FBFF,
            // Передаем только настройки эндпоинтов для автосохранения
            saveEndpoint: this.options.saveEndpoint,
            loadEndpoint: this.options.loadEndpoint
        };
        
        this.coreMoodboard = new CoreMoodBoard(this.canvasContainer, moodboardOptions);
        await this.coreMoodboard.init();
    }
    
    /**
     * Инициализирует панель инструментов
     */
    initToolbar() {
        this.toolbar = new Toolbar(
            this.toolbarContainer, 
            this.coreMoodboard.eventBus,
            this.options.theme
        );
        
        // Добавляем функцию для отладки иконок в window
        if (typeof window !== 'undefined') {
            window.reloadIcon = (iconName) => this.toolbar.reloadToolbarIcon(iconName);
        }
        
        // Инициализируем индикатор сохранения (с фиксированными настройками)
        this.saveStatus = new SaveStatus(
            this.workspaceElement,
            this.coreMoodboard.eventBus
        );
        
        // Подписываемся на события тулбара
        this.coreMoodboard.eventBus.on(Events.UI.ToolbarAction, (action) => {
            this.actionHandler.handleToolbarAction(action);
        });
    }

    initTopbar() {
        this.topbar = new Topbar(
            this.topbarContainer,
            this.coreMoodboard.eventBus,
            this.options.theme
        );

        // Смена фона доски по выбору цвета в топбаре
        this.coreMoodboard.eventBus.on(Events.UI.PaintPick, ({ color }) => {
            if (!color) return;
            const hex = typeof color === 'string' && color.startsWith('#')
                ? parseInt(color.slice(1), 16)
                : color;
            if (this.coreMoodboard?.pixi?.app?.renderer) {
                this.coreMoodboard.pixi.app.renderer.backgroundColor = hex;
            }
        });
    }

    initZoombar() {
        // Рисуем панель зума поверх холста (в том же контейнере, что и topbar)
        this.zoombar = new ZoomPanel(
            this.topbarContainer,
            this.coreMoodboard.eventBus
        );
    }

    initMapbar() {
        // Рисуем панель карты в правом нижнем углу (внутри workspace контейнера)
        this.mapbar = new MapPanel(
            this.workspaceElement,
            this.coreMoodboard.eventBus
        );
    }

    initContextMenu() {
        this.contextMenu = new ContextMenu(
            this.canvasContainer,
            this.coreMoodboard.eventBus
        );
    }
    
    /**
     * Изменение темы
     */
    setTheme(theme) {
        this.options.theme = theme;
        
        // Обновляем тему в менеджерах
        this.workspaceManager.updateTheme(theme);
        
        if (this.toolbar) {
            this.toolbar.setTheme(theme);
        }
        
        // Обновляем цвет фона MoodBoard
        if (this.coreMoodboard && this.coreMoodboard.pixi) {
            this.coreMoodboard.pixi.app.renderer.backgroundColor = 
                theme === 'dark' ? 0x2a2a2a : 0xF5F5F5;
        }
    }
    
    /**
     * Получение данных доски
     */
    get boardData() {
        return this.dataManager ? this.dataManager.boardData : null;
    }
    
    /**
     * Получение объектов доски
     */
    get objects() {
        return this.dataManager ? this.dataManager.objects : [];
    }
    
    /**
     * Создание объекта программно
     */
    createObject(type, position, properties = {}) {
        return this.actionHandler ? this.actionHandler.createObject(type, position, properties) : null;
    }
    
    /**
     * Удаление объекта программно
     */
    deleteObject(objectId) {
        if (this.actionHandler) {
            this.actionHandler.deleteObject(objectId);
        }
    }
    
    /**
     * Очистка доски программно
     */
    clearBoard() {
        return this.actionHandler ? this.actionHandler.clearBoard() : 0;
    }
    
    /**
     * Экспорт данных программно
     */
    exportBoard() {
        return this.actionHandler ? this.actionHandler.exportBoard() : null;
    }
    
    /**
     * Загрузка существующей доски с сервера
     */
    async loadExistingBoard() {
        try {
            const boardId = this.options.boardId;
            
            if (!boardId || !this.options.loadEndpoint) {
                this.dataManager.loadData(this.data);
                return;
            }
            
            // Пытаемся загрузить с сервера
            const boardData = await this.coreMoodboard.saveManager.loadBoardData(boardId);
            
            if (boardData && boardData.objects) {
                this.dataManager.loadData(boardData);
            } else {
                this.dataManager.loadData(this.data);
            }
            
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки доски, создаем новую:', error.message);
            // Если загрузка не удалась, используем дефолтные данные
            this.dataManager.loadData(this.data);
        }
    }
    
    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.toolbar) {
            this.toolbar.destroy();
        }
        
        if (this.saveStatus) {
            this.saveStatus.destroy();
        }
        
        if (this.coreMoodboard) {
            this.coreMoodboard.destroy();
        }
        
        if (this.workspaceManager) {
            this.workspaceManager.destroy();
        }
    }
}
