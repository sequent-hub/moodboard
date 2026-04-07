import { PixiEngine } from './PixiEngine.js';
import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
import { KeyboardManager } from './KeyboardManager.js';
import { SaveManager } from './SaveManager.js';
import { HistoryManager } from './HistoryManager.js';
import { ApiClient } from './ApiClient.js';
import { ImageUploadService } from '../services/ImageUploadService.js';
import { FileUploadService } from '../services/FileUploadService.js';
import { GridSnapResolver } from '../services/GridSnapResolver.js';
import { CreateObjectCommand, DeleteObjectCommand, MoveObjectCommand, PasteObjectCommand } from './commands/index.js';
import { Events } from './events/Events.js';
import { generateObjectId } from '../utils/objectIdGenerator.js';
import { initializeCore, initializeCoreTools } from './bootstrap/CoreInitializer.js';
import { setupTransformFlow } from './flows/TransformFlow.js';
import { setupClipboardFlow, setupClipboardKeyboardFlow } from './flows/ClipboardFlow.js';
import { setupObjectLifecycleFlow } from './flows/ObjectLifecycleFlow.js';
import { setupLayerAndViewportFlow } from './flows/LayerAndViewportFlow.js';
import { setupRevitFlow } from './flows/RevitFlow.js';
import { setupSaveFlow } from './flows/SaveFlow.js';
import {
    logMindmapCompoundDebug,
    normalizeMindmapPropertiesForCreate,
} from '../mindmap/MindmapCompoundContract.js';

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

        // Флаг состояния объекта
        this.destroyed = false;

        this.eventBus = new EventBus();
        this.state = new StateManager(this.eventBus);
        
        // Экспонируем EventBus глобально для асинхронных операций (например, из ApiClient)
        if (typeof window !== 'undefined') {
            window.moodboardEventBus = this.eventBus;
        }
        this.pixi = new PixiEngine(this.container, this.eventBus, this.options);
        this.keyboard = new KeyboardManager(this.eventBus, document, this);
        this.saveManager = new SaveManager(this.eventBus, this.options);
        this.history = new HistoryManager(this.eventBus);
        this.apiClient = new ApiClient();
        this.imageUploadService = new ImageUploadService(this.apiClient, {
            requireCsrf: this.options.requireCsrf !== false, // По умолчанию требуем CSRF
            csrfToken: this.options.csrfToken
        });
        this.fileUploadService = new FileUploadService(this.apiClient, {
            requireCsrf: this.options.requireCsrf !== false, // По умолчанию требуем CSRF
            csrfToken: this.options.csrfToken
        });
        this.gridSnapResolver = new GridSnapResolver(this);
        // Объекты, требующие подтверждения сохранения (image/file), показываем только после save:success.
        this._pendingPersistAckVisibilityIds = new Set();
        
        // Связываем SaveManager с ApiClient для правильной обработки изображений
        this.saveManager.setApiClient(this.apiClient);
        this.toolManager = null; // Инициализируется в init()
        
        // Для отслеживания перетаскивания
        this.dragStartPosition = null;
        
        // Для отслеживания изменения размера
        this.resizeStartSize = null;
        
        // Буфер обмена для копирования/вставки
        this.clipboard = null;
        
        // Защита от повторной регистрации обработчиков при повторном initTools().
        this._toolEventsInitialized = false;
        this._keyboardEventsInitialized = false;
        this._saveEventsInitialized = false;
        this._historyEventsInitialized = false;

        // Убираем автоматический вызов init() - будет вызываться вручную
    }

    async init() {
        await initializeCore(this);
    }

    /**
     * Инициализация системы инструментов
     */
    async initTools() {
        await initializeCoreTools(this);
    }

    /**
     * Настройка обработчиков событий инструментов
     */
    setupToolEvents() {
        if (this._toolEventsInitialized) return;
        this._toolEventsInitialized = true;
        // События выделения
        this.eventBus.on(Events.Tool.SelectionAdd, (data) => {

        });

        this.eventBus.on(Events.Tool.SelectionClear, (data) => {

        });

        // Показ контекстного меню (пока пустое) — передаем вверх координаты и контекст
        this.eventBus.on(Events.Tool.ContextMenuShow, (data) => {
            // Прокидываем событие для UI
            this.eventBus.emit(Events.UI.ContextMenuShow, {
                x: data.x,
                y: data.y,
                context: data.context, // 'canvas' | 'object' | 'group'
                targetId: data.targetId || null,
                items: [] // пока пусто
            });
        });
        setupClipboardFlow(this);
        setupLayerAndViewportFlow(this);
        setupTransformFlow(this);
        setupObjectLifecycleFlow(this);
        setupRevitFlow(this);
    }

    /**
     * Настройка обработчиков клавиатурных событий
     */
    setupKeyboardEvents() {
        if (this._keyboardEventsInitialized) return;
        this._keyboardEventsInitialized = true;
        // Выделение всех объектов
        this.eventBus.on(Events.Keyboard.SelectAll, () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                this.toolManager.getActiveTool().selectAll();
            }
        });

        // Удаление выделенных объектов — через ObjectsDelete для GroupDeleteCommand (один Undo)
        this.eventBus.on(Events.Keyboard.Delete, () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                const ids = Array.from(this.toolManager.getActiveTool().selectedObjects);
                this.eventBus.emit(Events.Tool.ObjectsDelete, { objects: ids });
            }
        });

        // Отмена выделения
        this.eventBus.on(Events.Keyboard.Escape, () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                this.toolManager.getActiveTool().clearSelection();
            }
        });

        // Переключение инструментов
        this.eventBus.on(Events.Keyboard.ToolSelect, (data) => {
            if (this.toolManager.hasActiveTool(data.tool)) {
                this.toolManager.activateTool(data.tool);
            }
        });

        // Перемещение объектов стрелками
        this.eventBus.on(Events.Keyboard.Move, (data) => {
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

        setupClipboardKeyboardFlow(this);

        // Undo/Redo теперь обрабатывается в HistoryManager
    }

    /**
     * Настройка обработчиков событий сохранения
     */
    setupSaveEvents() {
        if (this._saveEventsInitialized) return;
        this._saveEventsInitialized = true;
        setupSaveFlow(this);
    }

    /**
     * Настройка обработчиков событий истории (undo/redo)
     */
    setupHistoryEvents() {
        if (this._historyEventsInitialized) return;
        this._historyEventsInitialized = true;
        // Следим за изменениями истории для обновления UI
        this.eventBus.on(Events.History.Changed, (data) => {
            if (typeof data?.currentCommand === 'string' && data.currentCommand.toLowerCase().includes('mindmap')) {
                logMindmapCompoundDebug('history:changed', {
                    currentCommand: data.currentCommand,
                    canUndo: !!data.canUndo,
                    canRedo: !!data.canRedo,
                    historySize: data.historySize,
                });
            }
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
    updateObjectPositionDirect(objectId, position, options = {}) {
        // position — левый верх (state); приводим к центру в PIXI, используя размеры PIXI объекта
        // Все объекты используют pivot по центру, поэтому логика одинакова для всех
        const pixiObject = this.pixi.objects.get(objectId);
        let nextPosition = position;
        const applySnap = options.snap !== false;
        if (applySnap && pixiObject && this.gridSnapResolver) {
            nextPosition = this.gridSnapResolver.snapWorldTopLeft(position, {
                width: pixiObject.width || 0,
                height: pixiObject.height || 0,
            });
        }
        if (pixiObject) {
            const halfW = (pixiObject.width || 0) / 2;
            const halfH = (pixiObject.height || 0) / 2;
            pixiObject.x = nextPosition.x + halfW;
            pixiObject.y = nextPosition.y + halfH;
        }
        
        // Обновляем позицию в состоянии (без эмита события)
        const objects = this.state.state.objects;
        const object = objects.find(obj => obj.id === objectId);
        if (object) {
            object.position = { ...nextPosition };
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
            if (!object.transform) {
                object.transform = {};
            }
            object.transform.rotation = angle;
            this.state.markDirty();
        }
    }

    /**
     * Прямое обновление размера и позиции объекта (без команды)
     * Используется во время изменения размера для плавного изменения
     */
    updateObjectSizeAndPositionDirect(objectId, size, position = null, objectType = null, options = {}) {
        // Обновляем размер в PIXI
        const pixiObject = this.pixi.objects.get(objectId);
        const prevCenter = pixiObject ? { x: pixiObject.x, y: pixiObject.y } : null;
        this.pixi.updateObjectSize(objectId, size, objectType);

        // Обновляем позицию если передана (state: левый-верх; PIXI: центр)
        if (position) {
            const applySnap = options.snap !== false;
            const snappedPosition = (applySnap && this.gridSnapResolver)
                ? this.gridSnapResolver.snapWorldTopLeft(position, size)
                : position;
            const pixiObject2 = this.pixi.objects.get(objectId);
            if (pixiObject2) {
                const halfW = (size?.width ?? pixiObject2.width ?? 0) / 2;
                const halfH = (size?.height ?? pixiObject2.height ?? 0) / 2;
                pixiObject2.x = snappedPosition.x + halfW;
                pixiObject2.y = snappedPosition.y + halfH;

                // Обновляем позицию в состоянии
                const objects = this.state.state.objects;
                const object = objects.find(obj => obj.id === objectId);
                if (object) {
                    object.position.x = snappedPosition.x;
                    object.position.y = snappedPosition.y;
                }
            }
        } else if (prevCenter) {
            // Если позиция не передана, сохраняем прежний центр (без дрейфа)
            const pixiAfter = this.pixi.objects.get(objectId);
            if (pixiAfter) {
                pixiAfter.x = prevCenter.x;
                pixiAfter.y = prevCenter.y;
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

    createObject(type, position, properties = {}, extraData = {}) {
        const exists = (id) => {
            const inState = (this.state.state.objects || []).some(o => o.id === id);
            const inPixi = this.pixi?.objects?.has ? this.pixi.objects.has(id) : false;
            return inState || inPixi;
        };
        const initialWidth = (properties && typeof properties.width === 'number') ? properties.width : 100;
        const initialHeight = (properties && typeof properties.height === 'number') ? properties.height : 100;
        // Зафиксировать пропорции для эмоджи-иконок (квадрат)
        if (type === 'image' && properties && properties.isEmojiIcon) {
            const s = Math.max(1, Math.round((initialWidth + initialHeight) / 2));
            properties.lockedAspect = true;
            properties.aspect = 1; // квадрат
            properties.width = s;
            properties.height = s;
        }

        // Если создаём НЕ фрейм — проверим, попадает ли центр нового объекта внутрь какого-либо фрейма.
        // Если да, сразу прикрепляем объект к этому фрейму (properties.frameId)
        if (type !== 'frame' && position && this.pixi && typeof this.pixi.findObjectByPosition === 'function') {
            const center = {
                x: position.x + initialWidth / 2,
                y: position.y + initialHeight / 2
            };
            try {
                const hostFrame = this.pixi.findObjectByPosition(center, 'frame');
                if (hostFrame && hostFrame.id) {
                    properties = { ...(properties || {}), frameId: hostFrame.id };
                }
            } catch (e) {
                // fail-safe: не мешаем созданию при ошибке поиска
            }
        }

        // Именование фреймов: "Фрейм N", где N = количество уже пронумерованных фреймов + 1
        if (type === 'frame') {
            try {
                const objects = this.state?.state?.objects || [];
                const numberedCount = objects.filter(o => o && o.type === 'frame').reduce((acc, o) => {
                    const t = o?.properties?.title || '';
                    // Считаем только пронумерованные: "Фрейм <число>"
                    return (/^\s*Фрейм\s+\d+\s*$/i.test(t)) ? acc + 1 : acc;
                }, 0);
                const nextIndex = numberedCount + 1;
                properties = { ...(properties || {}), title: `Фрейм ${nextIndex}` };
            } catch (_) {
                properties = { ...(properties || {}), title: 'Фрейм 1' };
            }
        }
        const snappedCreatePos = this.gridSnapResolver
            ? this.gridSnapResolver.snapWorldTopLeft(position, {
                width: initialWidth,
                height: initialHeight,
            })
            : position;
        const objectData = {
            id: generateObjectId(exists),
            type,
            position: snappedCreatePos,
            width: initialWidth,
            height: initialHeight,
            properties: normalizeMindmapPropertiesForCreate({
                type,
                objectId: null,
                properties,
                existingObjects: this.state?.state?.objects || [],
            }),
            created: new Date().toISOString(),
            transform: {
                pivotCompensated: false  // Новые объекты еще не скомпенсированы
            },
            ...extraData
        };
        if (type === 'image' || type === 'revit-screenshot-img' || type === 'file') {
            const propSrc = typeof properties?.src === 'string' ? properties.src.trim() : '';
            const propUrl = typeof properties?.url === 'string' ? properties.url.trim() : '';
            const normalizedSrc = propSrc || propUrl;
            if (normalizedSrc) {
                objectData.src = normalizedSrc;
            }
            if (objectData.properties && (objectData.properties.src || objectData.properties.url)) {
                objectData.properties = { ...objectData.properties };
                delete objectData.properties.src;
                delete objectData.properties.url;
            }
        }
        objectData.properties = normalizeMindmapPropertiesForCreate({
            type,
            objectId: objectData.id,
            properties: objectData.properties,
            existingObjects: this.state?.state?.objects || [],
        });
        if (type === 'mindmap') {
            logMindmapCompoundDebug('core:create-object', {
                id: objectData.id,
                role: objectData.properties?.mindmap?.role || null,
                compoundId: objectData.properties?.mindmap?.compoundId || null,
                parentId: objectData.properties?.mindmap?.parentId || null,
            });
        }

        // Создаем и выполняем команду создания объекта
        const command = new CreateObjectCommand(this, objectData);
        this.history.executeCommand(command);

        // Строгий UX-контракт: image/file появляются только после успешного сохранения.
        if (this._isPersistAckRequiredType(type)) {
            this._pendingPersistAckVisibilityIds.add(objectData.id);
            this._setObjectVisibility(objectData.id, false);
        }

        return objectData;
    }

    _isPersistAckRequiredType(type) {
        return type === 'image' || type === 'revit-screenshot-img' || type === 'file';
    }

    _setObjectVisibility(objectId, visible) {
        const pixiObject = this.pixi?.objects?.get?.(objectId);
        if (pixiObject) {
            pixiObject.visible = !!visible;
        }
    }

    revealPendingObjectsAfterSave() {
        if (!this._pendingPersistAckVisibilityIds || this._pendingPersistAckVisibilityIds.size === 0) return;
        for (const objectId of this._pendingPersistAckVisibilityIds) {
            this._setObjectVisibility(objectId, true);
        }
        this._pendingPersistAckVisibilityIds.clear();
    }

    // === Прикрепления к фреймам ===
    // Логика фреймов перенесена в FrameService

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
    pasteObject(position = null) {
        const command = new PasteObjectCommand(this, position);
        command.setEventBus(this.eventBus);
        this.history.executeCommand(command);
    }

    /**
     * Создание объекта из полных данных (для загрузки с сервера)
     */
    createObjectFromData(objectData) {
        // Защита от двойной загрузки одного и того же объекта (дубликаты при повторном вызове loadData)
        try {
            const id = objectData && objectData.id;
            const alreadyInPixi = !!(id && this.pixi && this.pixi.objects && this.pixi.objects.has(id));
            const alreadyInState = !!(id && Array.isArray(this.state?.state?.objects) && this.state.state.objects.some(o => o && o.id === id));
            if (alreadyInPixi || alreadyInState) {
                // Объект уже создан ранее в этой сессии — не добавляем повторно ни в state, ни в PIXI
                return objectData;
            }
        } catch (_) { /* no-op */ }

        // Инициализируем флаг компенсации пивота для загруженных объектов.
        // В state координаты хранятся как левый-верх. PIXI позиционирует по центру (anchor/pivot по центру),
        // поэтому при создании нужно ДОБАВИТЬ половину ширины/высоты (т.е. pivotCompensated должен быть false),
        // чтобы PixiEngine выполнил компенсацию.
        if (!objectData.transform) {
            objectData.transform = {};
        }
        if (objectData.transform.pivotCompensated === undefined) {
            objectData.transform.pivotCompensated = false;
        }
        objectData.properties = normalizeMindmapPropertiesForCreate({
            type: objectData.type,
            objectId: objectData.id || null,
            properties: objectData.properties || {},
            existingObjects: this.state?.state?.objects || [],
        });
        if (objectData.type === 'image' || objectData.type === 'revit-screenshot-img' || objectData.type === 'file') {
            const topSrc = typeof objectData.src === 'string' ? objectData.src.trim() : '';
            const propSrc = typeof objectData.properties?.src === 'string' ? objectData.properties.src.trim() : '';
            const topUrl = typeof objectData.url === 'string' ? objectData.url.trim() : '';
            const propUrl = typeof objectData.properties?.url === 'string' ? objectData.properties.url.trim() : '';
            const normalizedSrc = topSrc || propSrc || topUrl || propUrl;
            if (normalizedSrc) {
                objectData.src = normalizedSrc;
            }
            if (objectData.properties?.src || objectData.properties?.url) {
                objectData.properties = { ...objectData.properties };
                delete objectData.properties.src;
                delete objectData.properties.url;
            }
            if (objectData.url) delete objectData.url;
        }
        if (objectData.type === 'mindmap') {
            logMindmapCompoundDebug('core:load-object', {
                id: objectData.id,
                role: objectData.properties?.mindmap?.role || null,
                compoundId: objectData.properties?.mindmap?.compoundId || null,
                parentId: objectData.properties?.mindmap?.parentId || null,
            });
        }

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
        // Базовые данные доски (объекты и метаданные из state)
        const s = this.state.serialize();
        const boardData = {
            objects: Array.isArray(s.objects) ? s.objects : [],
            name: s.name || s.title || 'Untitled Board',
            description: s.description || null
        };

        // Настройки (settings): фон, сетка, зум, размеры канваса
        const app = this.pixi?.app;
        const rendererBg = app?.renderer?.background?.color ?? app?.renderer?.backgroundColor;
        const toHex = (num) => {
            try { return '#' + Number(num >>> 0).toString(16).padStart(6, '0'); } catch (_) { return '#F5F5F5'; }
        };
        const world = this.pixi?.worldLayer || app?.stage;
        const currentZoom = Math.max(0.02, Math.min(5, world?.scale?.x || 1));
        const currentPan = {
            x: (world?.x ?? 0),
            y: (world?.y ?? 0)
        };
        const canvasW = app?.view?.clientWidth || app?.view?.width || 0;
        const canvasH = app?.view?.clientHeight || app?.view?.height || 0;

        // Сетка: берём то, что накапливается в state.board.grid через BoardService
        const gridState = (this.state?.state?.board && this.state.state.board.grid) ? this.state.state.board.grid : null;
        const gridSettings = (() => {
            if (gridState && gridState.type) {
                // Если храним полные options от serialize(), извлекаем ключевые
                const opts = gridState.options || {};
                // Унификация ключей под формат из задачи
                return {
                    type: gridState.type,
                    size: opts.size || 20,
                    visible: opts.enabled !== false,
                    color: toHex(opts.color ?? 0xE0E0E0)
                };
            }
            return null;
        })();

        const settings = {
            backgroundColor: toHex(rendererBg ?? 0xF5F5F5),
            grid: gridSettings || undefined,
            zoom: { min: 0.1, max: 5.0, default: 1.0, current: currentZoom },
            pan: currentPan,
            canvas: { width: canvasW, height: canvasH }
        };

        const boardId = (this.state?.state?.board && this.state.state.board.id) || this.options?.boardId || null;

        return { id: boardId, boardData, settings };
    }

    /**
     * Получает список дочерних объектов фрейма
     * @param {string} frameId - ID фрейма
     * @returns {string[]} - массив ID дочерних объектов
     */
    _getFrameChildren(frameId) {
        // Пока что возвращаем пустой массив, т.к. логика привязки объектов к фрейму
        // еще не реализована. В будущем здесь будет поиск объектов, которые
        // находятся внутри границ фрейма или связаны с ним другим способом.
        return [];
    }

    /**
     * Получает данные объекта по ID
     * @param {string} objectId 
     * @returns {object | undefined}
     */
    getObjectData(objectId) {
        return this.state.getObjects().find(o => o.id === objectId);
    }

    destroy() {
        // Предотвращаем повторное уничтожение
        if (this.destroyed) {
            console.warn('CoreMoodBoard уже был уничтожен');
            return;
        }
        
        // Устанавливаем флаг уничтожения
        this.destroyed = true;
        
        // Останавливаем ResizeObserver
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        // Уничтожаем менеджеры
        if (this.saveManager) {
            this.saveManager.destroy();
            this.saveManager = null;
        }
        
        if (this.keyboard) {
            this.keyboard.destroy();
            this.keyboard = null;
        }
        
        if (this.history) {
            this.history.destroy();
            this.history = null;
        }
        
        if (this.frameService) {
            this.frameService.detach();
            this.frameService = null;
        }

        if (this.boardService) {
            this.boardService.destroy?.();
            this.boardService = null;
        }
        
        if (this.pixi) {
            this.pixi.destroy();
            this.pixi = null;
        }
        
        // Очищаем EventBus
        const eventBusRef = this.eventBus;
        if (eventBusRef) {
            eventBusRef.removeAllListeners();
            this.eventBus = null;
        }
        
        // Очищаем глобальную ссылку
        if (typeof window !== 'undefined' && window.moodboardEventBus === eventBusRef) {
            window.moodboardEventBus = null;
        }
        
        // Очищаем ссылки на менеджеры
        this.state = null;
        this.toolManager = null;
        this.apiClient = null;
        this.imageUploadService = null;
        this.fileUploadService = null;
        
        // Очищаем контейнер
        this.container = null;
        
        console.log('CoreMoodBoard успешно уничтожен');
    }
}
