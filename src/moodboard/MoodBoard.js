import { GridFactory } from '../grid/GridFactory.js';
import {
    initCoreMoodBoard as initializeCoreMoodBoard,
    initializeMoodBoard,
} from './bootstrap/MoodBoardInitializer.js';
import {
    createWorkspaceManager,
} from './bootstrap/MoodBoardManagersFactory.js';
import { bindSaveCallbacks } from './integration/MoodBoardEventBindings.js';
import {
    getCsrfToken as getMoodBoardCsrfToken,
    loadExistingBoard as loadExistingMoodBoard,
    loadFromApi as loadMoodBoardFromApi,
} from './integration/MoodBoardLoadApi.js';
import {
    createCombinedScreenshot as createMoodBoardCombinedScreenshot,
    exportScreenshot as exportMoodBoardScreenshot,
    wrapText as wrapMoodBoardText,
} from './integration/MoodBoardScreenshotApi.js';
import { destroyMoodBoard, safeDestroy } from './lifecycle/MoodBoardDestroyer.js';

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
            apiUrl: '/api/v2/moodboard',
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
        createWorkspaceManager(this);
        this.dataManager = null;
        this.actionHandler = null;
        
        this.init();
    }
    
    /**
     * Инициализация рабочего пространства
     */
    async init() {
        await initializeMoodBoard(this);
    }
    
    /**
     * Инициализирует CoreMoodBoard
     */
    async initCoreMoodBoard() {
        await initializeCoreMoodBoard(this);
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
        await loadExistingMoodBoard(this);
    }
    
    /**
     * Безопасное уничтожение объекта с проверкой наличия метода destroy
     * @param {Object} obj - объект для уничтожения
     * @param {string} name - имя объекта для логирования
     */
    _safeDestroy(obj, name) {
        safeDestroy(obj, name);
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        destroyMoodBoard(this);
    }
    
    /**
     * Настройка коллбеков событий
     */
    setupEventCallbacks() {
        bindSaveCallbacks(this);
    }
    
    /**
     * Получение CSRF токена из всех возможных источников
     */
    getCsrfToken() {
        return getMoodBoardCsrfToken(this);
    }
    
    /**
     * Публичный метод для загрузки данных из API
     */
    async loadFromApi(boardId = null, version = null, options = {}) {
        await loadMoodBoardFromApi(this, boardId, version, options);
    }
    
    /**
     * Публичный метод для экспорта скриншота с HTML текстом
     */
    exportScreenshot(format = 'image/jpeg', quality = 0.6) {
        return exportMoodBoardScreenshot(this, format, quality);
    }
    
    /**
     * Разбивает текст на строки с учетом ширины элемента (имитирует HTML word-break: break-word)
     */
    wrapText(ctx, text, maxWidth) {
        return wrapMoodBoardText(ctx, text, maxWidth);
    }
    
    /**
     * Создает объединенный скриншот: PIXI canvas + HTML текстовые элементы
     */
    createCombinedScreenshot(format = 'image/jpeg', quality = 0.6) {
        return createMoodBoardCombinedScreenshot(this, format, quality);
    }
}
