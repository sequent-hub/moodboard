import { Events } from '../core/events/Events.js';
import cursorDefaultSvg from '../assets/icons/cursor-default.svg?raw';
import { ToolActivationController } from './manager/ToolActivationController.js';
import { ToolEventRouter } from './manager/ToolEventRouter.js';
import { ToolManagerGuards } from './manager/ToolManagerGuards.js';
import { ToolManagerLifecycle } from './manager/ToolManagerLifecycle.js';
import { ToolRegistry } from './manager/ToolRegistry.js';

// Масштабируем курсор в 2 раза меньше
const _scaledCursorSvg = (() => {
    try {
        return cursorDefaultSvg
            .replace(/width="[^"]+"/i, 'width="25px"')
            .replace(/height="[^"]+"/i, 'height="25px"');
    } catch (_) {
        return cursorDefaultSvg;
    }
})();
const DEFAULT_CURSOR = '';

/**
 * Менеджер инструментов - управляет активными инструментами и переключением между ними
 */
export class ToolManager {
    constructor(eventBus, container, pixiApp = null, core = null) {
        this.eventBus = eventBus;
        this.container = container; // DOM элемент для обработки событий
        this.pixiApp = pixiApp; // PIXI Application для передачи в инструменты
        this.core = core; // Ссылка на core для доступа к imageUploadService
        this.tools = new Map();
        this.registry = new ToolRegistry(this);
        this.activation = new ToolActivationController(this);
        this.activeTool = null;
        this.defaultTool = null;
        
        // Состояние для временных инструментов
        this.temporaryTool = null;
        this.previousTool = null;
        this.spacePressed = false;
        this.isMouseDown = false;
        // Последняя позиция курсора относительно контейнера (CSS-пиксели)
        this.lastMousePos = null;
        this.isMouseOverContainer = false;
        this._originalPixiCursorStyles = null;
        
        // Устанавливаем курсор по умолчанию на контейнер, если инструмент ещё не активирован
        if (this.container) {
            this.container.style.cursor = DEFAULT_CURSOR; // пусто → берётся глобальный CSS-курсор
        }

        this.initEventListeners();
    }
    
    /**
     * Регистрирует инструмент
     */
    registerTool(tool) {
        this.registry.register(tool);
    }
    
    /**
     * Активирует инструмент
     */
    activateTool(toolName) {
        return this.activation.activateTool(toolName);
    }
    
    /**
     * Временно активирует инструмент (с возвратом к предыдущему)
     */
    activateTemporaryTool(toolName) {
        this.activation.activateTemporaryTool(toolName);
    }
    
    /**
     * Возвращается к предыдущему инструменту
     */
    returnToPreviousTool() {
        this.activation.returnToPreviousTool();
    }
    
    /**
     * Возвращается к инструменту по умолчанию
     */
    activateDefaultTool() {
        this.activation.activateDefaultTool();
    }
    
    /**
     * Получает активный инструмент
     */
    getActiveTool() {
        return this.activeTool;
    }
    
    /**
     * Получает список всех инструментов
     */
    getAllTools() {
        return this.registry.getAll();
    }
    
    /**
     * Проверяет, зарегистрирован ли инструмент
     */
    hasActiveTool(toolName) {
        return this.registry.has(toolName);
    }
    
    /**
     * Инициализирует обработчики событий DOM
     */
    initEventListeners() {
        ToolManagerLifecycle.initEventListeners(this, DEFAULT_CURSOR);
    }
    
    /**
     * Обработчики DOM событий
     */
    
    handleMouseDown(e) {
        return ToolEventRouter.handleMouseDown(this, e);
    }

    // Поддержка панорамирования средней кнопкой мыши без переключения инструмента
    handleAuxPanStart(e) {
        return ToolEventRouter.handleAuxPanStart(this, e);
    }

    handleAuxPanEnd(e) {
        return ToolEventRouter.handleAuxPanEnd(this, e);
    }
    
    handleMouseMove(e) {
        return ToolEventRouter.handleMouseMove(this, e);
    }

    isCursorLockedToActiveTool() {
        return ToolManagerGuards.isCursorLockedToActiveTool(this);
    }

    getPixiCursorStyles() {
        return ToolManagerGuards.getPixiCursorStyles(this);
    }

    getActiveToolCursor() {
        return ToolManagerGuards.getActiveToolCursor(this, DEFAULT_CURSOR);
    }

    syncActiveToolCursor() {
        const cursorStyles = this.getPixiCursorStyles();
        const lockCursor = this.isCursorLockedToActiveTool();
        const activeCursor = this.getActiveToolCursor();

        if (cursorStyles && !this._originalPixiCursorStyles) {
            this._originalPixiCursorStyles = {
                pointer: cursorStyles.pointer,
                default: cursorStyles.default
            };
        }

        if (cursorStyles) {
            if (lockCursor) {
                cursorStyles.pointer = activeCursor;
                cursorStyles.default = activeCursor;
            } else if (this._originalPixiCursorStyles) {
                cursorStyles.pointer = this._originalPixiCursorStyles.pointer;
                cursorStyles.default = this._originalPixiCursorStyles.default;
            }
        }

        if (lockCursor && this.pixiApp && this.pixiApp.view) {
            this.pixiApp.view.style.cursor = activeCursor;
        }
    }
    
    handleMouseUp(e) {
        return ToolEventRouter.handleMouseUp(this, e);
    }
    
    handleDoubleClick(e) {
        return ToolEventRouter.handleDoubleClick(this, e);
    }
    
    handleMouseWheel(e) {
        return ToolEventRouter.handleMouseWheel(this, e);
    }

    async handleDrop(e) {
        return ToolEventRouter.handleDrop(this, e);
    }
    
    handleKeyDown(e) {
        return ToolEventRouter.handleKeyDown(this, e);
    }
    
    handleKeyUp(e) {
        return ToolEventRouter.handleKeyUp(this, e);
    }
    
    /**
     * Обработка горячих клавиш
     */
    handleHotkeys(e) {
        return ToolEventRouter.handleHotkeys(this, e);
    }
    
    /**
     * Обработка отпускания пробела
     */
    handleSpaceUp(e) {
        if (e.key === ' ' && this.temporaryTool === 'pan') {
            this.returnToPreviousTool();
        }
    }
    
    /**
     * Очистка ресурсов
     */
    destroy() {
        ToolManagerLifecycle.destroy(this);
    }
}
