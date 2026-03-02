import { PixiEngine } from './PixiEngine.js';
import * as PIXI from 'pixi.js';
import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
import { KeyboardManager } from './KeyboardManager.js';
import { SaveManager } from './SaveManager.js';
import { HistoryManager } from './HistoryManager.js';
import { ApiClient } from './ApiClient.js';
import { ImageUploadService } from '../services/ImageUploadService.js';
import { FileUploadService } from '../services/FileUploadService.js';
import { ToolManager } from '../tools/ToolManager.js';
import { SelectTool } from '../tools/object-tools/SelectTool.js';
import { CreateObjectCommand, DeleteObjectCommand, MoveObjectCommand, ResizeObjectCommand, PasteObjectCommand, GroupMoveCommand, GroupRotateCommand, GroupResizeCommand, ReorderZCommand, GroupReorderZCommand, EditFileNameCommand } from './commands/index.js';
import { BoardService } from '../services/BoardService.js';
import { ZoomPanController } from '../services/ZoomPanController.js';
import { ZOrderManager } from '../services/ZOrderManager.js';
import { FrameService } from '../services/FrameService.js';
import { Events } from './events/Events.js';
import { generateObjectId } from '../utils/objectIdGenerator.js';

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
        
        // Связываем SaveManager с ApiClient для правильной обработки изображений
        this.saveManager.setApiClient(this.apiClient);
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
            await this.initTools();

            // Сервисы доски: сетка/миникомапа, зум, порядок слоёв, логика фреймов
            this.boardService = new BoardService(this.eventBus, this.pixi);
            await this.boardService.init(() => (this.workspaceSize?.() || { width: this.options.width, height: this.options.height }));
            this.zoomPan = new ZoomPanController(this.eventBus, this.pixi);
            this.zoomPan.attach();
            this.zOrder = new ZOrderManager(this.eventBus, this.pixi, this.state);
            this.zOrder.attach();
            this.frameService = new FrameService(this.eventBus, this.pixi, this.state);
            this.frameService.attach();

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
    async initTools() {
        // Получаем canvas элемент для обработки событий
        const canvasElement = this.pixi.app.view;
        // Хелпер для размера (используем в init)
        this.workspaceSize = () => ({ width: canvasElement.clientWidth, height: canvasElement.clientHeight });
        
        // Создаем ToolManager
        this.toolManager = new ToolManager(this.eventBus, canvasElement, this.pixi.app, this);
        
        // Регистрируем инструменты
        const selectTool = new SelectTool(this.eventBus);
        this.toolManager.registerTool(selectTool);
        // Панорамирование — регистрируем статически
        const panToolModule = await import('../tools/board-tools/PanTool.js');
        const panTool = new panToolModule.PanTool(this.eventBus);
        this.toolManager.registerTool(panTool);

        // Инструмент рисования (карандаш)
        const drawingToolModule = await import('../tools/object-tools/DrawingTool.js');
        const drawingTool = new drawingToolModule.DrawingTool(this.eventBus);
        this.toolManager.registerTool(drawingTool);

        // Инструмент размещения объектов по клику (универсальный)
        const placementToolModule = await import('../tools/object-tools/PlacementTool.js');
        const placementTool = new placementToolModule.PlacementTool(this.eventBus, this);
        this.toolManager.registerTool(placementTool);

        // Инструмент текста
        const textToolModule = await import('../tools/object-tools/TextTool.js');
        const textTool = new textToolModule.TextTool(this.eventBus);
        this.toolManager.registerTool(textTool);
        
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

        // Действия из UI контекстного меню
        this.eventBus.on(Events.UI.CopyObject, ({ objectId }) => {
            if (!objectId) return;
            this.copyObject(objectId);
        });

        this.eventBus.on(Events.UI.CopyGroup, () => {
            if (this.toolManager.getActiveTool()?.name !== 'select') return;
            const selected = Array.from(this.toolManager.getActiveTool().selectedObjects || []);
            if (selected.length <= 1) return;
            const objects = this.state.state.objects || [];
            const groupData = selected
                .map(id => objects.find(o => o.id === id))
                .filter(Boolean)
                .map(o => JSON.parse(JSON.stringify(o)));
            if (groupData.length === 0) return;
            this.clipboard = {
                type: 'group',
                data: groupData,
                meta: { pasteCount: 0 }
            };
        });

        this.eventBus.on(Events.UI.PasteAt, ({ x, y }) => {
            if (!this.clipboard) return;
            if (this.clipboard.type === 'object') {
                this.pasteObject({ x, y });
            } else if (this.clipboard.type === 'group') {
                const group = this.clipboard;
                const data = Array.isArray(group.data) ? group.data : [];
                if (data.length === 0) return;

                // Особая логика: если это бандл фрейма (фрейм + дети)
                if (group.meta && group.meta.frameBundle) {
                    // Вычисляем топ-левт группы для относительного смещения клик-точки
                    let minX = Infinity, minY = Infinity;
                    data.forEach(o => {
                        if (!o || !o.position) return;
                        minX = Math.min(minX, o.position.x);
                        minY = Math.min(minY, o.position.y);
                    });
                    if (!isFinite(minX) || !isFinite(minY)) return;
                    const baseX = minX, baseY = minY;

                    // Ищем фрейм в бандле
                    const frames = data.filter(o => o && o.type === 'frame');
                    if (frames.length !== 1) {
                        // fallback к обычной вставке группы
                        const newIds = [];
                        let pending = data.length;
                        const onPasted = (payload) => {
                            if (!payload || !payload.newId) return;
                            newIds.push(payload.newId);
                            pending -= 1;
                            if (pending === 0) {
                                this.eventBus.off(Events.Object.Pasted, onPasted);
                                requestAnimationFrame(() => {
                                    if (this.selectTool && newIds.length > 0) {
                                        this.selectTool.setSelection(newIds);
                                        this.selectTool.updateResizeHandles();
                                    }
                                });
                            }
                        };
                        this.eventBus.on(Events.Object.Pasted, onPasted);
                        data.forEach(orig => {
                            const cloned = JSON.parse(JSON.stringify(orig));
                            const targetPos = {
                                x: x + (cloned.position.x - baseX),
                                y: y + (cloned.position.y - baseY)
                            };
                            this.clipboard = { type: 'object', data: cloned };
                            const cmd = new PasteObjectCommand(this, targetPos);
                            cmd.setEventBus(this.eventBus);
                            this.history.executeCommand(cmd);
                        });
                        this.clipboard = group;
                        return;
                    }

                    const frameOriginal = frames[0];
                    const children = data.filter(o => o && o.id !== frameOriginal.id);
                    const totalToPaste = 1 + children.length;
                    const newIds = [];
                    let pastedCount = 0;
                    let newFrameId = null;

                    const onPasted = (payload) => {
                        if (!payload || !payload.newId) return;
                        newIds.push(payload.newId);
                        pastedCount += 1;
                        // Как только вставили фрейм — вставляем детей с новым frameId
                        if (!newFrameId && payload.originalId === frameOriginal.id) {
                            newFrameId = payload.newId;
                            for (const child of children) {
                                const clonedChild = JSON.parse(JSON.stringify(child));
                                clonedChild.properties = clonedChild.properties || {};
                                clonedChild.properties.frameId = newFrameId;
                                const targetPos = {
                                    x: x + (clonedChild.position.x - baseX),
                                    y: y + (clonedChild.position.y - baseY)
                                };
                                this.clipboard = { type: 'object', data: clonedChild };
                                const cmdChild = new PasteObjectCommand(this, targetPos);
                                cmdChild.setEventBus(this.eventBus);
                                this.history.executeCommand(cmdChild);
                            }
                        }
                        if (pastedCount === totalToPaste) {
                            this.eventBus.off(Events.Object.Pasted, onPasted);
                            requestAnimationFrame(() => {
                                if (this.selectTool && newIds.length > 0) {
                                    this.selectTool.setSelection(newIds);
                                    this.selectTool.updateResizeHandles();
                                }
                            });
                        }
                    };
                    this.eventBus.on(Events.Object.Pasted, onPasted);

                    // Вставляем фрейм первым
                    const frameClone = JSON.parse(JSON.stringify(frameOriginal));
                    this.clipboard = { type: 'object', data: frameClone };
                    const targetPosFrame = {
                        x: x + (frameClone.position.x - baseX),
                        y: y + (frameClone.position.y - baseY)
                    };
                    const cmdFrame = new PasteObjectCommand(this, targetPosFrame);
                    cmdFrame.setEventBus(this.eventBus);
                    this.history.executeCommand(cmdFrame);

                    // Возвращаем clipboard к группе для повторных вставок
                    this.clipboard = group;
                    return;
                }

                // Обычная вставка группы (не фрейм-бандл)
                const newIds = [];
                let pending = data.length;
                const onPasted = (payload) => {
                    if (!payload || !payload.newId) return;
                    newIds.push(payload.newId);
                    pending -= 1;
                    if (pending === 0) {
                        this.eventBus.off(Events.Object.Pasted, onPasted);
                        requestAnimationFrame(() => {
                            if (this.selectTool && newIds.length > 0) {
                                this.selectTool.setSelection(newIds);
                                this.selectTool.updateResizeHandles();
                            }
                        });
                    }
                };
                this.eventBus.on(Events.Object.Pasted, onPasted);
                data.forEach(orig => {
                    const cloned = JSON.parse(JSON.stringify(orig));
                    const targetPos = {
                        x: x + (cloned.position.x - minX),
                        y: y + (cloned.position.y - minY)
                    };
                    this.clipboard = { type: 'object', data: cloned };
                    const cmd = new PasteObjectCommand(this, targetPos);
                    cmd.setEventBus(this.eventBus);
                    this.history.executeCommand(cmd);
                });
                this.clipboard = group;
            }
        });

        // Текущее положение курсора в координатах экрана (CSS-пиксели контейнера)
        this._cursor = { x: null, y: null };
        this.eventBus.on(Events.UI.CursorMove, ({ x, y }) => {
            this._cursor.x = x;
            this._cursor.y = y;
        });

		// Вставка изображения из буфера обмена — по курсору, если он над холстом; иначе по центру видимой области
		this.eventBus.on(Events.UI.PasteImage, ({ src, name, imageId }) => {
			if (!src) return;
			const view = this.pixi.app.view;
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const s = world?.scale?.x || 1;
			const hasCursor = Number.isFinite(this._cursor.x) && Number.isFinite(this._cursor.y);
			
			let screenX, screenY;
			if (hasCursor) {
				// Используем позицию курсора
				screenX = this._cursor.x;
				screenY = this._cursor.y;
			} else {
				// Центр экрана
				screenX = view.clientWidth / 2;
				screenY = view.clientHeight / 2;
			}
			
			// Преобразуем экранные координаты в мировые (с учетом zoom и pan)
			const worldX = (screenX - (world?.x || 0)) / s;
			const worldY = (screenY - (world?.y || 0)) / s;

			const placeWithAspect = (natW, natH) => {
				let w = 300, h = 200;
				if (natW > 0 && natH > 0) {
					const ar = natW / natH;
					w = 300;
					h = Math.max(1, Math.round(w / ar));
				}
				const properties = { src, name, width: w, height: h };
				const extraData = imageId ? { imageId } : {};
				this.createObject('image', { x: Math.round(worldX - Math.round(w / 2)), y: Math.round(worldY - Math.round(h / 2)) }, properties, extraData);
			};

			try {
				const img = new Image();
				img.decoding = 'async';
				img.onload = () => placeWithAspect(img.naturalWidth || 0, img.naturalHeight || 0);
				img.onerror = () => placeWithAspect(0, 0);
				img.src = src;
			} catch (_) {
				placeWithAspect(0, 0);
			}
		});

		// Вставка изображения из буфера обмена по контекстному клику (координаты на экране)
		this.eventBus.on(Events.UI.PasteImageAt, ({ x, y, src, name, imageId }) => {
			if (!src) return;
			const world = this.pixi.worldLayer || this.pixi.app.stage;
			const s = world?.scale?.x || 1;
			const worldX = (x - (world?.x || 0)) / s;
			const worldY = (y - (world?.y || 0)) / s;

			const placeWithAspect = (natW, natH) => {
				let w = 300, h = 200;
				if (natW > 0 && natH > 0) {
					const ar = natW / natH;
					w = 300;
					h = Math.max(1, Math.round(w / ar));
				}
				const properties = { src, name, width: w, height: h };
				const extraData = imageId ? { imageId } : {};
				this.createObject('image', { x: Math.round(worldX - Math.round(w / 2)), y: Math.round(worldY - Math.round(h / 2)) }, properties, extraData);
			};

			try {
				const img = new Image();
				img.decoding = 'async';
				img.onload = () => placeWithAspect(img.naturalWidth || 0, img.naturalHeight || 0);
				img.onerror = () => placeWithAspect(0, 0);
				img.src = src;
			} catch (_) {
				placeWithAspect(0, 0);
			}
		});

        // Слойность: изменение порядка отрисовки (локальные операции)
        const applyZOrderFromState = () => {
            const arr = this.state.state.objects || [];
            this.pixi.app.stage.sortableChildren = true;
            for (let i = 0; i < arr.length; i++) {
                const id = arr[i]?.id;
                const pixi = id ? this.pixi.objects.get(id) : null;
                if (pixi) pixi.zIndex = i;
            }
        };

        const reorderInState = (id, mode) => {
            const arr = this.state.state.objects || [];
            const index = arr.findIndex(o => o.id === id);
            if (index === -1) return;
            const [item] = arr.splice(index, 1);
            switch (mode) {
                case 'front':
                    arr.push(item);
                    break;
                case 'back':
                    arr.unshift(item);
                    break;
                case 'forward':
                    arr.splice(Math.min(index + 1, arr.length), 0, item);
                    break;
                case 'backward':
                    arr.splice(Math.max(index - 1, 0), 0, item);
                    break;
            }
            applyZOrderFromState();
            this.state.markDirty();
        };

        const bringToFront = (id) => reorderInState(id, 'front');
        const sendToBack = (id) => reorderInState(id, 'back');
        const bringForward = (id) => reorderInState(id, 'forward');
        const sendBackward = (id) => reorderInState(id, 'backward');

        this.eventBus.on(Events.UI.LayerBringToFront, ({ objectId }) => {
            const arr = this.state.state.objects || [];
            const from = arr.findIndex(o => o.id === objectId);
            if (from === -1) return;
            const to = arr.length - 1;
            if (from === to) return;
            const cmd = new ReorderZCommand(this, objectId, from, to);
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on(Events.UI.LayerBringForward, ({ objectId }) => {
            const arr = this.state.state.objects || [];
            const from = arr.findIndex(o => o.id === objectId);
            if (from === -1) return;
            const to = Math.min(from + 1, arr.length - 1);
            if (from === to) return;
            const cmd = new ReorderZCommand(this, objectId, from, to);
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on(Events.UI.LayerSendBackward, ({ objectId }) => {
            const arr = this.state.state.objects || [];
            const from = arr.findIndex(o => o.id === objectId);
            if (from === -1) return;
            const to = Math.max(from - 1, 0);
            if (from === to) return;
            const cmd = new ReorderZCommand(this, objectId, from, to);
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on(Events.UI.LayerSendToBack, ({ objectId }) => {
            const arr = this.state.state.objects || [];
            const from = arr.findIndex(o => o.id === objectId);
            if (from === -1) return;
            const to = 0;
            if (from === to) return;
            const cmd = new ReorderZCommand(this, objectId, from, to);
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });

        // Групповые операции слоя: перемещаем группу как единый блок, сохраняя внутренний порядок
        const getSelection = () => {
            const ids = this.toolManager.getActiveTool()?.name === 'select'
                ? Array.from(this.toolManager.getActiveTool().selectedObjects || [])
                : [];
            return ids;
        };
        const reorderGroupInState = (ids, mode) => {
            const arr = this.state.state.objects || [];
            if (ids.length === 0 || arr.length === 0) return;
            const selectedSet = new Set(ids);
            // Сохраняем относительный порядок выбранных и остальных
            const selectedItems = arr.filter(o => selectedSet.has(o.id));
            const others = arr.filter(o => !selectedSet.has(o.id));
            // Позиция блока среди "others" равна числу остальных до минимального индекса выбранных
            const indices = arr.map((o, i) => ({ id: o.id, i })).filter(p => selectedSet.has(p.id)).map(p => p.i).sort((a,b)=>a-b);
            const minIdx = indices[0];
            const othersBefore = arr.slice(0, minIdx).filter(o => !selectedSet.has(o.id)).length;
            let insertPos = othersBefore;
            switch (mode) {
                case 'front':
                    insertPos = others.length; // в конец
                    break;
                case 'back':
                    insertPos = 0; // в начало
                    break;
                case 'forward':
                    insertPos = Math.min(othersBefore + 1, others.length);
                    break;
                case 'backward':
                    insertPos = Math.max(othersBefore - 1, 0);
                    break;
            }
            const newArr = [...others.slice(0, insertPos), ...selectedItems, ...others.slice(insertPos)];
            this.state.state.objects = newArr;
            applyZOrderFromState();
            this.state.markDirty();
        };
        this.eventBus.on(Events.UI.LayerGroupBringToFront, () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'front');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on(Events.UI.LayerGroupBringForward, () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'forward');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on(Events.UI.LayerGroupSendBackward, () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'backward');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on(Events.UI.LayerGroupSendToBack, () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'back');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });

        // События перетаскивания
        this.eventBus.on(Events.Tool.DragStart, (data) => {
            // Сохраняем начальную позицию как левый-верх 
            // Все объекты используют pivot по центру, поэтому логика одинакова
            const pixiObject = this.pixi.objects.get(data.object);
            if (pixiObject) {
                const halfW = (pixiObject.width || 0) / 2;
                const halfH = (pixiObject.height || 0) / 2;
                this.dragStartPosition = { x: pixiObject.x - halfW, y: pixiObject.y - halfH };
            }

            // Фрейм-специфичная логика вынесена в FrameService
        });

        // Панорамирование холста
        this.eventBus.on(Events.Tool.PanUpdate, ({ delta }) => {
            // Смещаем только worldLayer, сетка остается закрепленной к экрану
            if (this.pixi.worldLayer) {
                this.pixi.worldLayer.x += delta.x;
                this.pixi.worldLayer.y += delta.y;
            } else {
                const stage = this.pixi.app.stage;
                stage.x += delta.x;
                stage.y += delta.y;
            }
            // Сообщаем системе об обновлении позиции мира для автосохранения
            try {
                const world = this.pixi.worldLayer || this.pixi.app.stage;
                this.eventBus.emit(Events.Grid.BoardDataChanged, {
                    settings: { pan: { x: world.x || 0, y: world.y || 0 } }
                });
            } catch (_) {}
        });

        // Миникарта перенесена в BoardService

        // Зум перенесен в ZoomPanController

        // Инвариант слоёв перенесён в ZOrderManager

        // Кнопки зума перенесены в ZoomPanController
        this.eventBus.on(Events.UI.ZoomSelection, () => {
            // Zoom to selection: берем bbox выделенных
            const selected = this.selectTool ? Array.from(this.selectTool.selectedObjects || []) : [];
            if (!selected || selected.length === 0) return;
            const objs = this.state.state.objects || [];
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const o of objs) {
                if (!selected.includes(o.id)) continue;
                minX = Math.min(minX, o.position.x);
                minY = Math.min(minY, o.position.y);
                maxX = Math.max(maxX, o.position.x + (o.width || 0));
                maxY = Math.max(maxY, o.position.y + (o.height || 0));
            }
            if (!isFinite(minX)) return;
            const bboxW = Math.max(1, maxX - minX);
            const bboxH = Math.max(1, maxY - minY);
            const viewW = this.pixi.app.view.clientWidth;
            const viewH = this.pixi.app.view.clientHeight;
            const padding = 40;
            const scaleX = (viewW - padding) / bboxW;
            const scaleY = (viewH - padding) / bboxH;
            const newScale = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)));
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            const worldCenterX = minX + bboxW / 2;
            const worldCenterY = minY + bboxH / 2;
            world.scale.set(newScale);
            world.x = viewW / 2 - worldCenterX * newScale;
            world.y = viewH / 2 - worldCenterY * newScale;
            this.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
        });

        // Данные для миникарты (bbox объектов, трансформации мира, размеры вьюпорта)
        this.eventBus.on(Events.UI.MinimapGetData, (data) => {
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            const view = this.pixi.app.view;
            const scale = world?.scale?.x || 1;

            // Объекты берём из состояния (левый-верх + ширина/высота) и угол, если есть
            const objects = (this.state.state.objects || []).map((o) => ({
                id: o.id,
                x: o.position?.x ?? 0,
                y: o.position?.y ?? 0,
                width: o.width ?? 0,
                height: o.height ?? 0,
                rotation: o.rotation ?? (o.transform?.rotation ?? 0)
            }));

            data.world = { x: world.x || 0, y: world.y || 0, scale };
            data.view = { width: view.clientWidth, height: view.clientHeight };
            data.objects = objects;
        });

        // Центрирование основного вида на точке из миникарты (world coords)
        this.eventBus.on(Events.UI.MinimapCenterOn, ({ worldX, worldY }) => {
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            const view = this.pixi.app.view;
            const s = world?.scale?.x || 1;
            world.x = view.clientWidth / 2 - worldX * s;
            world.y = view.clientHeight / 2 - worldY * s;
        });

        // === ГРУППОВОЕ ПЕРЕТАСКИВАНИЕ ===
        this.eventBus.on(Events.Tool.GroupDragStart, (data) => {
            // Сохраняем стартовые позиции для текущей группы
            this._groupDragStart = new Map();
            for (const id of data.objects) {
                const pixiObject = this.pixi.objects.get(id);
                if (pixiObject) this._groupDragStart.set(id, { x: pixiObject.x, y: pixiObject.y });
            }
        });

        this.eventBus.on(Events.Tool.GroupDragUpdate, (data) => {
            const { dx, dy } = data.delta;
            for (const id of data.objects) {
                const pixiObject = this.pixi.objects.get(id);
                if (!pixiObject) continue;
                // Смещаем центр (PIXI хранит x/y по центру при pivot/anchor)
                const startCenter = this._groupDragStart.get(id) || { x: pixiObject.x, y: pixiObject.y };
                const newCenter = { x: startCenter.x + dx, y: startCenter.y + dy };
                pixiObject.x = newCenter.x;
                pixiObject.y = newCenter.y;
                // Обновляем state как левый-верхний угол
                const obj = this.state.state.objects.find(o => o.id === id);
                if (obj) {
                    const halfW = (pixiObject.width || 0) / 2;
                    const halfH = (pixiObject.height || 0) / 2;
                    obj.position.x = newCenter.x - halfW;
                    obj.position.y = newCenter.y - halfH;
                }
            }
            this.state.markDirty();
        });

        this.eventBus.on(Events.Tool.GroupDragEnd, (data) => {
            // Собираем один батч для истории
            const moves = [];
            for (const id of data.objects) {
                const start = this._groupDragStart?.get(id);
                const pixiObject = this.pixi.objects.get(id);
                if (!start || !pixiObject) continue;
                const finalPosition = { x: pixiObject.x, y: pixiObject.y };
                if (start.x !== finalPosition.x || start.y !== finalPosition.y) {
                    moves.push({ id, from: start, to: finalPosition });
                }
            }
            if (moves.length > 0) {
                // Обычное групповое перемещение - координаты центров PIXI
                const cmd = new GroupMoveCommand(this, moves, false);
                cmd.setEventBus(this.eventBus);
                this.history.executeCommand(cmd);
            }
            this._groupDragStart = null;
        });

        // Удаление списка объектов (используется при перезаписи текста через редактирование)
        this.eventBus.on(Events.Tool.ObjectsDelete, ({ objects }) => {
            const ids = Array.isArray(objects) ? objects : [];
            ids.forEach((id) => this.deleteObject(id));
        });

        this.eventBus.on(Events.Tool.DragUpdate, (data) => {
            // Во время перетаскивания обновляем позицию напрямую (без команды)
            this.updateObjectPositionDirect(data.object, data.position);
            // Hover-подсветка фреймов вынесена в FrameService
        });

        this.eventBus.on(Events.Tool.DragEnd, (data) => {

            // В конце создаем одну команду перемещения
            if (this.dragStartPosition) {
                const pixiObject = this.pixi.objects.get(data.object);
                if (pixiObject) {
                    // Берем финальную позицию из state, который обновлялся во время drag:update
                    const objState = this.state.state.objects.find(o => o.id === data.object);
                    const finalPosition = objState && objState.position ? { x: objState.position.x, y: objState.position.y } : { x: 0, y: 0 };
                    
                    // Создаем команду только если позиция действительно изменилась
                    if (this.dragStartPosition.x !== finalPosition.x || 
                        this.dragStartPosition.y !== finalPosition.y) {
                        
                        const moved = this.state.state.objects.find(o => o.id === data.object);
                        if (moved && moved.type === 'frame') {
                            // Групповая фиксация перемещения для фрейма и его детей
                            const attachments = this._getFrameChildren(moved.id);
                            const moves = [];
                            // сам фрейм
                            moves.push({ id: moved.id, from: this.dragStartPosition, to: finalPosition });
                            // дети
                            const dx = finalPosition.x - this.dragStartPosition.x;
                            const dy = finalPosition.y - this.dragStartPosition.y;
                            for (const childId of attachments) {
                                const child = this.state.state.objects.find(o => o.id === childId);
                                if (!child) continue;
                                const start = this._frameDragChildStart?.get(childId);
                                const from = start ? { x: start.x, y: start.y } : { x: (child.position.x - dx), y: (child.position.y - dy) };
                                const to = { x: child.position.x, y: child.position.y };
                                moves.push({ id: childId, from, to });
                            }
                            // Frame перемещение - координаты уже левый-верх
                            const cmd = new GroupMoveCommand(this, moves, true);
                            cmd.setEventBus(this.eventBus);
                            this.history.executeCommand(cmd);
                        } else {
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
                }
                this.dragStartPosition = null;
            }

            // После любого перетаскивания: логика фреймов перенесена в FrameService
        });

        // === ДУБЛИРОВАНИЕ ЧЕРЕЗ ALT-ПЕРЕТАСКИВАНИЕ ===
        // Запрос на создание дубликата от SelectTool
        this.eventBus.on(Events.Tool.DuplicateRequest, (data) => {
            const { originalId, position } = data || {};
            if (!originalId) return;
            // Находим исходный объект в состоянии
            const objects = this.state.state.objects;
            const original = objects.find(obj => obj.id === originalId);
            if (!original) return;

            // Если дублируем фрейм — копируем вместе с его содержимым
            if (original.type === 'frame') {
                const frame = JSON.parse(JSON.stringify(original));
                const dx = (position?.x ?? frame.position.x) - frame.position.x;
                const dy = (position?.y ?? frame.position.y) - frame.position.y;

                // Дети фрейма
                const children = (this.state.state.objects || []).filter(o => o && o.properties && o.properties.frameId === originalId);

                // После вставки фрейма вставим детей, перепривязав к новому frameId
                const onFramePasted = (payload) => {
                    if (!payload || payload.originalId !== originalId) return;
                    const newFrameId = payload.newId;
                    this.eventBus.off(Events.Object.Pasted, onFramePasted);
                    for (const child of children) {
                        const clonedChild = JSON.parse(JSON.stringify(child));
                        clonedChild.properties = clonedChild.properties || {};
                        clonedChild.properties.frameId = newFrameId;
                        const targetPos = {
                            x: (child.position?.x || 0) + dx,
                            y: (child.position?.y || 0) + dy
                        };
                        this.clipboard = { type: 'object', data: clonedChild };
                        const cmdChild = new PasteObjectCommand(this, targetPos);
                        cmdChild.setEventBus(this.eventBus);
                        this.history.executeCommand(cmdChild);
                    }
                };
                this.eventBus.on(Events.Object.Pasted, onFramePasted);

                // Подготовим буфер для фрейма (с новым названием)
                const frameClone = JSON.parse(JSON.stringify(frame));
                try {
                    const arr = this.state.state.objects || [];
                    let maxNum = 0;
                    for (const o of arr) {
                        if (!o || o.type !== 'frame') continue;
                        const t = o?.properties?.title || '';
                        const m = t.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                        if (m) {
                            const n = parseInt(m[1], 10);
                            if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
                        }
                    }
                    const next = maxNum + 1;
                    frameClone.properties = frameClone.properties || {};
                    frameClone.properties.title = `Фрейм ${next}`;
                } catch (_) {}
                this.clipboard = { type: 'object', data: frameClone };
                const cmdFrame = new PasteObjectCommand(this, { x: frame.position.x + dx, y: frame.position.y + dy });
                cmdFrame.setEventBus(this.eventBus);
                this.history.executeCommand(cmdFrame);
                return;
            }

            // Обычная логика для остальных типов
            this.clipboard = {
                type: 'object',
                data: JSON.parse(JSON.stringify(original))
            };
            // Запоминаем исходное название фрейма, чтобы не менять его
            try {
                if (original.type === 'frame') {
                    this._dupTitleMap = this._dupTitleMap || new Map();
                    const prevTitle = (original.properties && typeof original.properties.title !== 'undefined') ? original.properties.title : undefined;
                    this._dupTitleMap.set(originalId, prevTitle);
                }
            } catch (_) {}
            // Если фрейм — проставим будущий заголовок в буфер
            try {
                if (this.clipboard.data && this.clipboard.data.type === 'frame') {
                    const arr = this.state.state.objects || [];
                    let maxNum = 0;
                    for (const o of arr) {
                        if (!o || o.type !== 'frame') continue;
                        const t = o?.properties?.title || '';
                        const m = t.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                        if (m) {
                            const n = parseInt(m[1], 10);
                            if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
                        }
                    }
                    const next = maxNum + 1;
                    this.clipboard.data.properties = this.clipboard.data.properties || {};
                    this.clipboard.data.properties.title = `Фрейм ${next}`;
                }
            } catch (_) {}

            // Вызываем вставку по указанной позиции (под курсором)
            this.pasteObject(position);
        });

        // Запрос на групповое дублирование
        this.eventBus.on(Events.Tool.GroupDuplicateRequest, (data) => {
            const originals = (data.objects || []).filter((id) => this.state.state.objects.some(o => o.id === id));
            const total = originals.length;
            if (total === 0) {
                this.eventBus.emit(Events.Tool.GroupDuplicateReady, { map: {} });
                return;
            }
            const idMap = {};
            let remaining = total;
            const tempHandlers = new Map();
            const onPasted = (originalId) => (payload) => {
                if (payload.originalId !== originalId) return;
                idMap[originalId] = payload.newId;
                // Снять локального слушателя
                const h = tempHandlers.get(originalId);
                if (h) this.eventBus.off(Events.Object.Pasted, h);
                remaining -= 1;
                if (remaining === 0) {
                    this.eventBus.emit(Events.Tool.GroupDuplicateReady, { map: idMap });
                }
            };
            // Дублируем по одному, используя текущие позиции как стартовые
            for (const originalId of originals) {
                const obj = this.state.state.objects.find(o => o.id === originalId);
                if (!obj) continue;
                // Подписываемся на ответ именно для этого оригинала
                const handler = onPasted(originalId);
                tempHandlers.set(originalId, handler);
                this.eventBus.on(Events.Object.Pasted, handler);
                // Кладем в clipboard объект, затем вызываем PasteObjectCommand с текущей позицией
                this.clipboard = { type: 'object', data: JSON.parse(JSON.stringify(obj)) };
                // Запомним оригинальные названия фреймов
                try {
                    if (obj.type === 'frame') {
                        this._dupTitleMap = this._dupTitleMap || new Map();
                        const prevTitle = (obj.properties && typeof obj.properties.title !== 'undefined') ? obj.properties.title : undefined;
                        this._dupTitleMap.set(obj.id, prevTitle);
                    }
                } catch (_) { /* no-op */ }
                // Если фрейм — сразу проставим новый заголовок в буфер
                try {
                    if (this.clipboard.data && this.clipboard.data.type === 'frame') {
                        const arr = this.state.state.objects || [];
                        let maxNum = 0;
                        for (const o2 of arr) {
                            if (!o2 || o2.type !== 'frame') continue;
                            const t2 = o2?.properties?.title || '';
                            const m2 = t2.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                            if (m2) {
                                const n2 = parseInt(m2[1], 10);
                                if (Number.isFinite(n2)) maxNum = Math.max(maxNum, n2);
                            }
                        }
                        const next2 = maxNum + 1;
                        this.clipboard.data.properties = this.clipboard.data.properties || {};
                        this.clipboard.data.properties.title = `Фрейм ${next2}`;
                    }
                } catch (_) { /* no-op */ }
                const cmd = new PasteObjectCommand(this, { x: obj.position.x, y: obj.position.y });
                cmd.setEventBus(this.eventBus);
                this.history.executeCommand(cmd);
            }
        });

        // Когда объект вставлен (из PasteObjectCommand)
        this.eventBus.on(Events.Object.Pasted, ({ originalId, newId }) => {
            try {
                const arr = this.state.state.objects || [];
                const newObj = arr.find(o => o.id === newId);
                const origObj = arr.find(o => o.id === originalId);
                if (newObj && newObj.type === 'frame') {
                    // Рассчитываем следующий номер среди уже существующих (кроме только что вставленного)
                    let maxNum = 0;
                    for (const o of arr) {
                        if (!o || o.id === newId || o.type !== 'frame') continue;
                        const t = o?.properties?.title || '';
                        const m = t.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                        if (m) {
                            const n = parseInt(m[1], 10);
                            if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
                        }
                    }
                    const next = maxNum + 1;
                    // Присваиваем новое имя только НОВОМУ
                    newObj.properties = newObj.properties || {};
                    newObj.properties.title = `Фрейм ${next}`;
                    const pixNew = this.pixi.objects.get(newId);
                    if (pixNew && pixNew._mb?.instance?.setTitle) pixNew._mb.instance.setTitle(newObj.properties.title);
                    // Восстанавливаем исходное имя оригинала, если оно было записано
                    if (this._dupTitleMap && this._dupTitleMap.has(originalId) && origObj && origObj.type === 'frame') {
                        const prev = this._dupTitleMap.get(originalId);
                        origObj.properties = origObj.properties || {};
                        // Если prev undefined, очистим title
                        origObj.properties.title = prev;
                        const pixOrig = this.pixi.objects.get(originalId);
                        if (pixOrig && pixOrig._mb?.instance?.setTitle) pixOrig._mb.instance.setTitle(prev);
                        this._dupTitleMap.delete(originalId);
                    }
                    this.state.markDirty();
                }
            } catch (_) { /* no-op */ }
            // Сообщаем SelectTool id нового объекта для переключения drag
            this.eventBus.emit(Events.Tool.DuplicateReady, { originalId, newId });
        });

        // События изменения размера
        this.eventBus.on(Events.Tool.ResizeStart, (data) => {
            // Сохраняем начальный размер для команды
            const objects = this.state.getObjects();
            const object = objects.find(obj => obj.id === data.object);
            if (object) {
                this.resizeStartSize = { width: object.width, height: object.height };
                // Сохраняем контекст активного ресайза для расчёта позиции, если она не будет передана
                this._activeResize = {
                    objectId: data.object,
                    handle: data.handle,
                    startSize: { width: object.width, height: object.height },
                    startPosition: { x: object.position.x, y: object.position.y }
                };
            }
        });

        // === ГРУППОВОЙ RESIZE ===
        this.eventBus.on(Events.Tool.GroupResizeStart, (data) => {
            this._groupResizeStart = data.startBounds || null;
            // Сохраним начальные размеры и позиции, чтобы сформировать команду на end
            this._groupResizeSnapshot = new Map();
            for (const id of data.objects) {
                const obj = this.state.state.objects.find(o => o.id === id);
                const pixiObj = this.pixi.objects.get(id);
                if (!obj || !pixiObj) continue;
                this._groupResizeSnapshot.set(id, {
                    size: { width: obj.width, height: obj.height },
                    // Позицию берем из PIXI (центр с учетом pivot), чтобы избежать смещения при первом ресайзе
                    position: { x: pixiObj.x, y: pixiObj.y },
                    type: obj.type || null
                });
            }
        });

        this.eventBus.on(Events.Tool.GroupResizeUpdate, (data) => {
            const { startBounds, newBounds, scale } = data;
            const sx = scale?.x ?? (newBounds.width / startBounds.width);
            const sy = scale?.y ?? (newBounds.height / startBounds.height);
            const startLeft = startBounds.x;
            const startTop = startBounds.y;
            for (const id of data.objects) {
                const snap = this._groupResizeSnapshot?.get(id);
                if (!snap) continue;
                // Вычисления только от исходной (snapshot), чтобы избежать накопления ошибок
                const pixiAtStart = snap.position; // центр с учетом pivot
                // Пересчет центра относительно стартовой рамки, а затем новый центр
                const relCenterX = pixiAtStart.x - (startLeft + startBounds.width / 2);
                const relCenterY = pixiAtStart.y - (startTop + startBounds.height / 2);
                const newCenter = {
                    x: newBounds.x + newBounds.width / 2 + relCenterX * sx,
                    y: newBounds.y + newBounds.height / 2 + relCenterY * sy
                };
                const newSize = {
                    width: Math.max(10, snap.size.width * sx),
                    height: Math.max(10, snap.size.height * sy)
                };
                // Преобразуем центр в левый верх для state/PIXI (мы используем x/y как левый верх)
                const newPos = { x: newCenter.x - newSize.width / 2, y: newCenter.y - newSize.height / 2 };
                this.updateObjectSizeAndPositionDirect(id, newSize, newPos, snap.type || null);
            }
        });

        this.eventBus.on(Events.Tool.GroupResizeEnd, (data) => {
            // Сформируем батч-команду GroupResizeCommand
            const changes = [];
            for (const id of data.objects) {
                const before = this._groupResizeSnapshot?.get(id);
                const obj = this.state.state.objects.find(o => o.id === id);
                if (!before || !obj) continue;
                const afterSize = { width: obj.width, height: obj.height };
                const afterPos = { x: obj.position.x, y: obj.position.y };
                if (before.size.width !== afterSize.width || before.size.height !== afterSize.height || before.position.x !== afterPos.x || before.position.y !== afterPos.y) {
                    changes.push({ id, fromSize: before.size, toSize: afterSize, fromPos: before.position, toPos: afterPos, type: before.type });
                }
            }
            if (changes.length > 0) {
                const cmd = new GroupResizeCommand(this, changes);
                cmd.setEventBus(this.eventBus);
                this.history.executeCommand(cmd);
            }
            this._groupResizeStart = null;
            this._groupResizeSnapshot = null;
            // Обновляем UI рамки с ручками
            if (this.selectTool && this.selectTool.selectedObjects.size > 1) {
                this.selectTool.updateResizeHandles();
            }
        });

        this.eventBus.on(Events.Tool.ResizeUpdate, (data) => {
            // Во время resize обновляем размер напрямую (без команды)
            // Получаем тип объекта для правильного пересоздания
            const objects = this.state.getObjects();
            const object = objects.find(obj => obj.id === data.object);
            const objectType = object ? object.type : null;

            // Сохраняем пропорции:
            // - всегда для изображений (включая эмоджи-иконки, которые квадратные)
            // - для фреймов только если lockedAspect=true
            if (data.size && (objectType === 'image' || objectType === 'frame')) {
                const isEmoji = (objectType === 'image' && object?.properties?.isEmojiIcon);
                const isImage = (objectType === 'image');
                const lockedAspect = objectType === 'frame'
                    ? !!(object?.properties && object.properties.lockedAspect === true)
                    : true; // для изображений всегда держим аспект

                if (lockedAspect || isImage || isEmoji) {
                    const start = this._activeResize?.startSize || { width: object.width, height: object.height };
                    const startW = Math.max(1, start.width);
                    const startH = Math.max(1, start.height);
                    const aspect = isEmoji ? 1 : (startW / startH);

                    let w = Math.max(1, data.size.width);
                    let h = Math.max(1, data.size.height);
                    const hndl = (this._activeResize?.handle || '').toLowerCase();

                    if (isEmoji) {
                        // Квадрат
                        const s = Math.max(w, h);
                        if (!data.position && this._activeResize && this._activeResize.objectId === data.object) {
                            const startPos = this._activeResize.startPosition;
                            const sw = this._activeResize.startSize.width;
                            const sh = this._activeResize.startSize.height;
                            let x = startPos.x;
                            let y = startPos.y;
                            if (hndl.includes('w')) { x = startPos.x + (sw - s); }
                            if (hndl.includes('n')) { y = startPos.y + (sh - s); }
                            const isEdge = ['n','s','e','w'].includes(hndl);
                            if (isEdge) {
                                if (hndl === 'n' || hndl === 's') x = startPos.x + Math.round((sw - s) / 2);
                                if (hndl === 'e' || hndl === 'w') y = startPos.y + Math.round((sh - s) / 2);
                            }
                            data.position = { x: Math.round(x), y: Math.round(y) };
                        }
                        w = s; h = s;
                    } else {
                        // Поддержка аспекта (для images всегда; для frames — если lockedAspect)
                        const dw = Math.abs(w - startW);
                        const dh = Math.abs(h - startH);
                        if (dw >= dh) { h = Math.round(w / aspect); } else { w = Math.round(h * aspect); }
                    }

                    // Минимальная площадь — только для фреймов (как раньше)
                    if (objectType === 'frame') {
                        const minArea = 1800;
                        const area = Math.max(1, w * h);
                        if (area < minArea) {
                            const scale = Math.sqrt(minArea / area);
                            w = Math.round(w * scale);
                            h = Math.round(h * scale);
                        }
                    }

                    data.size = { width: w, height: h };

                    // Компенсация позиции по зафиксированной стороне
                    if (!data.position && this._activeResize && this._activeResize.objectId === data.object) {
                        const startPos = this._activeResize.startPosition;
                        const sw = this._activeResize.startSize.width;
                        const sh = this._activeResize.startSize.height;
                        let x = startPos.x;
                        let y = startPos.y;
                        if (hndl.includes('w')) { x = startPos.x + (sw - data.size.width); }
                        if (hndl.includes('n')) { y = startPos.y + (sh - data.size.height); }
                        const isEdge = ['n','s','e','w'].includes(hndl);
                        if (isEdge) {
                            if (hndl === 'n' || hndl === 's') {
                                x = startPos.x + Math.round((sw - data.size.width) / 2);
                            } else if (hndl === 'e' || hndl === 'w') {
                                y = startPos.y + Math.round((sh - data.size.height) / 2);
                            }
                        }
                        data.position = { x: Math.round(x), y: Math.round(y) };
                    }
                }
            }

            // Если позиция не пришла из UI, вычислим её из контекста активной ручки
            let position = data.position;
            if (!position && this._activeResize && this._activeResize.objectId === data.object) {
                const h = (this._activeResize.handle || '').toLowerCase();
                const start = this._activeResize.startPosition;
                const startSize = this._activeResize.startSize;
                const dw = (data.size?.width || startSize.width) - startSize.width;
                const dh = (data.size?.height || startSize.height) - startSize.height;
                let nx = start.x;
                let ny = start.y;
                // Для левых/верхних ручек смещаем топ-лев на полную величину изменения
                if (h.includes('w')) nx = start.x + dw;
                if (h.includes('n')) ny = start.y + dh;
                // Для правых/нижних ручек топ-лев остаётся стартовым (nx, ny уже равны start)
                position = { x: nx, y: ny };
            }

            // Для фреймов с произвольным аспектом также обеспечим минимальную площадь
            if (objectType === 'frame' && data.size) {
                const minArea = 1800;
                const w0 = Math.max(1, data.size.width);
                const h0 = Math.max(1, data.size.height);
                const area0 = w0 * h0;
                if (area0 < minArea) {
                    const scale = Math.sqrt(minArea / Math.max(1, area0));
                    const w = Math.round(w0 * scale);
                    const h = Math.round(h0 * scale);
                    data.size = { width: w, height: h };
                    // позиция будет скорректирована ниже общей логикой (уже рассчитана выше при необходимости)
                }
            }

            this.updateObjectSizeAndPositionDirect(data.object, data.size, position, objectType);
        });

        this.eventBus.on(Events.Tool.ResizeEnd, (data) => {
            // В конце создаем одну команду изменения размера
            if (this.resizeStartSize && data.oldSize && data.newSize) {
                // Принудительно сохраняем пропорции для фреймов (если lockedAspect=true)
                const objects = this.state.getObjects();
                const object = objects.find(obj => obj.id === data.object);
                const objectType = object ? object : null;
                if (object && object.type === 'frame' && object.properties && object.properties.lockedAspect === true) {
                    const start = this._activeResize?.startSize || { width: object.width, height: object.height };
                    const aspect = (start.width > 0 && start.height > 0) ? (start.width / start.height) : (object.width / Math.max(1, object.height));
                    let w = Math.max(1, data.newSize.width);
                    let h = Math.max(1, data.newSize.height);
                    const dw = Math.abs(w - start.width);
                    const dh = Math.abs(h - start.height);
                    if (dw >= dh) { h = Math.round(w / aspect); } else { w = Math.round(h * aspect); }
                    // Минимальная площадь фрейма ~х2 по сторонам
                    const minArea = 1800;
                    const area = Math.max(1, w * h);
                    if (area < minArea) {
                        const scale = Math.sqrt(minArea / area);
                        w = Math.round(w * scale);
                        h = Math.round(h * scale);
                    }
                    data.newSize = { width: w, height: h };
                    if (!data.newPosition && this._activeResize && this._activeResize.objectId === data.object) {
                        const hndl = (this._activeResize?.full || this._activeResize?.handle || '').toLowerCase();
                        const startPos = this._activeResize.startPosition;
                        const sw = this._activeResize.startSize.width;
                        const sh = this._activeResize.startSize.height;
                        let x = startPos.x;
                        let y = startPos.y;
                        if (hndl.includes('w')) { x = startPos.x + (sw - w); }
                        if (hndl.includes('n')) { y = startPos.y + (sh - h); }
                        const isEdge = ['n','s','e','w'].includes(hndl);
                        if (isEdge) {
                            if (hndl === 'n' || hndl === 's') x = Math.round(startPos.x + (sw - w) / 2);
                            if (hndl === 'e' || hndl === 'w') y = Math.round(startPos.y + (sh - h) / 2);
                        }
                        data.newPosition = { x: Math.round(x), y: Math.round(y) };
                    }
                } else if (object && object.type === 'image') {
                    // Для изображений всегда фиксируем исходное соотношение сторон
                    const start = this._activeResize?.startSize || { width: object.width, height: object.height };
                    const startW = Math.max(1, start.width);
                    const startH = Math.max(1, start.height);
                    const aspect = startW / startH;
                    let w = Math.max(1, data.newSize.width);
                    let h = Math.max(1, data.newSize.height);
                    const dw = Math.abs(w - startW);
                    const dh = Math.abs(h - startH);
                    if (dw >= dh) { h = Math.round(w / aspect); } else { w = Math.round(h * aspect); }
                    data.newSize = { width: w, height: h };
                    if (!data.newPosition && this._activeResize && this._activeResize.objectId === data.object) {
                        const hndl = (this.extent?.handle || this._activeResize?.handle || '').match ? (this._activeResize?.handle || '') : '';
                        const handle = (this._activeResize?.handle || '').toString().toLowerCase();
                        const startPos = this._activeResize.startPosition || { x: 0, y: 0 };
                        const sw = this._activeResize.startSize?.width || startW;
                        const sh = this._activeResize.startSize?.height || startH;
                        let x = startPos.x;
                        let y = startPos.y;
                        if (handle.includes('w')) { x = startPos.x + (sw - w); }
                        if (handle.includes('n')) { y = startPos.y + (sh - h); }
                        const edge = ['n','s','e','w'].includes(handle);
                        if (edge) {
                            if (handle === 'n' || handle === 's') x = Math.round(startPos.x + (sw - w) / 2);
                            if (handle === 'e' || handle === 'w') y = Math.round(startPos.y + (sh - h) / 2);
                        }
                        data.newPosition = { x: Math.floor(x), y: Math.floor(y) };
                    }
                }
                // Для произвольных фреймов также обеспечим минимальную площадь
                if (object && object.type === 'frame' && data.newSize && !(object.properties && object.properties === true)) {
                    const minArea = 1800;
                    const w0 = Math.max(1, data.newSize.width);
                    const h0 = Math.max(1, data.newSize.height);
                    const area0 = w0 * h0;
                    if (area0 < minArea) {
                        const scale = Math.sqrt(minArea / Math.max(1, area0));
                        const w = Math.round(w0 * scale);
                        const h = Math.round(h0 * scale);
                        data.newSize = { width: w, height: h };
                        if (!data.newPosition && this._activeResize && this._activeResize.objectId === data.object) {
                            const h2 = (this._activeResize?.handle || '').toLowerCase();
                            const sPos2 = this._activeResize.startPosition;
                            const sw2 = this._activeResize.startSize.width;
                            const sh2 = this._activeResize.startSize.height;
                            let x2 = sPos2.x;
                            let y2 = sPos2.y;
                            if (h2.includes('w')) { x2 = sPos2.x + (sw2 - w); }
                            if (h2.includes('n')) { y2 = sPos2.y + (sh2 - h); }
                            data.newPosition = { x: Math.round(x2), y: Math.round(y2) };
                        }
                    }
                }
                // Создаем команду только если размер действительно изменился
                if (data.oldSize.width !== data.newSize.width || data.oldSize.height !== data.newSize.height) {
                    console.log(`📝 Создаем ResizeObjectCommand:`, {
                        object: data.object,
                        oldSize: data.oldSize,
                        newSize: data.newSize,
                        oldPosition: data.oldPosition,
                        newPosition: data.newPosition
                    });
                    // Гарантируем согласованность позиции: если UI не передал, вычислим
                    let oldPos = data.oldPosition;
                    let newPos = data.newPosition;
                    if ((!oldPos || !newPos) && this._activeResize && this._activeResize.objectId === data.object) {
                        const h = (this._activeResize?.handle || '').toLowerCase();
                        const start = this._activeResize.startPosition;
                        const startSize = this.optimization?.startSize || this._activeResize.startSize;
                        const dw = (data.newSize?.width || startSize.width) - startSize.width;
                        const dh = (data.newSize?.height || startSize.height) - startSize.height;
                        const calcNew = { x: start.x + (h.includes('w') ? dw : 0), y: start.y + (h.includes('n') ? dh : 0) };
                        if (!oldPos) oldPos = { x: start.x, y: start.y };
                        if (!newPos) newPos = calcNew;
                    }
                    const command = new ResizeObjectCommand(
                        this, 
                        this, 
                        data.object, 
                        data.oldSize, 
                        data.newSize,
                        oldPos,
                        newPos
                    );
                    command.setEventBus(this.eventBus);
                    this.history.executeCommand(command);
                }
            }
            this.resizeStartSize = null;
            this._activeResize = null;
        });

        // === ОБРАБОТЧИКИ СОБЫТИЙ ВРАЩЕНИЯ ===
        
        this.eventBus.on(Events.Tool.RotateUpdate, (data) => {
            // Во время вращения обновляем угол напрямую
            this.pixi.updateObjectRotation(data.object, data.angle);
        });

        this.eventBus.on(Events.Tool.RotateEnd, (data) => {
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

        // === ГРУППОВОЙ ПОВОРОТ ===
        this.eventBus.on(Events.Tool.GroupRotateStart, (data) => {
            // Сохраняем начальные углы и позиции
            this._groupRotateStart = new Map();
            for (const id of data.objects) {
                const pixiObject = this.pixi.objects.get(id);
                const deg = pixiObject ? (pixiObject.rotation * 180 / Math.PI) : 0;
                const pos = pixiObject ? { x: pixiObject.x, y: pixiObject.y } : { x: 0, y: 0 };
                this._groupRotateStart.set(id, { angle: deg, position: pos });
            }
            // Центр вращения группы
            this._groupRotateCenter = data.center;
        });

        this.eventBus.on(Events.Tool.GroupRotateUpdate, (data) => {
            // Поворачиваем каждый объект вокруг общего центра с сохранением относительного смещения
            const center = this._groupRotateCenter || { x: 0, y: 0 };
            const rad = (data.angle || 0) * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            for (const id of data.objects) {
                const start = this._groupRotateStart?.get(id);
                if (!start) continue;
                const startAngle = start.angle;
                const newAngle = startAngle + data.angle;
                // Пересчет позиции относительно центра
                const relX = start.position.x - center.x;
                const relY = start.position.y - center.y;
                const newX = center.x + relX * cos - relY * sin;
                const newY = center.y + relX * sin + relY * cos;
                // Применяем
                // Сначала позиция, затем угол (для корректной визуализации ручек)
                const pObj = this.pixi.objects.get(id);
                const halfW = (pObj?.width || 0) / 2;
                const halfH = (pObj?.height || 0) / 2;
                this.updateObjectPositionDirect(id, { x: newX - halfW, y: newY - halfH });
                this.pixi.updateObjectRotation(id, newAngle);
                this.updateObjectRotationDirect(id, newAngle);
            }
            // Сообщаем UI обновить ручки, если активна рамка группы
            this.eventBus.emit(Events.Object.TransformUpdated, { objectId: '__group__', type: 'rotation' });
        });

        this.eventBus.on(Events.Tool.GroupRotateEnd, (data) => {
            // Оформляем как батч-команду GroupRotateCommand
            const center = this._groupRotateCenter || { x: 0, y: 0 };
            const changes = [];
            for (const id of data.objects) {
                const start = this._groupRotateStart?.get(id);
                const pixiObject = this.pixi.objects.get(id);
                if (!start || !pixiObject) continue;
                const toAngle = pixiObject.rotation * 180 / Math.PI;
                const toPos = { x: pixiObject.x, y: pixiObject.y };
                if (Math.abs(start.angle - toAngle) > 0.1 || Math.abs(start.position.x - toPos.x) > 0.1 || Math.abs(start.position.y - toPos.y) > 0.1) {
                    changes.push({ id, fromAngle: start.angle, toAngle, fromPos: start.position, toPos });
                }
            }
            if (changes.length > 0) {
                const cmd = new GroupRotateCommand(this, changes);
                cmd.setEventBus(this.eventBus);
                this.history.executeCommand(cmd);
            }
            this._groupRotateStart = null;
            this._groupRotateCenter = null;
        });

        // === ОБРАБОТЧИКИ КОМАНД ВРАЩЕНИЯ ===
        
        this.eventBus.on(Events.Object.Rotate, (data) => {
            // Обновляем угол в PIXI
            this.pixi.updateObjectRotation(data.objectId, data.angle);
            
            // Обновляем данные в State
            this.updateObjectRotationDirect(data.objectId, data.angle);
            
            // Уведомляем о том, что объект был изменен (для обновления ручек)
            this.eventBus.emit(Events.Object.TransformUpdated, {
                objectId: data.objectId,
                type: 'rotation',
                angle: data.angle
            });
        });

        // Обновляем ручки когда объект изменяется через команды (Undo/Redo)
        this.eventBus.on(Events.Object.TransformUpdated, (data) => {
            // Обновляем ручки если объект выделен
            if (this.selectTool && this.selectTool.selection && this.selectTool.selection.has(data.objectId)) {
                this.selectTool.updateResizeHandles();
            }
        });

        // Hit testing
        this.eventBus.on(Events.Tool.HitTest, (data) => {
            const result = this.pixi.hitTest(data.x, data.y);
            data.result = result;
        });

        // Получение позиции объекта (левый-верх логических координат)
        // Используем размеры PIXI для согласованности с updateObjectPositionDirect
        this.eventBus.on(Events.Tool.GetObjectPosition, (data) => {
            const pixiObject = this.pixi.objects.get(data.objectId);
            if (!pixiObject) return;
            
            // Всегда используем размеры из PIXI для согласованности
            const halfW = (pixiObject.width || 0) / 2;
            const halfH = (pixiObject.height || 0) / 2;
            data.position = { x: pixiObject.x - halfW, y: pixiObject.y - halfH };
        });

        // Получение PIXI объекта
        this.eventBus.on(Events.Tool.GetObjectPixi, (data) => {
            const pixiObject = this.pixi.objects.get(data.objectId);
            data.pixiObject = pixiObject || null;
        });

        // Получение списка всех объектов (с их PIXI и логическими границами)
        this.eventBus.on(Events.Tool.GetAllObjects, (data) => {
            const result = [];
            for (const [objectId, pixiObject] of this.pixi.objects.entries()) {
                const bounds = pixiObject.getBounds();
                result.push({
                    id: objectId,
                    pixi: pixiObject,
                    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
                });
            }
            data.objects = result;
        });

        // Получение размера объекта
        this.eventBus.on(Events.Tool.GetObjectSize, (data) => {
            const objects = this.state.getObjects();
            const object = objects.find(obj => obj.id === data.objectId);
            if (object) {
                data.size = { width: object.width, height: object.height };
            }
        });

        // Получение угла поворота объекта
        this.eventBus.on(Events.Tool.GetObjectRotation, (data) => {
            const pixiObject = this.pixi.objects.get(data.objectId);
            if (pixiObject) {
                // Конвертируем радианы в градусы
                data.rotation = pixiObject.rotation * 180 / Math.PI;
            } else {
                data.rotation = 0;
            }
        });

        // Обновление содержимого объекта
        this.eventBus.on(Events.Tool.UpdateObjectContent, (data) => {
            const { objectId, content } = data;
            if (objectId && content !== undefined) {
                this.pixi.updateObjectContent(objectId, content);
            }
        });

        // Скрытие текста объекта (во время редактирования)
        this.eventBus.on(Events.Tool.HideObjectText, (data) => {
            const { objectId } = data;
            if (objectId) {
                this.pixi.hideObjectText(objectId);
            }
        });

        // Показ текста объекта (после завершения редактирования)
        this.eventBus.on(Events.Tool.ShowObjectText, (data) => {
            const { objectId } = data;
            if (objectId) {
                this.pixi.showObjectText(objectId);
            }
        });

        // Поиск объекта по позиции
        this.eventBus.on(Events.Tool.FindObjectByPosition, (data) => {
            const { position, type } = data;
            if (position && type) {
                const foundObject = this.pixi.findObjectByPosition(position, type);
                data.foundObject = foundObject;
            }
        });

        // Обновление состояния объекта
        this.eventBus.on(Events.Object.StateChanged, (data) => {
            const { objectId, updates } = data;
            if (objectId && updates && this.state) {
                console.log(`🔧 Обновляем состояние объекта ${objectId}:`, updates);
                const objects = this.state.getObjects();
                const object = objects.find(obj => obj.id === objectId);
                if (object) {
                    // Глубокое слияние для свойств, чтобы не терять остальные
                    if (updates.properties && object.properties) {
                        Object.assign(object.properties, updates.properties);
                    }

                    // Копируем остальные обновления верхнего уровня
                    const topLevelUpdates = { ...updates };
                    delete topLevelUpdates.properties;
                    Object.assign(object, topLevelUpdates);
                    
                    // Обновляем PIXI объект, если есть специфичные обновления
                    const pixiObject = this.pixi.objects.get(objectId);
                    if (pixiObject && pixiObject._mb && pixiObject._mb.instance) {
                        const instance = pixiObject._mb.instance;

                        // Обновляем заголовок фрейма
                        if (object.type === 'frame' && updates.properties && updates.properties.title !== undefined) {
                            if (instance.setTitle) {
                                instance.setTitle(updates.properties.title);
                                console.log(`🖼️ Обновлен заголовок фрейма ${objectId}: "${updates.properties.title}"`);
                            }
                        }

                        // Обновляем цвет фона фрейма
                        if (object.type === 'frame' && updates.backgroundColor !== undefined) {
                            if (instance.setBackgroundColor) {
                                instance.setBackgroundColor(updates.backgroundColor);
                                console.log(`🎨 Обновлен цвет фона фрейма ${objectId}: ${updates.backgroundColor}`);
                            }
                        }

                        // Обновляем свойства записки
                        if (object.type === 'note' && updates.properties) {
                            if (instance.setStyle) {
                                const styleUpdates = {};
                                if (updates.properties.backgroundColor !== undefined) {
                                    styleUpdates.backgroundColor = updates.properties.backgroundColor;
                                }
                                if (updates.properties.borderColor !== undefined) {
                                    styleUpdates.borderColor = updates.properties.borderColor;
                                }
                                if (updates.properties.textColor !== undefined) {
                                    styleUpdates.textColor = updates.properties.textColor;
                                }
                                if (updates.properties.fontSize !== undefined) {
                                    styleUpdates.fontSize = updates.properties.fontSize;
                                }
                                if (updates.properties.fontFamily !== undefined) {
                                    styleUpdates.fontFamily = updates.properties.fontFamily;
                                }
                                
                                if (Object.keys(styleUpdates).length > 0) {
                                    instance.setStyle(styleUpdates);
                                    console.log(`📝 Обновлены свойства записки ${objectId}:`, styleUpdates);
                                }
                            }
                        }
                    }
                    
                    // Сохраняем изменения
                    this.state.markDirty();
                } else {
                    console.warn(`❌ Объект ${objectId} не найден в состоянии`);
                }
            }
        });

        // Обработка изменения названия файла
        this.eventBus.on(Events.Object.FileNameChange, (data) => {
            const { objectId, oldName, newName } = data;
            if (objectId && oldName !== undefined && newName !== undefined) {
                console.log(`🔧 Изменение названия файла ${objectId}: "${oldName}" → "${newName}"`);
                
                // Создаем команду для истории изменений
                const command = new EditFileNameCommand(this, objectId, oldName, newName);
                this.history.executeCommand(command);
            }
        });

        // Обработка обновления метаданных файла с сервера
        this.eventBus.on('file:metadata:updated', (data) => {
            const { objectId, fileId, metadata } = data;
            if (objectId && metadata) {
                
                // Обновляем объект в состоянии
                const objects = this.state.getObjects();
                const objectData = objects.find(obj => obj.id === objectId);
                
                if (objectData && objectData.type === 'file') {
                    // Обновляем только измененные метаданные
                    if (!objectData.properties) {
                        objectData.properties = {};
                    }
                    
                    // Синхронизируем название файла с сервером
                    if (metadata.name && metadata.name !== objectData.properties.fileName) {
                        objectData.properties.fileName = metadata.name;
                        
                        // Обновляем визуальное представление
                        const pixiReq = { objectId, pixiObject: null };
                        this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                        
                        if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
                            const fileInstance = pixiReq.pixiObject._mb.instance;
                            if (typeof fileInstance.setFileName === 'function') {
                                fileInstance.setFileName(metadata.name);
                            }
                        }
                        
                        // Обновляем состояние
                        this.state.markDirty();
                    }
                }
            }
        });
    }

    /**
     * Настройка обработчиков клавиатурных событий
     */
    setupKeyboardEvents() {
        // Выделение всех объектов
        this.eventBus.on(Events.Keyboard.SelectAll, () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                this.toolManager.getActiveTool().selectAll();
            }
        });

        // Удаление выделенных объектов (делаем копию списка, чтобы избежать мутаций во время удаления)
        this.eventBus.on(Events.Keyboard.Delete, () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                const ids = Array.from(this.toolManager.getActiveTool().selectedObjects);
                ids.forEach((objectId) => this.deleteObject(objectId));
                this.toolManager.getActiveTool().clearSelection();
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

        // Копирование выделенных объектов (поддержка группы)
        this.eventBus.on(Events.Keyboard.Copy, () => {
            if (this.toolManager.getActiveTool()?.name !== 'select') return;
            const selected = Array.from(this.toolManager.getActiveTool().selectedObjects || []);
            if (selected.length === 0) return;
            if (selected.length === 1) {
                // Одиночный объект — используем существующую команду
                this.copyObject(selected[0]);
                return;
            }
            // Группа — кладем в буфер набор объектов
            const objects = this.state.state.objects || [];
            const groupData = selected
                .map(id => objects.find(o => o.id === id))
                .filter(Boolean)
                .map(o => JSON.parse(JSON.stringify(o)));
            if (groupData.length === 0) return;
            this.clipboard = {
                type: 'group',
                data: groupData,
                meta: { pasteCount: 0 }
            };
        });

        // Вставка объектов из буфера обмена (поддержка группы)
        this.eventBus.on(Events.Keyboard.Paste, () => {
            if (!this.clipboard) return;
            if (this.clipboard.type === 'object') {
                // Одиночная вставка
                this.pasteObject();
                return;
            }
            if (this.clipboard.type === 'group') {
                const group = this.clipboard;
                const data = Array.isArray(group.data) ? group.data : [];
                if (data.length === 0) return;
                // Инкрементируем смещение группы при каждом paste
                const offsetStep = 25;
                group.meta = group.meta || { pasteCount: 0 };
                group.meta.pasteCount = (group.meta.pasteCount || 0) + 1;
                const dx = offsetStep * group.meta.pasteCount;
                const dy = offsetStep * group.meta.pasteCount;

                // Особая логика: фрейм-бандл (фрейм + дети)
                if (group.meta && group.meta.frameBundle) {
                    const frames = data.filter(o => o && o.type === 'frame');
                    if (frames.length === 1) {
                        const frameOriginal = frames[0];
                        const children = data.filter(o => o && o.id !== frameOriginal.id);
                        const totalToPaste = 1 + children.length;
                        let pastedCount = 0;
                        const newIds = [];
                        let newFrameId = null;

                        const onPasted = (payload) => {
                            if (!payload || !payload.newId) return;
                            newIds.push(payload.newId);
                            pastedCount += 1;
                            if (!newFrameId && payload.originalId === frameOriginal.id) {
                                newFrameId = payload.newId;
                                for (const child of children) {
                                    const clonedChild = JSON.parse(JSON.stringify(child));
                                    clonedChild.properties = clonedChild.properties || {};
                                    clonedChild.properties.frameId = newFrameId;
                                    const targetPos = {
                                        x: (clonedChild.position?.x || 0) + dx,
                                        y: (clonedChild.position?.y || 0) + dy
                                    };
                                    this.clipboard = { type: 'object', data: clonedChild };
                                    const cmdChild = new PasteObjectCommand(this, targetPos);
                                    cmdChild.setEventBus(this.eventBus);
                                    this.history.executeCommand(cmdChild);
                                }
                            }
                            if (pastedCount === totalToPaste) {
                                this.eventBus.off(Events.Object.Pasted, onPasted);
                                if (this.selectTool && newIds.length > 0) {
                                    requestAnimationFrame(() => {
                                        this.selectTool.setSelection(newIds);
                                        this.selectTool.updateResizeHandles();
                                    });
                                }
                            }
                        };
                        this.eventBus.on(Events.Object.Pasted, onPasted);

                        const frameClone = JSON.parse(JSON.stringify(frameOriginal));
                        this.clipboard = { type: 'object', data: frameClone };
                        const cmdFrame = new PasteObjectCommand(this, { x: (frameClone.position?.x || 0) + dx, y: (frameClone.position?.y || 0) + dy });
                        cmdFrame.setEventBus(this.eventBus);
                        this.history.executeCommand(cmdFrame);
                        this.clipboard = group;
                        return;
                    }
                }

                // Обычная вставка группы
                let pending = data.length;
                const newIds = [];
                const onPasted = (payload) => {
                    if (!payload || !payload.newId) return;
                    newIds.push(payload.newId);
                    pending -= 1;
                    if (pending === 0) {
                        this.eventBus.off(Events.Object.Pasted, onPasted);
                        if (this.selectTool && newIds.length > 0) {
                            requestAnimationFrame(() => {
                                this.selectTool.setSelection(newIds);
                                this.selectTool.updateResizeHandles();
                            });
                        }
                    }
                };
                this.eventBus.on(Events.Object.Pasted, onPasted);

                for (const original of data) {
                    const cloned = JSON.parse(JSON.stringify(original));
                    const targetPos = {
                        x: (cloned.position?.x || 0) + dx,
                        y: (cloned.position?.y || 0) + dy
                    };
                    this.clipboard = { type: 'object', data: cloned };
                    const cmd = new PasteObjectCommand(this, targetPos);
                    cmd.setEventBus(this.eventBus);
                    this.history.executeCommand(cmd);
                }
                this.clipboard = group;
            }
        });

        // Undo/Redo теперь обрабатывается в HistoryManager
    }

    /**
     * Настройка обработчиков событий сохранения
     */
    setupSaveEvents() {
        // Предоставляем данные для сохранения
        this.eventBus.on(Events.Save.GetBoardData, (requestData) => {
            requestData.data = this.getBoardData();
        });

        // Обновляем состояние board.grid при смене сетки
        this.eventBus.on(Events.Grid.BoardDataChanged, ({ grid }) => {
            try {
                if (grid) {
                    if (!this.state.state.board) this.state.state.board = {};
                    this.state.state.board.grid = grid;
                    this.state.markDirty();
                }
            } catch (_) {}
        });

        // Обработка статуса сохранения
        this.eventBus.on(Events.Save.StatusChanged, (data) => {
            // Можно добавить UI индикатор статуса сохранения

        });

        // Обработка ошибок сохранения
        this.eventBus.on(Events.Save.Error, (data) => {
            console.error('Save error:', data.error);
            // Можно показать уведомление пользователю
        });

        // Обработка успешного сохранения
        this.eventBus.on(Events.Save.Success, async (data) => {
            // Автоматически очищаем неиспользуемые изображения после сохранения
            try {
                const result = await this.cleanupUnusedImages();
                if (result.deletedCount > 0) {
                }
            } catch (error) {
                // Не прерываем выполнение при ошибке cleanup
                console.warn('⚠️ Не удалось выполнить автоматическую очистку изображений:', error.message);
            }
        });
    }

    /**
     * Настройка обработчиков событий истории (undo/redo)
     */
    setupHistoryEvents() {
        // Следим за изменениями истории для обновления UI
        this.eventBus.on(Events.History.Changed, (data) => {

            
            // Можно здесь обновить состояние кнопок Undo/Redo в UI
            this.eventBus.emit(Events.UI.UpdateHistoryButtons, {
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
        // position — левый верх (state); приводим к центру в PIXI, используя размеры PIXI объекта
        // Все объекты используют pivot по центру, поэтому логика одинакова для всех
        const pixiObject = this.pixi.objects.get(objectId);
        if (pixiObject) {
            const halfW = (pixiObject.width || 0) / 2;
            const halfH = (pixiObject.height || 0) / 2;
            pixiObject.x = position.x + halfW;
            pixiObject.y = position.y + halfH;
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
    updateObjectSizeAndPositionDirect(objectId, size, position = null, objectType = null) {
        // Обновляем размер в PIXI
        const pixiObject = this.pixi.objects.get(objectId);
        const prevCenter = pixiObject ? { x: pixiObject.x, y: pixiObject.y } : null;
        this.pixi.updateObjectSize(objectId, size, objectType);

        // Обновляем позицию если передана (state: левый-верх; PIXI: центр)
        if (position) {
            const pixiObject2 = this.pixi.objects.get(objectId);
            if (pixiObject2) {
                const halfW = (size?.width ?? pixiObject2.width ?? 0) / 2;
                const halfH = (size?.height ?? pixiObject2.height ?? 0) / 2;
                pixiObject2.x = position.x + halfW;
                pixiObject2.y = position.y + halfH;

                // Обновляем позицию в состоянии
                const objects = this.state.state.objects;
                const object = objects.find(obj => obj.id === objectId);
                if (object) {
                    object.position.x = position.x;
                    object.position.y = position.y;
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
        const objectData = {
            id: generateObjectId(exists),
            type,
            position,
            width: initialWidth,
            height: initialHeight,
            properties,
            created: new Date().toISOString(),
            transform: {
                pivotCompensated: false  // Новые объекты еще не скомпенсированы
            },
            ...extraData  // Добавляем дополнительные данные (например, imageId)
        };

        // Создаем и выполняем команду создания объекта
        const command = new CreateObjectCommand(this, objectData);
        this.history.executeCommand(command);

        return objectData;
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
        const currentZoom = Math.max(0.1, Math.min(5, world?.scale?.x || 1));
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

    /**
     * Очищает неиспользуемые изображения с сервера
     * @returns {Promise<{deletedCount: number, errors: Array}>}
     */
    async cleanupUnusedImages() {
        try {
            if (!this.imageUploadService) {
                console.warn('ImageUploadService недоступен для очистки изображений');
                return { deletedCount: 0, errors: ['ImageUploadService недоступен'] };
            }

            const result = await this.imageUploadService.cleanupUnusedImages();
            
            // Проверяем результат на корректность
            if (!result || typeof result !== 'object') {
                console.warn('Некорректный ответ от ImageUploadService:', result);
                return { deletedCount: 0, errors: ['Некорректный ответ сервера'] };
            }

            const deletedCount = Number(result.deletedCount) || 0;
            const errors = Array.isArray(result.errors) ? result.errors : [];

            if (deletedCount > 0) {
                console.log(`Очищено ${deletedCount} неиспользуемых изображений`);
            }
            if (errors.length > 0) {
                console.warn('Ошибки при очистке изображений:', errors);
            }

            return { deletedCount, errors };
        } catch (error) {
            console.error('Ошибка при автоматической очистке изображений:', error);
            return { 
                deletedCount: 0, 
                errors: [error?.message || 'Неизвестная ошибка'] 
            };
        }
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
        
        if (this.pixi) {
            this.pixi.destroy();
            this.pixi = null;
        }
        
        // Очищаем EventBus
        if (this.eventBus) {
            this.eventBus.removeAllListeners();
            this.eventBus = null;
        }
        
        // Очищаем глобальную ссылку
        if (typeof window !== 'undefined' && window.moodboardEventBus === this.eventBus) {
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
