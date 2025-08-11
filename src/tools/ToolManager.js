/**
 * Менеджер инструментов - управляет активными инструментами и переключением между ними
 */
export class ToolManager {
    constructor(eventBus, container, pixiApp = null) {
        this.eventBus = eventBus;
        this.container = container; // DOM элемент для обработки событий
        this.pixiApp = pixiApp; // PIXI Application для передачи в инструменты
        this.tools = new Map();
        this.activeTool = null;
        this.defaultTool = null;
        
        // Состояние для временных инструментов
        this.temporaryTool = null;
        this.previousTool = null;
        
        this.initEventListeners();
    }
    
    /**
     * Регистрирует инструмент
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        
        // Устанавливаем первый инструмент как по умолчанию
        if (!this.defaultTool) {
            this.defaultTool = tool.name;
        }
    }
    
    /**
     * Активирует инструмент
     */
    activateTool(toolName) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            console.warn(`Tool "${toolName}" not found`);
            return false;
        }
        
        // Деактивируем текущий инструмент
        if (this.activeTool) {
            this.activeTool.deactivate();
        }
        
        // Активируем новый инструмент
        this.activeTool = tool;
        
        // Передаем PIXI app в метод activate, если он поддерживается
        if (typeof this.activeTool.activate === 'function') {
            this.activeTool.activate(this.pixiApp);
        }
        
        return true;
    }
    
    /**
     * Временно активирует инструмент (с возвратом к предыдущему)
     */
    activateTemporaryTool(toolName) {
        if (this.activeTool) {
            this.previousTool = this.activeTool.name;
        }
        
        this.activateTool(toolName);
        this.temporaryTool = toolName;
    }
    
    /**
     * Возвращается к предыдущему инструменту
     */
    returnToPreviousTool() {
        if (this.temporaryTool && this.previousTool) {
            this.activateTool(this.previousTool);
            this.temporaryTool = null;
            this.previousTool = null;
        }
    }
    
    /**
     * Возвращается к инструменту по умолчанию
     */
    activateDefaultTool() {
        if (this.defaultTool) {
            this.activateTool(this.defaultTool);
        }
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
        return Array.from(this.tools.values());
    }
    
    /**
     * Проверяет, зарегистрирован ли инструмент
     */
    hasActiveTool(toolName) {
        return this.tools.has(toolName);
    }
    
    /**
     * Инициализирует обработчики событий DOM
     */
    initEventListeners() {
        if (!this.container) return;
        
        // События мыши
        this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.container.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.container.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.container.addEventListener('wheel', (e) => this.handleMouseWheel(e));
        
        // События клавиатуры (на document)
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Предотвращаем контекстное меню
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    /**
     * Обработчики DOM событий
     */
    
    handleMouseDown(e) {
        if (!this.activeTool) return;
        
        const rect = this.container.getBoundingClientRect();
        const event = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            button: e.button,
            target: e.target,
            originalEvent: e
        };
        
        this.activeTool.onMouseDown(event);
    }
    
    handleMouseMove(e) {
        if (!this.activeTool) return;
        
        const rect = this.container.getBoundingClientRect();
        const event = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            target: e.target,
            originalEvent: e
        };
        
        this.activeTool.onMouseMove(event);
    }
    
    handleMouseUp(e) {
        if (!this.activeTool) return;
        
        const rect = this.container.getBoundingClientRect();
        const event = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            button: e.button,
            target: e.target,
            originalEvent: e
        };
        
        this.activeTool.onMouseUp(event);
    }
    
    handleDoubleClick(e) {
        if (!this.activeTool) return;
        
        const rect = this.container.getBoundingClientRect();
        const event = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            target: e.target,
            originalEvent: e
        };
        
        this.activeTool.onDoubleClick(event);
    }
    
    handleMouseWheel(e) {
        if (!this.activeTool) return;
        
        const rect = this.container.getBoundingClientRect();
        const event = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            delta: e.deltaY,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            originalEvent: e
        };
        
        this.activeTool.onMouseWheel(event);
        
        // Предотвращаем скроллинг страницы при зуме
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }
    
    handleKeyDown(e) {
        // Обработка горячих клавиш для переключения инструментов
        this.handleHotkeys(e);
        
        if (!this.activeTool) return;
        
        const event = {
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            originalEvent: e
        };
        
        this.activeTool.onKeyDown(event);
    }
    
    handleKeyUp(e) {
        if (!this.activeTool) return;
        
        const event = {
            key: e.key,
            code: e.code,
            originalEvent: e
        };
        
        this.activeTool.onKeyUp(event);
    }
    
    /**
     * Обработка горячих клавиш
     */
    handleHotkeys(e) {
        // Игнорируем горячие клавиши если фокус в input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ищем инструмент с соответствующей горячей клавишей
        for (const tool of this.tools.values()) {
            if (tool.hotkey === e.key.toLowerCase()) {
                this.activateTool(tool.name);
                e.preventDefault();
                break;
            }
        }
        
        // Специальные горячие клавиши
        switch (e.key) {
            case ' ': // Пробел - временный PanTool
                if (!e.repeat) {
                    this.activateTemporaryTool('pan');
                }
                e.preventDefault();
                break;
                
            case 'Escape': // Escape - возврат к default tool
                this.activateDefaultTool();
                e.preventDefault();
                break;
        }
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
        // Деактивируем все инструменты
        for (const tool of this.tools.values()) {
            tool.destroy();
        }
        
        this.tools.clear();
        this.activeTool = null;
        
        // Удаляем обработчики событий
        if (this.container) {
            this.container.removeEventListener('mousedown', this.handleMouseDown);
            this.container.removeEventListener('mousemove', this.handleMouseMove);
            this.container.removeEventListener('mouseup', this.handleMouseUp);
            this.container.removeEventListener('dblclick', this.handleDoubleClick);
            this.container.removeEventListener('wheel', this.handleMouseWheel);
            this.container.removeEventListener('contextmenu', (e) => e.preventDefault());
        }
        
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
}
