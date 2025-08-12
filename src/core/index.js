import { PixiEngine } from './PixiEngine.js';
import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
import { KeyboardManager } from './KeyboardManager.js';
import { SaveManager } from './SaveManager.js';
import { HistoryManager } from './HistoryManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import { SelectTool } from '../tools/object-tools/SelectTool.js';
import { CreateObjectCommand, DeleteObjectCommand, MoveObjectCommand, ResizeObjectCommand } from './commands/index.js';

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
        
        // Для отслеживания изменения размера
        this.resizeStartSize = null;
        
        // Буфер обмена для копирования/вставки
        this.clipboard = null;

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
        this.toolManager = new ToolManager(this.eventBus, canvasElement, this.pixi.app);
        
        // Регистрируем инструменты
        const selectTool = new SelectTool(this.eventBus);
        this.toolManager.registerTool(selectTool);
        
        // Сохраняем ссылку на selectTool для обновления ручек
        this.selectTool = selectTool;
        
        // Активируем SelectTool по умолчанию
        console.log('🔧 Активируем SelectTool с PIXI app:', !!this.pixi.app);
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
                        command.setEventBus(this.eventBus);
                        this.history.executeCommand(command);
                    }
                }
                this.dragStartPosition = null;
            }
        });

        // События изменения размера
        this.eventBus.on('tool:resize:start', (data) => {
            // Сохраняем начальный размер для команды
            const objects = this.state.getObjects();
            const object = objects.find(obj => obj.id === data.object);
            if (object) {
                this.resizeStartSize = { width: object.width, height: object.height };
            }
        });

        this.eventBus.on('tool:resize:update', (data) => {
            // Во время resize обновляем размер напрямую (без команды)
            // Получаем тип объекта для правильного пересоздания
            const objects = this.state.getObjects();
            const object = objects.find(obj => obj.id === data.object);
            const objectType = object ? object.type : null;
            
            this.updateObjectSizeAndPositionDirect(data.object, data.size, data.position, objectType);
        });

        this.eventBus.on('tool:resize:end', (data) => {
            // В конце создаем одну команду изменения размера
            if (this.resizeStartSize && data.oldSize && data.newSize) {
                // Создаем команду только если размер действительно изменился
                if (data.oldSize.width !== data.newSize.width || 
                    data.oldSize.height !== data.newSize.height) {
                    
                    console.log(`📝 Создаем ResizeObjectCommand:`, {
                        object: data.object,
                        oldSize: data.oldSize,
                        newSize: data.newSize,
                        oldPosition: data.oldPosition,
                        newPosition: data.newPosition
                    });
                    
                    const command = new ResizeObjectCommand(
                        this, 
                        data.object, 
                        data.oldSize, 
                        data.newSize,
                        data.oldPosition,
                        data.newPosition
                    );
                    command.setEventBus(this.eventBus);
                    this.history.executeCommand(command);
                }
            }
            this.resizeStartSize = null;
        });

        // === ОБРАБОТЧИКИ СОБЫТИЙ ВРАЩЕНИЯ ===
        
        this.eventBus.on('tool:rotate:update', (data) => {
            // Во время вращения обновляем угол напрямую
            this.pixi.updateObjectRotation(data.object, data.angle);
        });

        this.eventBus.on('tool:rotate:end', (data) => {
            // В конце создаем команду вращения для Undo/Redo
            if (data.oldAngle !== undefined && data.newAngle !== undefined) {
                // Создаем команду только если угол действительно изменился
                if (Math.abs(data.oldAngle - data.newAngle) > 0.1) {
                    
                    import('../core/commands/RotateObjectCommand.js').then(({ RotateObjectCommand }) => {
                        const command = new RotateObjectCommand(
                            this,
                            data.object,
                            data.oldAngle,
                            data.newAngle
                        );
                        command.setEventBus(this.eventBus);
                        this.history.executeCommand(command);
                    });
                }
            }
        });

        // === ОБРАБОТЧИКИ КОМАНД ВРАЩЕНИЯ ===
        
        this.eventBus.on('object:rotate', (data) => {
            // Обновляем угол в PIXI
            this.pixi.updateObjectRotation(data.objectId, data.angle);
            
            // Обновляем данные в State
            this.updateObjectRotationDirect(data.objectId, data.angle);
            
            // Уведомляем о том, что объект был изменен (для обновления ручек)
            this.eventBus.emit('object:transform:updated', {
                objectId: data.objectId,
                type: 'rotation',
                angle: data.angle
            });
        });

        // Обновляем ручки когда объект изменяется через команды (Undo/Redo)
        this.eventBus.on('object:transform:updated', (data) => {
            console.log(`🔄 Объект ${data.objectId} был изменен через команду, обновляем ручки`);
            // Обновляем ручки если объект выделен
            if (this.selectTool && this.selectTool.selectedObjects.has(data.objectId)) {
                this.selectTool.updateResizeHandles();
            }
        });

        // Hit testing
        this.eventBus.on('tool:hit:test', (data) => {
            const result = this.pixi.hitTest(data.x, data.y);
            console.log(`🔍 PixiEngine hitTest результат:`, result);
            data.result = result;
        });

        // Получение позиции объекта
        this.eventBus.on('tool:get:object:position', (data) => {
            const pixiObject = this.pixi.objects.get(data.objectId);
            if (pixiObject) {
                data.position = { x: pixiObject.x, y: pixiObject.y };
            }
        });

        // Получение PIXI объекта
        this.eventBus.on('tool:get:object:pixi', (data) => {
            console.log(`🔍 Запрос PIXI объекта для ${data.objectId}`);
            console.log('📋 Доступные PIXI объекты:', Array.from(this.pixi.objects.keys()));
            
            const pixiObject = this.pixi.objects.get(data.objectId);
            if (pixiObject) {
                console.log(`✅ PIXI объект найден для ${data.objectId}`);
                data.pixiObject = pixiObject;
            } else {
                console.log(`❌ PIXI объект НЕ найден для ${data.objectId}`);
            }
        });

        // Получение размера объекта
        this.eventBus.on('tool:get:object:size', (data) => {
            const objects = this.state.getObjects();
            const object = objects.find(obj => obj.id === data.objectId);
            if (object) {
                data.size = { width: object.width, height: object.height };
            }
        });

        // Получение угла поворота объекта
        this.eventBus.on('tool:get:object:rotation', (data) => {
            const pixiObject = this.pixi.objects.get(data.objectId);
            if (pixiObject) {
                // Конвертируем радианы в градусы
                data.rotation = pixiObject.rotation * 180 / Math.PI;
            } else {
                data.rotation = 0;
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

        // Копирование выделенных объектов
        this.eventBus.on('keyboard:copy', () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                const selectedObjects = this.toolManager.getActiveTool().selectedObjects;
                if (selectedObjects.size > 0) {
                    // Копируем первый выделенный объект (позже можно расширить для множественного выделения)
                    const firstObjectId = Array.from(selectedObjects)[0];
                    this.copyObject(firstObjectId);
                }
            }
        });

        // Вставка объектов из буфера обмена
        this.eventBus.on('keyboard:paste', () => {
            if (this.clipboard && this.clipboard.type === 'object') {
                // Вставляем объект без указания позиции - PasteObjectCommand сам рассчитает смещение
                this.pasteObject();
            }
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
        command.setEventBus(this.eventBus);
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

    /**
     * Обновить угол поворота объекта напрямую (без команды)
     */
    updateObjectRotationDirect(objectId, angle) {
        const objects = this.state.getObjects();
        const object = objects.find(obj => obj.id === objectId);
        if (object) {
            object.rotation = angle;
            this.state.markDirty();
            console.log(`🔄 Угол объекта ${objectId} обновлен: ${angle}°`);
        }
    }

    /**
     * Прямое обновление размера и позиции объекта (без команды)
     * Используется во время изменения размера для плавного изменения
     */
    updateObjectSizeAndPositionDirect(objectId, size, position = null, objectType = null) {
        // Обновляем размер в PIXI
        this.pixi.updateObjectSize(objectId, size, objectType);
        
        // Обновляем позицию если передана (для левых/верхних ручек)
        if (position) {
            const pixiObject = this.pixi.objects.get(objectId);
            if (pixiObject) {
                console.log(`📍 Устанавливаем позицию объекта: (${position.x}, ${position.y})`);
                pixiObject.x = position.x;
                pixiObject.y = position.y;
                
                // Обновляем позицию в состоянии
                const objects = this.state.state.objects;
                const object = objects.find(obj => obj.id === objectId);
                if (object) {
                    object.position.x = position.x;
                    object.position.y = position.y;
                }
            }
        }
        
        // Обновляем размер в состоянии (без эмита события)
        const objects = this.state.state.objects;
        const object = objects.find(obj => obj.id === objectId);
        if (object) {
            object.width = size.width;
            object.height = size.height;
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
            created: new Date().toISOString(),
            transform: {
                pivotCompensated: false  // Новые объекты еще не скомпенсированы
            }
        };

        // Создаем и выполняем команду создания объекта
        const command = new CreateObjectCommand(this, objectData);
        this.history.executeCommand(command);

        return objectData;
    }

    /**
     * Копирует выбранный объект в буфер обмена
     */
    async copyObject(objectId) {
        const { CopyObjectCommand } = await import('./commands/CopyObjectCommand.js');
        const command = new CopyObjectCommand(this, objectId);
        command.execute(); // Копирование не добавляется в историю, так как не меняет состояние
    }

    /**
     * Вставляет объект из буфера обмена
     */
    async pasteObject(position = null) {
        const { PasteObjectCommand } = await import('./commands/PasteObjectCommand.js');
        const command = new PasteObjectCommand(this, position);
        command.setEventBus(this.eventBus);
        this.history.executeCommand(command);
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
