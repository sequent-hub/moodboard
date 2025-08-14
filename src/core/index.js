import { PixiEngine } from './PixiEngine.js';
import * as PIXI from 'pixi.js';
import { StateManager } from './StateManager.js';
import { EventBus } from './EventBus.js';
import { KeyboardManager } from './KeyboardManager.js';
import { SaveManager } from './SaveManager.js';
import { HistoryManager } from './HistoryManager.js';
import { ToolManager } from '../tools/ToolManager.js';
import { SelectTool } from '../tools/object-tools/SelectTool.js';
import { CreateObjectCommand, DeleteObjectCommand, MoveObjectCommand, ResizeObjectCommand, PasteObjectCommand, GroupMoveCommand, GroupRotateCommand, GroupResizeCommand, ReorderZCommand, GroupReorderZCommand } from './commands/index.js';
import { GridFactory } from '../grid/GridFactory.js';
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
            await this.initTools();

            // Инициализируем сетку (по умолчанию линейная)
            const canvasSize = this.workspaceSize?.() || { width: this.options.width, height: this.options.height };
            this.grid = GridFactory.createGrid('line', {
                enabled: true,
                size: 20,
                width: canvasSize.width,
                height: canvasSize.height,
                color: 0xE6E6E6,
                opacity: 0.5
            });
            this.grid.updateVisual();
            this.pixi.setGrid(this.grid);
            this.eventBus.emit('ui:grid:current', { type: 'line' });

            // Смена вида сетки из UI
            this.eventBus.on('ui:grid:change', ({ type }) => {
                const size = this.workspaceSize?.() || { width: this.options.width, height: this.options.height };
                if (type === 'off') {
                    this.grid?.setEnabled(false);
                    this.grid?.updateVisual();
                    this.pixi.setGrid(this.grid);
                    return;
                }
                const options = {
                    ...GridFactory.getDefaultOptions(type),
                    enabled: true,
                    width: size.width,
                    height: size.height
                };
                try {
                    this.grid = GridFactory.createGrid(type, options);
                    this.grid.updateVisual();
                    this.pixi.setGrid(this.grid);
                    this.eventBus.emit('ui:grid:current', { type });
                } catch (e) {
                    console.warn('Unknown grid type:', type);
                }
            });

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
        this.toolManager = new ToolManager(this.eventBus, canvasElement, this.pixi.app);
        
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
        const placementTool = new placementToolModule.PlacementTool(this.eventBus);
        this.toolManager.registerTool(placementTool);
        
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

        // Показ контекстного меню (пока пустое) — передаем вверх координаты и контекст
        this.eventBus.on('tool:context:menu:show', (data) => {
            // Прокидываем событие для UI
            this.eventBus.emit('ui:contextmenu:show', {
                x: data.x,
                y: data.y,
                context: data.context, // 'canvas' | 'object' | 'group'
                targetId: data.targetId || null,
                items: [] // пока пусто
            });
        });

        // Действия из UI контекстного меню
        this.eventBus.on('ui:copy-object', ({ objectId }) => {
            if (!objectId) return;
            this.copyObject(objectId);
        });

        this.eventBus.on('ui:copy-group', () => {
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

        this.eventBus.on('ui:paste-at', ({ x, y }) => {
            if (!this.clipboard) return;
            if (this.clipboard.type === 'object') {
                this.pasteObject({ x, y });
            } else if (this.clipboard.type === 'group') {
                // Вставляем группу с сохранением относительных позиций относительно клика
                const group = this.clipboard;
                const data = Array.isArray(group.data) ? group.data : [];
                if (data.length === 0) return;
                // Вычисляем топ-левт группы для относительного смещения клик-точки
                let minX = Infinity, minY = Infinity;
                data.forEach(o => {
                    if (!o || !o.position) return;
                    minX = Math.min(minX, o.position.x);
                    minY = Math.min(minY, o.position.y);
                });
                if (!isFinite(minX) || !isFinite(minY)) return;
                const baseX = minX, baseY = minY;
                const newIds = [];
                let pending = data.length;
                const onPasted = (payload) => {
                    if (!payload || !payload.newId) return;
                    newIds.push(payload.newId);
                    pending -= 1;
                    if (pending === 0) {
                        this.eventBus.off('object:pasted', onPasted);
                        requestAnimationFrame(() => {
                            if (this.selectTool && newIds.length > 0) {
                                this.selectTool.setSelection(newIds);
                                this.selectTool.updateResizeHandles();
                            }
                        });
                    }
                };
                this.eventBus.on('object:pasted', onPasted);
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
                // Возвращаем clipboard к группе для повторных вставок
                this.clipboard = group;
            }
        });

        // Слойность: изменение порядка отрисовки (zIndex) с синхронизацией состояния
        const applyZOrderFromState = () => {
            const arr = this.state.state.objects || [];
            // Устанавливаем zIndex по порядку в состоянии (объекты всегда < служебных элементов с высоким zIndex)
            this.pixi.app.stage.sortableChildren = true;
            for (let i = 0; i < arr.length; i++) {
                const id = arr[i]?.id;
                const pixi = id ? this.pixi.objects.get(id) : null;
                if (pixi) pixi.zIndex = i; // объекты 0..N
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

        this.eventBus.on('ui:layer:bring-to-front', ({ objectId }) => {
            const arr = this.state.state.objects || [];
            const from = arr.findIndex(o => o.id === objectId);
            if (from === -1) return;
            const to = arr.length - 1;
            if (from === to) return;
            const cmd = new ReorderZCommand(this, objectId, from, to);
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on('ui:layer:bring-forward', ({ objectId }) => {
            const arr = this.state.state.objects || [];
            const from = arr.findIndex(o => o.id === objectId);
            if (from === -1) return;
            const to = Math.min(from + 1, arr.length - 1);
            if (from === to) return;
            const cmd = new ReorderZCommand(this, objectId, from, to);
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on('ui:layer:send-backward', ({ objectId }) => {
            const arr = this.state.state.objects || [];
            const from = arr.findIndex(o => o.id === objectId);
            if (from === -1) return;
            const to = Math.max(from - 1, 0);
            if (from === to) return;
            const cmd = new ReorderZCommand(this, objectId, from, to);
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on('ui:layer:send-to-back', ({ objectId }) => {
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
        this.eventBus.on('ui:layer-group:bring-to-front', () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'front');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on('ui:layer-group:bring-forward', () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'forward');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on('ui:layer-group:send-backward', () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'backward');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });
        this.eventBus.on('ui:layer-group:send-to-back', () => {
            const ids = getSelection();
            if (ids.length === 0) return;
            const cmd = new GroupReorderZCommand(this, ids, 'back');
            cmd.setEventBus(this.eventBus);
            this.history.executeCommand(cmd);
        });

        // События перетаскивания
        this.eventBus.on('tool:drag:start', (data) => {

            // Сохраняем начальную позицию для команды
            const pixiObject = this.pixi.objects.get(data.object);
            if (pixiObject) {
                this.dragStartPosition = { x: pixiObject.x, y: pixiObject.y };
            }
        });

        // Панорамирование холста
        this.eventBus.on('tool:pan:update', ({ delta }) => {
            // Смещаем только worldLayer, сетка остается закрепленной к экрану
            if (this.pixi.worldLayer) {
                this.pixi.worldLayer.x += delta.x;
                this.pixi.worldLayer.y += delta.y;
            } else {
                const stage = this.pixi.app.stage;
                stage.x += delta.x;
                stage.y += delta.y;
            }
        });

        // === Миникарта: данные и управление ===
        // Синхронная выдача данных для миникарты (мир, вьюпорт, объекты)
        this.eventBus.on('ui:minimap:get-data', (req) => {
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            const viewEl = this.pixi.app.view;
            const objects = this.state.state.objects || [];
            req.world = {
                x: world.x,
                y: world.y,
                scale: world.scale?.x || 1
            };
            req.view = {
                width: viewEl.clientWidth,
                height: viewEl.clientHeight
            };
            req.objects = objects.map(o => ({
                id: o.id,
                x: o.position?.x || 0,
                y: o.position?.y || 0,
                width: o.width || 0,
                height: o.height || 0,
                rotation: o.rotation || 0,
                type: o.type || null
            }));
        });
        // Центрирование основного вида на мировой точке
        this.eventBus.on('ui:minimap:center-on', ({ worldX, worldY }) => {
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            const viewW = this.pixi.app.view.clientWidth;
            const viewH = this.pixi.app.view.clientHeight;
            const s = world.scale?.x || 1;
            world.x = viewW / 2 - worldX * s;
            world.y = viewH / 2 - worldY * s;
        });

        // Масштабирование колесом — глобально отрабатываем Ctrl+Wheel
        this.eventBus.on('tool:wheel:zoom', ({ x, y, delta }) => {
            const factor = 1 + (-delta) * 0.0015; // чувствительность
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            const oldScale = world.scale.x || 1;
            const newScale = Math.max(0.1, Math.min(5, oldScale * factor));
            if (newScale === oldScale) return;
            const globalPoint = new PIXI.Point(x, y);
            // Локальная точка до зума
            const localPoint = world.toLocal(globalPoint);
            // Применяем новый масштаб
            world.scale.set(newScale);
            // Глобальная позиция той же локальной точки после зума
            const newGlobal = world.toGlobal(localPoint);
            // Сдвигаем мир так, чтобы точка под курсором осталась неподвижной
            world.x += (globalPoint.x - newGlobal.x);
            world.y += (globalPoint.y - newGlobal.y);
            this.eventBus.emit('ui:zoom:percent', { percentage: Math.round(newScale * 100) });
        });

        // Кнопки зума из UI
        this.eventBus.on('ui:zoom:in', () => {
            const center = new PIXI.Point(this.pixi.app.view.clientWidth / 2, this.pixi.app.view.clientHeight / 2);
            this.eventBus.emit('tool:wheel:zoom', { x: center.x, y: center.y, delta: -120 });
        });
        this.eventBus.on('ui:zoom:out', () => {
            const center = new PIXI.Point(this.pixi.app.view.clientWidth / 2, this.pixi.app.view.clientHeight / 2);
            this.eventBus.emit('tool:wheel:zoom', { x: center.x, y: center.y, delta: 120 });
        });
        this.eventBus.on('ui:zoom:reset', () => {
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            const center = new PIXI.Point(this.pixi.app.view.clientWidth / 2, this.pixi.app.view.clientHeight / 2);
            // Сброс масштаба к 1 с центрированием
            const oldScale = world.scale.x || 1;
            const newScale = 1;
            const globalPoint = center;
            const localPoint = world.toLocal(globalPoint);
            world.scale.set(newScale);
            const newGlobal = world.toGlobal(localPoint);
            world.x += (globalPoint.x - newGlobal.x);
            world.y += (globalPoint.y - newGlobal.y);
            this.eventBus.emit('ui:zoom:percent', { percentage: 100 });
        });
        this.eventBus.on('ui:zoom:fit', () => {
            // Fit to screen: берем bbox всех объектов
            const objs = this.state.state.objects || [];
            if (objs.length === 0) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const o of objs) {
                minX = Math.min(minX, o.position.x);
                minY = Math.min(minY, o.position.y);
                maxX = Math.max(maxX, o.position.x + (o.width || 0));
                maxY = Math.max(maxY, o.position.y + (o.height || 0));
            }
            const bboxW = Math.max(1, maxX - minX);
            const bboxH = Math.max(1, maxY - minY);
            const viewW = this.pixi.app.view.clientWidth;
            const viewH = this.pixi.app.view.clientHeight;
            const padding = 40;
            const scaleX = (viewW - padding) / bboxW;
            const scaleY = (viewH - padding) / bboxH;
            const newScale = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)));
            const world = this.pixi.worldLayer || this.pixi.app.stage;
            // Центрируем bbox к центру экрана
            const worldCenterX = minX + bboxW / 2;
            const worldCenterY = minY + bboxH / 2;
            world.scale.set(newScale);
            world.x = viewW / 2 - worldCenterX * newScale;
            world.y = viewH / 2 - worldCenterY * newScale;
            this.eventBus.emit('ui:zoom:percent', { percentage: Math.round(newScale * 100) });
        });
        this.eventBus.on('ui:zoom:selection', () => {
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
            this.eventBus.emit('ui:zoom:percent', { percentage: Math.round(newScale * 100) });
        });

        // === ГРУППОВОЕ ПЕРЕТАСКИВАНИЕ ===
        this.eventBus.on('tool:group:drag:start', (data) => {
            // Сохраняем стартовые позиции для текущей группы
            this._groupDragStart = new Map();
            for (const id of data.objects) {
                const pixiObject = this.pixi.objects.get(id);
                if (pixiObject) this._groupDragStart.set(id, { x: pixiObject.x, y: pixiObject.y });
            }
        });

        this.eventBus.on('tool:group:drag:update', (data) => {
            const { dx, dy } = data.delta;
            for (const id of data.objects) {
                const pixiObject = this.pixi.objects.get(id);
                if (!pixiObject) continue;
                pixiObject.x = (this._groupDragStart.get(id)?.x || pixiObject.x) + dx;
                pixiObject.y = (this._groupDragStart.get(id)?.y || pixiObject.y) + dy;
                // Обновляем state
                const obj = this.state.state.objects.find(o => o.id === id);
                if (obj) {
                    obj.position.x = pixiObject.x;
                    obj.position.y = pixiObject.y;
                }
            }
            this.state.markDirty();
        });

        this.eventBus.on('tool:group:drag:end', (data) => {
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
                const cmd = new GroupMoveCommand(this, moves);
                cmd.setEventBus(this.eventBus);
                this.history.executeCommand(cmd);
            }
            this._groupDragStart = null;
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

        // === ДУБЛИРОВАНИЕ ЧЕРЕЗ ALT-ПЕРЕТАСКИВАНИЕ ===
        // Запрос на создание дубликата от SelectTool
        this.eventBus.on('tool:duplicate:request', (data) => {
            const { originalId, position } = data || {};
            if (!originalId) return;
            // Находим исходный объект в состоянии
            const objects = this.state.state.objects;
            const original = objects.find(obj => obj.id === originalId);
            if (!original) return;

            // Сохраняем копию в буфер обмена, чтобы переиспользовать PasteObjectCommand
            this.clipboard = {
                type: 'object',
                data: JSON.parse(JSON.stringify(original))
            };

            // Вызываем вставку с конкретной позицией (там рассчитается ID и пр.)
            this.pasteObject(position);
        });

        // Запрос на групповое дублирование
        this.eventBus.on('tool:group:duplicate:request', (data) => {
            const originals = (data.objects || []).filter((id) => this.state.state.objects.some(o => o.id === id));
            const total = originals.length;
            if (total === 0) {
                this.eventBus.emit('tool:group:duplicate:ready', { map: {} });
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
                if (h) this.eventBus.off('object:pasted', h);
                remaining -= 1;
                if (remaining === 0) {
                    this.eventBus.emit('tool:group:duplicate:ready', { map: idMap });
                }
            };
            // Дублируем по одному, используя текущие позиции как стартовые
            for (const originalId of originals) {
                const obj = this.state.state.objects.find(o => o.id === originalId);
                if (!obj) continue;
                // Подписываемся на ответ именно для этого оригинала
                const handler = onPasted(originalId);
                tempHandlers.set(originalId, handler);
                this.eventBus.on('object:pasted', handler);
                // Кладем в clipboard объект, затем вызываем PasteObjectCommand с текущей позицией
                this.clipboard = { type: 'object', data: JSON.parse(JSON.stringify(obj)) };
                const cmd = new PasteObjectCommand(this, { x: obj.position.x, y: obj.position.y });
                cmd.setEventBus(this.eventBus);
                this.history.executeCommand(cmd);
            }
        });

        // Когда объект вставлен (из PasteObjectCommand) — сообщаем SelectTool
        this.eventBus.on('object:pasted', ({ originalId, newId }) => {
            this.eventBus.emit('tool:duplicate:ready', { originalId, newId });
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

        // === ГРУППОВОЙ RESIZE ===
        this.eventBus.on('tool:group:resize:start', (data) => {
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

        this.eventBus.on('tool:group:resize:update', (data) => {
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
                // Преобразуем центр в левый верх для state/PIXI (мы используем x/y как левый верх)
                const newPos = { x: newCenter.x, y: newCenter.y };
                const newSize = {
                    width: Math.max(10, snap.size.width * sx),
                    height: Math.max(10, snap.size.height * sy)
                };
                this.updateObjectSizeAndPositionDirect(id, newSize, newPos, snap.type || null);
            }
        });

        this.eventBus.on('tool:group:resize:end', (data) => {
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

        // === ГРУППОВОЙ ПОВОРОТ ===
        this.eventBus.on('tool:group:rotate:start', (data) => {
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

        this.eventBus.on('tool:group:rotate:update', (data) => {
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
                this.updateObjectPositionDirect(id, { x: newX, y: newY });
                this.pixi.updateObjectRotation(id, newAngle);
                this.updateObjectRotationDirect(id, newAngle);
            }
            // Сообщаем UI обновить ручки, если активна рамка группы
            this.eventBus.emit('object:transform:updated', { objectId: '__group__', type: 'rotation' });
        });

        this.eventBus.on('tool:group:rotate:end', (data) => {
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

        // Получение списка всех объектов (с их PIXI и логическими границами)
        this.eventBus.on('tool:get:all:objects', (data) => {
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

        // Удаление выделенных объектов (делаем копию списка, чтобы избежать мутаций во время удаления)
        this.eventBus.on('keyboard:delete', () => {
            if (this.toolManager.getActiveTool()?.name === 'select') {
                const ids = Array.from(this.toolManager.getActiveTool().selectedObjects);
                ids.forEach((objectId) => this.deleteObject(objectId));
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

        // Копирование выделенных объектов (поддержка группы)
        this.eventBus.on('keyboard:copy', () => {
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
        this.eventBus.on('keyboard:paste', () => {
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
                // Подготовим сбор новых id через единый временный слушатель
                let pending = data.length;
                const newIds = [];
                const onPasted = (payload) => {
                    if (!payload || !payload.newId) return;
                    newIds.push(payload.newId);
                    pending -= 1;
                    if (pending === 0) {
                        this.eventBus.off('object:pasted', onPasted);
                        // Выделяем новую группу и показываем рамку с ручками
                        if (this.selectTool && newIds.length > 0) {
                            requestAnimationFrame(() => {
                                this.selectTool.setSelection(newIds);
                                this.selectTool.updateResizeHandles();
                            });
                        }
                    }
                };
                this.eventBus.on('object:pasted', onPasted);

                // Вставляем каждый объект группы, сохраняя относительное расположение + общее смещение
                for (const original of data) {
                    const cloned = JSON.parse(JSON.stringify(original));
                    const targetPos = {
                        x: (cloned.position?.x || 0) + dx,
                        y: (cloned.position?.y || 0) + dy
                    };
                    // Используем существующую логику PasteObjectCommand поверх clipboard типа object
                    this.clipboard = { type: 'object', data: cloned };
                    const cmd = new PasteObjectCommand(this, targetPos);
                    cmd.setEventBus(this.eventBus);
                    this.history.executeCommand(cmd);
                }
                // После вставки возвращаем clipboard к группе, чтобы можно было ещё раз вставлять с новым смещением
                this.clipboard = group;
                // Рамка появится по завершении обработки всех событий object:pasted
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
        // Обновляем позицию в PIXI — координаты трактуем как левый верх объекта
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
        const pixiObject = this.pixi.objects.get(objectId);
        const prevPosition = pixiObject ? { x: pixiObject.x, y: pixiObject.y } : null;
        this.pixi.updateObjectSize(objectId, size, objectType);
        
        // Обновляем позицию если передана (для левых/верхних ручек)
        if (position) {
            const pixiObject2 = this.pixi.objects.get(objectId);
            if (pixiObject2) {
                console.log(`📍 Устанавливаем позицию объекта: (${position.x}, ${position.y})`);
                // Если pixiObject был и мы только что пересоздавали геометрию, могли потерять центр.
                // Ставим позицию как есть (левый верх) — в PixiEngine пересоздание больше не трогает позицию.
                pixiObject2.x = position.x;
                pixiObject2.y = position.y;
                
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
        const exists = (id) => {
            const inState = (this.state.state.objects || []).some(o => o.id === id);
            const inPixi = this.pixi?.objects?.has ? this.pixi.objects.has(id) : false;
            return inState || inPixi;
        };
        const initialWidth = (properties && typeof properties.width === 'number') ? properties.width : 100;
        const initialHeight = (properties && typeof properties.height === 'number') ? properties.height : 100;
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
    pasteObject(position = null) {
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
