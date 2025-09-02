import { Events } from '../core/events/Events.js';

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
        
        // События мыши на контейнере
        this.container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.container.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.container.addEventListener('mouseenter', () => { this.isMouseOverContainer = true; });
        this.container.addEventListener('mouseleave', () => { this.isMouseOverContainer = false; });
        // Убираем отдельные слушатели aux-pan на контейнере, чтобы не дублировать mousedown/mouseup

        // Drag & Drop — поддержка перетаскивания изображений на холст
        this.container.addEventListener('dragenter', (e) => {
            e.preventDefault();
        });
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });
        this.container.addEventListener('dragleave', (e) => {
            // можно снимать подсветку, если добавим в будущем
        });
        this.container.addEventListener('drop', (e) => this.handleDrop(e));

        // Глобальные события мыши — чтобы корректно завершать drag/resize при отпускании за пределами холста
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
            // Гарантированно завершаем временный pan, даже если кнопка отпущена вне холста
            if (this.temporaryTool === 'pan') {
                this.handleAuxPanEnd(e);
            }
        });
        this.container.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.container.addEventListener('wheel', (e) => this.handleMouseWheel(e));
        
        // События клавиатуры (на document)
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Контекстное меню: предотвращаем дефолт и пересылаем событие активному инструменту
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.activeTool) return;
            const rect = this.container.getBoundingClientRect();
            const event = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                originalEvent: e
            };
            if (typeof this.activeTool.onContextMenu === 'function') {
                this.activeTool.onContextMenu(event);
            }
        });
    }
    
    /**
     * Обработчики DOM событий
     */
    
    handleMouseDown(e) {
        if (!this.activeTool) return;
        this.isMouseDown = true;

        // Если удерживается пробел + левая кнопка — сразу запускаем pan и не дергаем активный инструмент
        if (this.spacePressed && e.button === 0) {
            this.handleAuxPanStart(e);
            return;
        }
        // Средняя кнопка — тоже панорамирование без дергания активного инструмента
        if (e.button === 1) {
            this.handleAuxPanStart(e);
            return;
        }
        
        const rect = this.container.getBoundingClientRect();
        const event = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            button: e.button,
            target: e.target,
            originalEvent: e
        };
        
        this.lastMousePos = { x: event.x, y: event.y };
        this.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
        
        this.activeTool.onMouseDown(event);
    }

    // Поддержка панорамирования средней кнопкой мыши без переключения инструмента
    handleAuxPanStart(e) {
        // Средняя кнопка (button === 1) или пробел зажат и левая кнопка
        const isMiddle = e.button === 1;
        const isSpaceLeft = e.button === 0 && this.spacePressed;
        if (!isMiddle && !isSpaceLeft) return;

        // Временная активация pan-инструмента
        if (this.hasActiveTool('pan')) {
            this.previousTool = this.activeTool?.name || null;
            this.activateTemporaryTool('pan');
            // Синтетический mousedown для запуска pan
            const rect = this.container.getBoundingClientRect();
            const event = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                button: 0,
                target: e.target,
                originalEvent: e
            };
            this.lastMousePos = { x: event.x, y: event.y };
            this.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
            this.activeTool.onMouseDown(event);
        }
    }

    handleAuxPanEnd(e) {
        // Завершаем временное панорамирование при отпускании средней/левой (с пробелом)
        if (this.temporaryTool === 'pan') {
            const rect = this.container.getBoundingClientRect();
            const event = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                button: 0,
                target: e.target,
                originalEvent: e
            };
            this.lastMousePos = { x: event.x, y: event.y };
            this.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
            this.activeTool.onMouseUp(event);
            this.returnToPreviousTool();
            return;
        }
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
        
        // Запоминаем и рассылаем позицию курсора для использования другими подсистемами
        this.lastMousePos = { x: event.x, y: event.y };
        this.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
        
        // Если временно активирован pan, проксируем движение именно ему
        if (this.temporaryTool === 'pan' && this.activeTool?.name === 'pan') {
            this.activeTool.onMouseMove(event);
            return;
        }
        this.activeTool.onMouseMove(event);
    }
    
    handleMouseUp(e) {
        if (!this.activeTool) return;
        this.isMouseDown = false;
        
        const rect = this.container.getBoundingClientRect();
        const event = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            button: e.button,
            target: e.target,
            originalEvent: e
        };
        this.lastMousePos = { x: event.x, y: event.y };
        this.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
        if (this.temporaryTool === 'pan') {
            this.handleAuxPanEnd(e);
            return;
        }
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
        this.lastMousePos = { x: event.x, y: event.y };
        this.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
        
        console.log('🔧 ToolManager: Double click event, active tool:', this.activeTool.constructor.name);
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
        this.lastMousePos = { x: event.x, y: event.y };
        this.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
        
        // Глобальный зум колесиком (без Ctrl) — предотвращаем дефолтный скролл страницы
        this.eventBus.emit(Events.Tool.WheelZoom, { x: event.x, y: event.y, delta: e.deltaY });
        e.preventDefault();
        
        // Предотвращаем скроллинг страницы при зуме
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMousePos = { x, y };
        this.eventBus.emit(Events.UI.CursorMove, { x, y });

        const dt = e.dataTransfer;
        if (!dt) return;

        const emitAt = (src, name, imageId = null, offsetIndex = 0) => {
            const offset = 25 * offsetIndex;
            this.eventBus.emit(Events.UI.PasteImageAt, { 
                x: x + offset, 
                y: y + offset, 
                src, 
                name,
                imageId 
            });
        };

        // 1) Файлы с рабочего стола
        const files = dt.files ? Array.from(dt.files) : [];
        const imageFiles = files.filter(f => f.type && f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            let index = 0;
            for (const file of imageFiles) {
                try {
                    // Пытаемся загрузить изображение на сервер
                    if (this.core && this.core.imageUploadService) {
                        const uploadResult = await this.core.imageUploadService.uploadImage(file, file.name || 'image');
                        emitAt(uploadResult.url, uploadResult.name, uploadResult.imageId || uploadResult.id, index++);
                    } else {
                        // Fallback к старому способу (base64)
                        await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => { 
                                emitAt(reader.result, file.name || 'image', null, index++); 
                                resolve(); 
                            };
                            reader.readAsDataURL(file);
                        });
                    }
                } catch (error) {
                    console.warn('Ошибка загрузки изображения через drag-and-drop:', error);
                    // Fallback к base64 при ошибке
                    await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => { 
                            emitAt(reader.result, file.name || 'image', null, index++); 
                            resolve(); 
                        };
                        reader.readAsDataURL(file);
                    });
                }
            }
            return;
        }

        // 2) Перетаскивание с другой вкладки: HTML/URI/PLAIN
        const html = dt.getData('text/html');
        if (html && html.includes('<img')) {
            const m = html.match(/<img[^>]*src\s*=\s*"([^"]+)"/i);
            if (m && m[1]) {
                const url = m[1];
                if (/^data:image\//i.test(url)) { emitAt(url, 'clipboard-image.png'); return; }
                if (/^https?:\/\//i.test(url)) {
                    try {
                        const resp = await fetch(url, { mode: 'cors' });
                        const blob = await resp.blob();
                        const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
                        emitAt(dataUrl, url.split('/').pop() || 'image');
                    } catch (_) {
                        emitAt(url, url.split('/').pop() || 'image');
                    }
                    return;
                }
            }
        }

        const uriList = dt.getData('text/uri-list') || '';
        if (uriList) {
            const lines = uriList.split('\n').filter(l => !!l && !l.startsWith('#'));
            const urls = lines.filter(l => /^https?:\/\//i.test(l));
            let index = 0;
            for (const url of urls) {
                const isImage = /(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
                if (!isImage) continue;
                try {
                    const resp = await fetch(url, { mode: 'cors' });
                    const blob = await resp.blob();
                    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
                    emitAt(dataUrl, url.split('/').pop() || 'image', index++);
                } catch (_) {
                    emitAt(url, url.split('/').pop() || 'image', index++);
                }
            }
            if (index > 0) return;
        }

        const text = dt.getData('text/plain') || '';
        if (text) {
            const trimmed = text.trim();
            const isDataUrl = /^data:image\//i.test(trimmed);
            const isHttpUrl = /^https?:\/\//i.test(trimmed);
            const looksLikeImage = /(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmed);
            if (isDataUrl) { emitAt(trimmed, 'clipboard-image.png'); return; }
            if (isHttpUrl && looksLikeImage) {
                try {
                    const resp = await fetch(trimmed, { mode: 'cors' });
                    const blob = await resp.blob();
                    const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
                    emitAt(dataUrl, trimmed.split('/').pop() || 'image');
                } catch (_) {
                    emitAt(trimmed, trimmed.split('/').pop() || 'image');
                }
                return;
            }
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

        // Тоггл пробела для временного pan
        if (e.key === ' ' && !e.repeat) {
            this.spacePressed = true;
        }
    }
    
    handleKeyUp(e) {
        if (!this.activeTool) return;
        
        const event = {
            key: e.key,
            code: e.code,
            originalEvent: e
        };
        
        this.activeTool.onKeyUp(event);

        if (e.key === ' ') {
            this.spacePressed = false;
            // Если удерживали pan временно, вернуть инструмент
            if (this.temporaryTool === 'pan') {
                // Корректно завершим pan, если мышь ещё зажата
                if (this.activeTool?.name === 'pan' && this.isMouseDown) {
                    this.activeTool.onMouseUp({ x: 0, y: 0, button: 0, target: this.container, originalEvent: e });
                }
                this.returnToPreviousTool();
                return;
            }
        }
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
            this.container.removeEventListener('dragenter', (e) => e.preventDefault());
            this.container.removeEventListener('dragover', (e) => e.preventDefault());
            this.container.removeEventListener('dragleave', () => {});
            this.container.removeEventListener('drop', this.handleDrop);
        }
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
}
