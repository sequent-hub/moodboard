import { PixiEngine } from './PixiEngine.js';
import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
import { KeyboardManager } from './KeyboardManager.js';
import { SaveManager } from './SaveManager.js';
import { HistoryManager } from './HistoryManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import { SelectTool } from '../tools/object-tools/SelectTool.js';
import { CreateObjectCommand, DeleteObjectCommand, MoveObjectCommand } from './commands/index.js';

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
        this.history = new HistoryManager(this.eventBus);
        this.toolManager = null; // Инициализируется в init()
        
        // Для отслеживания перетаскивания
        this.dragStartPosition = null;

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
        this.setupHistoryEvents();
        

    }

    /**
     * Настройка обработчиков событий инструментов
     */
    setupToolEvents() {
        // События выделения
        this.eventBus.on('tool:selection:add', (data) => {

        });

        this.eventBus.on('tool:selection:clear', (data) => {

        });

        // События перетаскивания
        this.eventBus.on('tool:drag:start', (data) => {

            // Сохраняем начальную позицию для команды
            const pixiObject = this.pixi.objects.get(data.object);
            if (pixiObject) {
                this.dragStartPosition = { x: pixiObject.x, y: pixiObject.y };
            }
        });

        this.eventBus.on('tool:drag:update', (data) => {
            // Во время перетаскивания обновляем позицию напрямую (без команды)
            this.updateObjectPositionDirect(data.object, data.position);
        });

        this.eventBus.on('tool:drag:end', (data) => {

            // В конце создаем одну команду перемещения
            if (this.dragStartPosition) {
                const pixiObject = this.pixi.objects.get(data.object);
                if (pixiObject) {
                    const finalPosition = { x: pixiObject.x, y: pixiObject.y };
                    
                    // Создаем команду только если позиция действительно изменилась
                    if (this.dragStartPosition.x !== finalPosition.x || 
                        this.dragStartPosition.y !== finalPosition.y) {
                        
                        const command = new MoveObjectCommand(
                            this, 
                            data.object, 
                            this.dragStartPosition, 
                            finalPosition
                        );
                        this.history.executeCommand(command);
                    }
                }
                this.dragStartPosition = null;
            }
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
            // TODO: Реализовать копирование
        });

        this.eventBus.on('keyboard:paste', () => {
            // TODO: Реализовать вставку
        });

        // Undo/Redo теперь обрабатывается в HistoryManager
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

        });

        // Обработка ошибок сохранения
        this.eventBus.on('save:error', (data) => {
            console.error('Save error:', data.error);
            // Можно показать уведомление пользователю
        });

        // Обработка успешного сохранения
        this.eventBus.on('save:success', (data) => {

        });
    }

    /**
     * Настройка обработчиков событий истории (undo/redo)
     */
    setupHistoryEvents() {
        // Следим за изменениями истории для обновления UI
        this.eventBus.on('history:changed', (data) => {

            
            // Можно здесь обновить состояние кнопок Undo/Redo в UI
            this.eventBus.emit('ui:update-history-buttons', {
                canUndo: data.canUndo,
                canRedo: data.canRedo
            });
        });
    }

    /**
     * Обновление позиции объекта в PIXI и состоянии
     * Теперь работает через команды для поддержки Undo/Redo
     */
    updateObjectPosition(objectId, position) {
        // Получаем старую позицию для команды
        const pixiObject = this.pixi.objects.get(objectId);
        if (!pixiObject) return;
        
        const oldPosition = { x: pixiObject.x, y: pixiObject.y };
        
        // Создаем и выполняем команду перемещения
        const command = new MoveObjectCommand(this, objectId, oldPosition, position);
        this.history.executeCommand(command);
    }

    /**
     * Прямое обновление позиции объекта (без команды)
     * Используется во время перетаскивания для плавного движения
     */
    updateObjectPositionDirect(objectId, position) {
        // Обновляем позицию в PIXI
        const pixiObject = this.pixi.objects.get(objectId);
        if (pixiObject) {
            pixiObject.x = position.x;
            pixiObject.y = position.y;
        }
        
        // Обновляем позицию в состоянии (без эмита события)
        const objects = this.state.state.objects;
        const object = objects.find(obj => obj.id === objectId);
        if (object) {
            object.position = { ...position };
            this.state.markDirty(); // Помечаем для автосохранения
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

        // Создаем и выполняем команду создания объекта
        const command = new CreateObjectCommand(this, objectData);
        this.history.executeCommand(command);

        return objectData;
    }

    /**
     * Создание объекта из полных данных (для загрузки с сервера)
     */
    createObjectFromData(objectData) {
        // Используем существующие данные объекта (с его ID, размерами и т.д.)
        this.state.addObject(objectData);
        this.pixi.createObject(objectData);

        // НЕ эмитируем object:created при загрузке, чтобы не запускать автосохранение
        // Объекты уже сохранены в БД
        
        return objectData;
    }

    deleteObject(objectId) {
        // Создаем и выполняем команду удаления объекта
        const command = new DeleteObjectCommand(this, objectId);
        this.history.executeCommand(command);
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
        this.history.destroy();
        this.pixi.destroy();
        this.eventBus.removeAllListeners();
    }
}
