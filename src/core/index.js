import { PixiEngine } from './PixiEngine.js';
import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
import { KeyboardManager } from './KeyboardManager.js';
import { SaveManager } from './SaveManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import { SelectTool } from '../tools/object-tools/SelectTool.js';

export class CoreMoodBoard {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!this.container) {
            throw new Error('Container not found');
        }

        this.options = {
            boardId: null,
            autoSave: false,
            width: this.container.clientWidth || 800,
            height: this.container.clientHeight || 600,
            backgroundColor: 0xF5F5F5,
            ...options
        };

        this.eventBus = new EventBus();
        this.state = new StateManager(this.eventBus);
        this.pixi = new PixiEngine(this.container, this.eventBus, this.options);
        this.keyboard = new KeyboardManager(this.eventBus);
        this.saveManager = new SaveManager(this.eventBus, this.options);
        this.toolManager = null; // Инициализируется в init()

        // Убираем автоматический вызов init() - будет вызываться вручную
    }

    async init() {
        try {
            await this.pixi.init();
            this.keyboard.startListening(); // Запускаем прослушивание клавиатуры

            // Инициализируем систему инструментов
            this.initTools();

            // Создаем пустую доску для демо
            this.state.loadBoard({
                id: this.options.boardId || 'demo',
                name: 'Demo Board',
                objects: [],
                viewport: { x: 0, y: 0, zoom: 1 }
            });

            console.log('MoodBoard initialized');
        } catch (error) {
            console.error('MoodBoard init failed:', error);
        }
    }

    /**
     * Инициализация системы инструментов
     */
    initTools() {
        // Получаем canvas элемент для обработки событий
        const canvasElement = this.pixi.app.view;
        
        // Создаем ToolManager
        this.toolManager = new ToolManager(this.eventBus, canvasElement);
        
        // Регистрируем инструменты
        const selectTool = new SelectTool(this.eventBus);
        this.toolManager.registerTool(selectTool);
        
        // Активируем SelectTool по умолчанию
        this.toolManager.activateTool('select');
        
        // Подписываемся на события инструментов
        this.setupToolEvents();
        this.setupKeyboardEvents();
        this.setupSaveEvents();
        
        console.log('Tools system initialized');
    }

    /**
     * Настройка обработчиков событий инструментов
     */
    setupToolEvents() {
        // События выделения
        this.eventBus.on('tool:selection:add', (data) => {
            console.log('Object selected:', data.object);
        });

        this.eventBus.on('tool:selection:clear', (data) => {
            console.log('Selection cleared');
        });

        // События перетаскивания
        this.eventBus.on('tool:drag:start', (data) => {
            console.log('Drag started:', data.object);
        });

        this.eventBus.on('tool:drag:update', (data) => {
            // Обновляем позицию объекта в PIXI
            this.updateObjectPosition(data.object, data.position);
        });

        this.eventBus.on('tool:drag:end', (data) => {
            console.log('Drag ended:', data.object);
        });

        // Hit testing
        this.eventBus.on('tool:hit:test', (data) => {
            const result = this.pixi.hitTest(data.x, data.y);
            data.result = result;
        });

        // Получение позиции объекта
        this.eventBus.on('tool:get:object:position', (data) => {
            const pixiObject = this.pixi.objects.get(data.objectId);
            if (pixiObject) {
                data.position = { x: pixiObject.x, y: pixiObject.y };
            }
        });
    }

    /**
     * Настройка обработчиков клавиатурных событий
     */
    setupKeyboardEvents() {
        // Выделение всех объектов
        this.eventBus.on('keyboard:select-all', () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                this.toolManager.getActiveTool().selectAll();
            }
        });

        // Удаление выделенных объектов
        this.eventBus.on('keyboard:delete', () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                const selectedObjects = this.toolManager.getActiveTool().selectedObjects;
                for (const objectId of selectedObjects) {
                    this.deleteObject(objectId);
                }
                this.toolManager.getActiveTool().clearSelection();
            }
        });

        // Отмена выделения
        this.eventBus.on('keyboard:escape', () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                this.toolManager.getActiveTool().clearSelection();
            }
        });

        // Переключение инструментов
        this.eventBus.on('keyboard:tool-select', (data) => {
            if (this.toolManager.hasActiveTool(data.tool)) {
                this.toolManager.activateTool(data.tool);
            }
        });

        // Перемещение объектов стрелками
        this.eventBus.on('keyboard:move', (data) => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                const selectedObjects = this.toolManager.getActiveTool().selectedObjects;
                const { direction, step } = data;
                
                for (const objectId of selectedObjects) {
                    const pixiObject = this.pixi.objects.get(objectId);
                    if (pixiObject) {
                        switch (direction) {
                            case 'up':
                                pixiObject.y -= step;
                                break;
                            case 'down':
                                pixiObject.y += step;
                                break;
                            case 'left':
                                pixiObject.x -= step;
                                break;
                            case 'right':
                                pixiObject.x += step;
                                break;
                        }
                    }
                }
            }
        });

        // TODO: Реализовать копирование/вставку
        this.eventBus.on('keyboard:copy', () => {
            console.log('Copy: будет реализовано позже');
        });

        this.eventBus.on('keyboard:paste', () => {
            console.log('Paste: будет реализовано позже');
        });

        // TODO: Реализовать undo/redo
        this.eventBus.on('keyboard:undo', () => {
            console.log('Undo: будет реализовано позже');
        });

        this.eventBus.on('keyboard:redo', () => {
            console.log('Redo: будет реализовано позже');
        });
    }

    /**
     * Настройка обработчиков событий сохранения
     */
    setupSaveEvents() {
        // Предоставляем данные для сохранения
        this.eventBus.on('save:get-board-data', (requestData) => {
            requestData.data = this.getBoardData();
        });

        // Обработка статуса сохранения
        this.eventBus.on('save:status-changed', (data) => {
            // Можно добавить UI индикатор статуса сохранения
            console.log(`Save status: ${data.status}`, data.message);
        });

        // Обработка ошибок сохранения
        this.eventBus.on('save:error', (data) => {
            console.error('Save error:', data.error);
            // Можно показать уведомление пользователю
        });

        // Обработка успешного сохранения
        this.eventBus.on('save:success', (data) => {
            console.log('Data saved successfully at:', data.timestamp);
        });
    }

    /**
     * Обновление позиции объекта в PIXI
     */
    updateObjectPosition(objectId, position) {
        const pixiObject = this.pixi.objects.get(objectId);
        if (pixiObject) {
            pixiObject.x = position.x;
            pixiObject.y = position.y;
        }
    }

    createObject(type, position, properties = {}) {
        const objectData = {
            id: 'obj_' + Date.now(),
            type,
            position,
            width: 100,
            height: 100,
            properties,
            created: new Date().toISOString()
        };

        this.state.addObject(objectData);
        this.pixi.createObject(objectData);

        // Уведомляем о создании объекта для автосохранения
        this.eventBus.emit('object:created', { objectId: objectData.id, objectData });

        return objectData;
    }

    deleteObject(objectId) {
        this.state.removeObject(objectId);
        this.pixi.removeObject(objectId);

        // Уведомляем об удалении объекта для автосохранения
        this.eventBus.emit('object:deleted', { objectId });
    }

    get objects() {
        return this.state.getObjects();
    }

    get boardData() {
        return this.state.serialize();
    }

    /**
     * Получение данных доски для сохранения
     */
    getBoardData() {
        return this.state.serialize();
    }

    destroy() {
        this.saveManager.destroy();
        this.keyboard.destroy();
        this.pixi.destroy();
        this.eventBus.removeAllListeners();
    }
}
