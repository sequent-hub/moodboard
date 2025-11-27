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
import { TextPropertiesPanel } from '../ui/TextPropertiesPanel.js';
import { FramePropertiesPanel } from '../ui/FramePropertiesPanel.js';
import { NotePropertiesPanel } from '../ui/NotePropertiesPanel.js';
import { FilePropertiesPanel } from '../ui/FilePropertiesPanel.js';
import { AlignmentGuides } from '../tools/AlignmentGuides.js';
import { ImageUploadService } from '../services/ImageUploadService.js';
import { SettingsApplier } from '../services/SettingsApplier.js';
import { GridFactory } from '../grid/GridFactory.js';

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
            boardId: null,
            apiUrl: '/api/moodboard',
            autoLoad: true,
            onSave: null,
            onLoad: null,
            onDestroy: null,
            ...options
        };
        
        this.data = data;
        
        // Флаг состояния объекта
        this.destroyed = false;
        
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
            // Добавляем корневой класс к контейнеру для изоляции стилей
            if (this.container) {
                this.container.classList.add('moodboard-root');
            }
            
            // Создаем HTML структуру
            const { workspace, toolbar, canvas, topbar } = this.workspaceManager.createWorkspaceStructure();
            this.workspaceElement = workspace;
            this.toolbarContainer = toolbar;
            this.canvasContainer = canvas;
            this.topbarContainer = topbar;
            
            // Инициализируем CoreMoodBoard
            await this.initCoreMoodBoard();
            
            // Настройки (единая точка применения)
            this.settingsApplier = new SettingsApplier(
                this.coreMoodboard.eventBus,
                this.coreMoodboard.pixi,
                this.coreMoodboard.boardService || null
            );
            // Делаем доступным для других подсистем
            this.coreMoodboard.settingsApplier = this.settingsApplier;
            
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
            
            // Устанавливаем глобальные свойства для доступа к слоям
            if (typeof window !== 'undefined') {
                window.moodboardHtmlTextLayer = this.htmlTextLayer;
                window.moodboardHtmlHandlesLayer = this.htmlHandlesLayer;
            }
            // Поповер для комментариев
            this.commentPopover = new CommentPopover(this.canvasContainer, this.coreMoodboard.eventBus, this.coreMoodboard);
            this.commentPopover.attach();
            // Панель свойств текста
            this.textPropertiesPanel = new TextPropertiesPanel(this.canvasContainer, this.coreMoodboard.eventBus, this.coreMoodboard);
            this.textPropertiesPanel.attach();

            // Панель свойств фрейма
            this.framePropertiesPanel = new FramePropertiesPanel(this.coreMoodboard.eventBus, this.canvasContainer, this.coreMoodboard);
            
            // Панель свойств записки
            this.notePropertiesPanel = new NotePropertiesPanel(this.coreMoodboard.eventBus, this.canvasContainer, this.coreMoodboard);
            this.filePropertiesPanel = new FilePropertiesPanel(this.coreMoodboard.eventBus, this.canvasContainer, this.coreMoodboard);
            
            // Направляющие линии выравнивания
            this.alignmentGuides = new AlignmentGuides(
                this.coreMoodboard.eventBus, 
                this.coreMoodboard.pixi.app,
                () => this.coreMoodboard.state.getObjects()
            );
            
            // Сервис загрузки изображений
            this.imageUploadService = new ImageUploadService(this.coreMoodboard.apiClient);
            
            // Предоставляем доступ к сервису через core
            this.coreMoodboard.imageUploadService = this.imageUploadService;
            // Передаем ссылку на topbar в апплаер настроек для синхронизации UI
            if (this.settingsApplier && this.topbar) {
                this.settingsApplier.setUI({ topbar: this.topbar });
            }
            
            // Настраиваем коллбеки событий
            this.setupEventCallbacks();
            
            // Автоматически загружаем данные если включено
            if (this.options.autoLoad) {
                await this.loadExistingBoard();
            }
            
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
            this.options.theme,
            {
                emojiBasePath: this.options.emojiBasePath || null
            }
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

        // Инициализация цвета кнопки "краска" по текущему фону канваса
        try {
            const app = this.coreMoodboard?.pixi?.app;
            const colorInt = (app?.renderer?.background && app.renderer.background.color) || app?.renderer?.backgroundColor;
            if (typeof colorInt === 'number') {
                const boardHex = `#${colorInt.toString(16).padStart(6, '0')}`;
                const btnHex = this.topbar.mapBoardToBtnHex(boardHex);
                this.topbar.setPaintButtonHex(btnHex || '#B3E5FC');
            }
        } catch (_) {}

        // Смена фона доски по выбору цвета в топбаре
        this.coreMoodboard.eventBus.on(Events.UI.PaintPick, ({ color }) => {
            if (!color) return;
            // Централизованное применение через SettingsApplier,
            // чтобы гарантировать эмит события для автосохранения
            if (this.settingsApplier && typeof this.settingsApplier.set === 'function') {
                this.settingsApplier.set({ backgroundColor: color });
            } else {
                // Fallback на случай отсутствия аплаера (не должен случаться)
                const hex = (typeof color === 'string' && color.startsWith('#'))
                    ? parseInt(color.slice(1), 16)
                    : color;
                if (this.coreMoodboard?.pixi?.app?.renderer) {
                    this.coreMoodboard.pixi.app.renderer.backgroundColor = hex;
                }
                this.coreMoodboard.eventBus.emit(Events.Grid.BoardDataChanged, { settings: { backgroundColor: color } });
            }
        });
    }

    initZoombar() {
        // Рисуем панель зума в правом нижнем углу (внутри workspace контейнера)
        this.zoombar = new ZoomPanel(
            this.workspaceElement,
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
        if (this.destroyed) {
            console.warn('MoodBoard уже уничтожен');
            return;
        }
        
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
        if (this.destroyed) {
            console.warn('MoodBoard уже уничтожен');
            return null;
        }
        return this.actionHandler ? this.actionHandler.createObject(type, position, properties) : null;
    }
    
    /**
     * Удаление объекта программно
     */
    deleteObject(objectId) {
        if (this.destroyed) {
            console.warn('MoodBoard уже уничтожен');
            return;
        }
        if (this.actionHandler) {
            this.actionHandler.deleteObject(objectId);
        }
    }
    
    /**
     * Очистка доски программно
     */
    clearBoard() {
        if (this.destroyed) {
            console.warn('MoodBoard уже уничтожен');
            return 0;
        }
        return this.actionHandler ? this.actionHandler.clearBoard() : 0;
    }
    
    /**
     * Экспорт данных программно
     */
    exportBoard() {
        if (this.destroyed) {
            console.warn('MoodBoard уже уничтожен');
            return null;
        }
        return this.actionHandler ? this.actionHandler.exportBoard() : null;
    }
    
    /**
     * Загрузка существующей доски с сервера
     */
    async loadExistingBoard() {
        try {
            const boardId = this.options.boardId;
            
            if (!boardId || !this.options.apiUrl) {
                console.log('📦 MoodBoard: нет boardId или apiUrl, загружаем пустую доску');
                this.dataManager.loadData(this.data || { objects: [] });
                
                // Вызываем коллбек onLoad
                if (typeof this.options.onLoad === 'function') {
                    this.options.onLoad({ success: true, data: this.data || { objects: [] } });
                }
                return;
            }
            
            console.log(`📦 MoodBoard: загружаем доску ${boardId} с ${this.options.apiUrl}`);
            
            // Формируем URL для загрузки
            const loadUrl = this.options.apiUrl.endsWith('/') 
                ? `${this.options.apiUrl}load/${boardId}`
                : `${this.options.apiUrl}/load/${boardId}`;
            
            // Загружаем с сервера через fetch
            const response = await fetch(loadUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': this.getCsrfToken()
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const boardData = await response.json();
            
            if (boardData && boardData.data) {
                console.log('✅ MoodBoard: данные загружены с сервера', boardData.data);
                this.dataManager.loadData(boardData.data);
                
                // Вызываем коллбек onLoad
                if (typeof this.options.onLoad === 'function') {
                    this.options.onLoad({ success: true, data: boardData.data });
                }
            } else {
                console.log('📦 MoodBoard: нет данных с сервера, загружаем пустую доску');
                this.dataManager.loadData(this.data || { objects: [] });
                
                // Вызываем коллбек onLoad
                if (typeof this.options.onLoad === 'function') {
                    this.options.onLoad({ success: true, data: this.data || { objects: [] } });
                }
            }
            
        } catch (error) {
            console.warn('⚠️ MoodBoard: ошибка загрузки доски, создаем новую:', error.message);
            this.dataManager.loadData(this.data || { objects: [] });
            
            // Вызываем коллбек onLoad с ошибкой
            if (typeof this.options.onLoad === 'function') {
                this.options.onLoad({ success: false, error: error.message, data: this.data || { objects: [] } });
            }
        }
    }
    
    /**
     * Безопасное уничтожение объекта с проверкой наличия метода destroy
     * @param {Object} obj - объект для уничтожения
     * @param {string} name - имя объекта для логирования
     */
    _safeDestroy(obj, name) {
        if (obj) {
            try {
                if (typeof obj.destroy === 'function') {
                    obj.destroy();
                } else {
                    console.warn(`Объект ${name} не имеет метода destroy()`);
                }
            } catch (error) {
                console.error(`Ошибка при уничтожении ${name}:`, error);
            }
        }
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        // Предотвращаем повторное уничтожение
        if (this.destroyed) {
            console.warn('MoodBoard уже был уничтожен');
            return;
        }
        
        // Устанавливаем флаг уничтожения
        this.destroyed = true;
        
        // Уничтожаем UI компоненты с безопасными проверками
        this._safeDestroy(this.toolbar, 'toolbar');
        this.toolbar = null;
        
        this._safeDestroy(this.saveStatus, 'saveStatus');
        this.saveStatus = null;
        
        this._safeDestroy(this.textPropertiesPanel, 'textPropertiesPanel');
        this.textPropertiesPanel = null;

        this._safeDestroy(this.framePropertiesPanel, 'framePropertiesPanel');
        this.framePropertiesPanel = null;
        
        this._safeDestroy(this.notePropertiesPanel, 'notePropertiesPanel');
        this.notePropertiesPanel = null;
        
        this._safeDestroy(this.alignmentGuides, 'alignmentGuides');
        this.alignmentGuides = null;

        // HTML-слои (текст и ручки) также нужно корректно уничтожать,
        // чтобы удалить DOM и отписаться от глобальных слушателей resize/DPR
        this._safeDestroy(this.htmlTextLayer, 'htmlTextLayer');
        this.htmlTextLayer = null;

        this._safeDestroy(this.htmlHandlesLayer, 'htmlHandlesLayer');
        this.htmlHandlesLayer = null;
        
        this._safeDestroy(this.commentPopover, 'commentPopover');
        this.commentPopover = null;
        
        this._safeDestroy(this.contextMenu, 'contextMenu');
        this.contextMenu = null;
        
        this._safeDestroy(this.zoombar, 'zoombar');
        this.zoombar = null;
        
        this._safeDestroy(this.mapbar, 'mapbar');
        this.mapbar = null;
        
        // Уничтожаем ядро
        this._safeDestroy(this.coreMoodboard, 'coreMoodboard');
        this.coreMoodboard = null;
        
        // Уничтожаем workspace
        this._safeDestroy(this.workspaceManager, 'workspaceManager');
        this.workspaceManager = null;
        
        // Очищаем ссылки на менеджеры
        this.dataManager = null;
        this.actionHandler = null;
        
        // Удаляем корневой класс и очищаем ссылку на контейнер
        if (this.container) {
            this.container.classList.remove('moodboard-root');
        }
        this.container = null;

        // Сбрасываем глобальные ссылки на слои, если они устанавливались
        if (typeof window !== 'undefined') {
            if (window.moodboardHtmlTextLayer === this.htmlTextLayer) {
                window.moodboardHtmlTextLayer = null;
            }
            if (window.moodboardHtmlHandlesLayer === this.htmlHandlesLayer) {
                window.moodboardHtmlHandlesLayer = null;
            }
        }
        
        // Вызываем коллбек onDestroy
        if (typeof this.options.onDestroy === 'function') {
            try {
                this.options.onDestroy();
            } catch (error) {
                console.warn('⚠️ Ошибка в коллбеке onDestroy:', error);
            }
        }
    }
    
    /**
     * Настройка коллбеков событий
     */
    setupEventCallbacks() {
        if (!this.coreMoodboard || !this.coreMoodboard.eventBus) return;
        
        // Коллбек для успешного сохранения
        if (typeof this.options.onSave === 'function') {
            this.coreMoodboard.eventBus.on('save:success', (data) => {
                try {
                    // Создаем объединенный скриншот с HTML текстом
                    let screenshot = null;
                    if (this.coreMoodboard.pixi && this.coreMoodboard.pixi.app && this.coreMoodboard.pixi.app.view) {
                        screenshot = this.createCombinedScreenshot('image/jpeg', 0.6);
                    }
                    
                    this.options.onSave({ 
                        success: true, 
                        data: data,
                        screenshot: screenshot,
                        boardId: this.options.boardId
                    });
                } catch (error) {
                    console.warn('⚠️ Ошибка в коллбеке onSave:', error);
                }
            });
            
            // Коллбек для ошибки сохранения
            this.coreMoodboard.eventBus.on('save:error', (data) => {
                try {
                    this.options.onSave({ 
                        success: false, 
                        error: data.error,
                        boardId: this.options.boardId
                    });
                } catch (error) {
                    console.warn('⚠️ Ошибка в коллбеке onSave:', error);
                }
            });
        }
    }
    
    /**
     * Получение CSRF токена из всех возможных источников
     */
    getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 
               window.csrfToken || 
               this.options.csrfToken ||
               '';
    }
    
    /**
     * Публичный метод для загрузки данных из API
     */
    async loadFromApi(boardId = null) {
        const targetBoardId = boardId || this.options.boardId;
        if (!targetBoardId) {
            throw new Error('boardId не указан');
        }
        
        // Временно меняем boardId для загрузки
        const originalBoardId = this.options.boardId;
        this.options.boardId = targetBoardId;
        
        try {
            await this.loadExistingBoard();
        } finally {
            // Восстанавливаем оригинальный boardId
            this.options.boardId = originalBoardId;
        }
    }
    
    /**
     * Публичный метод для экспорта скриншота с HTML текстом
     */
    exportScreenshot(format = 'image/jpeg', quality = 0.6) {
        return this.createCombinedScreenshot(format, quality);
    }
    
    /**
     * Разбивает текст на строки с учетом ширины элемента (имитирует HTML word-break: break-word)
     */
    wrapText(ctx, text, maxWidth) {
        const lines = [];
        
        if (!text || maxWidth <= 0) {
            return [text];
        }
        
        // Разбиваем по символам если не помещается (имитирует word-break: break-word)
        let currentLine = '';
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                // Текущая строка не помещается, сохраняем предыдущую
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        
        // Добавляем последнюю строку
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.length > 0 ? lines : [text];
    }
    
    /**
     * Создает объединенный скриншот: PIXI canvas + HTML текстовые элементы
     */
    createCombinedScreenshot(format = 'image/jpeg', quality = 0.6) {
        if (!this.coreMoodboard || !this.coreMoodboard.pixi || !this.coreMoodboard.pixi.app || !this.coreMoodboard.pixi.app.view) {
            throw new Error('Canvas не найден');
        }
        
        try {
            // Получаем PIXI canvas
            const pixiCanvas = this.coreMoodboard.pixi.app.view;
            const pixiWidth = pixiCanvas.width;
            const pixiHeight = pixiCanvas.height;
            
            // Создаем временный canvas для объединения
            const combinedCanvas = document.createElement('canvas');
            combinedCanvas.width = pixiWidth;
            combinedCanvas.height = pixiHeight;
            const ctx = combinedCanvas.getContext('2d');
            
            // 1. Рисуем PIXI canvas как основу
            ctx.drawImage(pixiCanvas, 0, 0);
            
            // 2. Рисуем HTML текстовые элементы поверх
            const textElements = document.querySelectorAll('.mb-text');
            
            textElements.forEach((textEl, index) => {
                try {
                    // Получаем стили и позицию элемента
                    const computedStyle = window.getComputedStyle(textEl);
                    const text = textEl.textContent || '';
                    
                    // Проверяем видимость
                    if (computedStyle.visibility === 'hidden' || computedStyle.opacity === '0' || !text.trim()) {
                        return;
                    }
                    
                    // Используем CSS позицию (абсолютная позиция)
                    const left = parseInt(textEl.style.left) || 0;
                    const top = parseInt(textEl.style.top) || 0;
                    
                    // Настраиваем стили текста
                    const fontSize = parseInt(computedStyle.fontSize) || 18;
                    const fontFamily = computedStyle.fontFamily || 'Arial, sans-serif';
                    const color = computedStyle.color || '#000000';
                    
                    ctx.font = `${fontSize}px ${fontFamily}`;
                    ctx.fillStyle = color;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    
                    // Получаем размеры элемента
                    const elementWidth = parseInt(textEl.style.width) || 182;
                    
                    // Разбиваем текст на строки и рисуем каждую строку
                    const lines = this.wrapText(ctx, text, elementWidth);
                    const lineHeight = fontSize * 1.3; // Межстрочный интервал
                    
                    lines.forEach((line, lineIndex) => {
                        const yPos = top + (lineIndex * lineHeight) + 2;
                        ctx.fillText(line, left, yPos);
                    });
                } catch (error) {
                    console.warn(`⚠️ Ошибка при рисовании текста ${index + 1}:`, error);
                }
            });
            
            // 3. Экспортируем объединенный результат
            return combinedCanvas.toDataURL(format, quality);
            
        } catch (error) {
            console.warn('⚠️ Ошибка при создании объединенного скриншота, используем только PIXI canvas:', error);
            // Fallback: только PIXI canvas
            const canvas = this.coreMoodboard.pixi.app.view;
            return canvas.toDataURL(format, quality);
        }
    }
}
