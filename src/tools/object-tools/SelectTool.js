import { calculateNewSize, calculatePositionOffset } from './selection/GeometryUtils.js';
import { BaseTool } from '../BaseTool.js';
import { ResizeHandles } from '../ResizeHandles.js';
import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { SelectionModel } from './selection/SelectionModel.js';
// import { HandlesSync } from './selection/HandlesSync.js';
import { SimpleDragController } from './selection/SimpleDragController.js';
import { ResizeController } from './selection/ResizeController.js';
import { RotateController } from './selection/RotateController.js';
import { GroupResizeController } from './selection/GroupResizeController.js';
import { GroupRotateController } from './selection/GroupRotateController.js';
import { GroupDragController } from './selection/GroupDragController.js';
import { BoxSelectController } from './selection/BoxSelectController.js';
import cursorDefaultSvg from '../../assets/icons/cursor-default.svg?raw';

// Построение data URL для курсора по умолчанию (стрелка) — масштабируем в 2 раза меньше
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
 * Инструмент выделения и работы с объектами
 * Основной инструмент для выделения, перемещения, изменения размера и поворота объектов
 */
export class SelectTool extends BaseTool {
    constructor(eventBus) {
        super('select', eventBus);
        this.cursor = DEFAULT_CURSOR;
        this.hotkey = 'v';
        
        // Флаг состояния объекта
        this.destroyed = false;
        
        // Состояние выделения перенесено в модель
        this.selection = new SelectionModel();
        this.isMultiSelect = false;
		
		// Режим Alt-клонирования при перетаскивании
		// Если Alt зажат при начале drag, создаем копию и перетаскиваем именно её
		this.isAltCloneMode = false; // активен ли режим Alt-клона
		this.clonePending = false;   // ожидаем подтверждение создания копии
		this.cloneRequested = false; // запрос на создание копии уже отправлен
		this.cloneSourceId = null;   // исходный объект для копии
		// Групповой Alt-клон
		this.isAltGroupCloneMode = false;
		this.groupClonePending = false;
		this.groupCloneOriginalIds = [];
		this.groupCloneMap = null; // { originalId: newId }
        
        // Состояние перетаскивания
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.dragTarget = null;
        
        // Состояние изменения размера
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.resizeStartMousePos = null;
        this.resizeStartPosition = null;
        
        // Система ручек изменения размера
        this.resizeHandles = null;
        this.groupSelectionGraphics = null; // визуализация рамок при множественном выделении
        this.groupBoundsGraphics = null; // невидимая геометрия для ручек группы
        this.groupId = '__group__';
        this.isGroupDragging = false;
        this.isGroupResizing = false;
        this.isGroupRotating = false;
        this.groupStartBounds = null;
        this.groupStartMouse = null;
        this.groupDragOffset = null;
        this.groupObjectsInitial = null; // Map id -> { position, size, rotation }
        
        // Текущие координаты мыши
        this.currentX = 0;
        this.currentY = 0;
        
        // Состояние поворота
        this.isRotating = false;
        this.rotateCenter = null;
        this.rotateStartAngle = 0;
        this.rotateCurrentAngle = 0;
        this.rotateStartMouseAngle = 0;
        
        // Состояние рамки выделения
        this.isBoxSelect = false;
        this.selectionBox = null;
        this.selectionGraphics = null; // PIXI.Graphics для визуализации рамки
        this.initialSelectionBeforeBox = null; // снимок выделения перед началом box-select

		// Подписка на событие готовности дубликата (от Core)
		// Когда PasteObjectCommand завершится, ядро сообщит newId
		if (this.eventBus) {
            this.eventBus.on(Events.Tool.DuplicateReady, (data) => {
				// data: { originalId, newId }
				if (!this.isAltCloneMode || !this.clonePending) return;
				if (!data || data.originalId !== this.cloneSourceId) return;
				this.onDuplicateReady(data.newId);
			});
			// Групповой клон готов
            this.eventBus.on(Events.Tool.GroupDuplicateReady, (data) => {
				// data: { map: { [originalId]: newId } }
				if (!this.isAltGroupCloneMode || !this.groupClonePending) return;
				if (!data || !data.map) return;
				this.onGroupDuplicateReady(data.map);
			});
            this.eventBus.on(Events.Tool.ObjectEdit, (object) => {
                // Определяем тип редактируемого объекта
                const objectType = object.type || (object.object && object.object.type) || 'text';
                
                if (objectType === 'file') {
                    // Для файлов используем специальный редактор названия
                    this._openFileNameEditor(object, object.create || false);
                } else {
                    // Для текста и записок используем обычный редактор
                    if (object.create) {
                        // Создание нового объекта с редактированием
                        this._openTextEditor(object, true);
                    } else {
                        // Редактирование существующего объекта
                        this._openTextEditor(object, false);
                    }
                }
            });

            // Обработка удаления объектов (undo создания, delete команды и т.д.)
            this.eventBus.on(Events.Object.Deleted, (data) => {
                const objectId = data?.objectId || data;
                console.log('🗑️ SelectTool: получено событие удаления объекта:', objectId, 'данные:', data);
                
                // ЗАЩИТА: Проверяем что данные валидны
                if (!objectId) {
                    console.warn('⚠️ SelectTool: получено событие удаления с невалидным objectId');
                    return;
                }
                
                if (this.selection.has(objectId)) {
                    console.log('🗑️ SelectTool: удаляем объект из selection:', objectId);
                    this.removeFromSelection(objectId);
                    
                    // ИСПРАВЛЕНИЕ: Принудительно очищаем selection если он стал пустым
                    if (this.selection.size() === 0) {
                        console.log('🗑️ SelectTool: selection пустой, скрываем ручки');
                        this.emit(Events.Tool.SelectionClear);
                        this.updateResizeHandles();
                    }
                } else {
                    console.log('🗑️ SelectTool: объект не был в selection, обновляем ручки на всякий случай');
                    // Принудительно обновляем ручки без излишних действий
                    this.updateResizeHandles();
                }
            });
		}
        this.textEditor = {
            active: false,
            objectId: null,
            textarea: null,
            wrapper: null,
            world: null,
            position: null, // world top-left
            properties: null, // { fontSize }
            objectType: 'text', // 'text' or 'note'
            isResizing: false,
        };
    }
    
    /**
     * Активация инструмента
     */
    activate(app) {
        super.activate();
		// Сохраняем ссылку на PIXI app для оверлеев (рамка выделения)
		this.app = app;
        
        // Устанавливаем стандартный курсор для select инструмента
        if (this.app && this.app.view) {
            this.app.view.style.cursor = DEFAULT_CURSOR; // пусто → наследует глобальный CSS
        }
        
        // Инициализируем систему ручек изменения размера
        if (!this.resizeHandles && app) {
            this.resizeHandles = new ResizeHandles(app);
            // Полностью отключаем синхронизацию старых PIXI-ручек
            if (this.resizeHandles && typeof this.resizeHandles.hideHandles === 'function') {
                this.resizeHandles.hideHandles();
            }
            this._dragCtrl = new SimpleDragController({
                emit: (event, payload) => this.emit(event, payload)
            });
            this._resizeCtrl = new ResizeController({
                emit: (event, payload) => this.emit(event, payload),
                getRotation: (objectId) => {
                    const d = { objectId, rotation: 0 };
                    this.emit(Events.Tool.GetObjectRotation, d);
                    return d.rotation || 0;
                }
            });
            this._rotateCtrl = new RotateController({
                emit: (event, payload) => this.emit(event, payload)
            });
            this._groupResizeCtrl = new GroupResizeController({
                emit: (event, payload) => this.emit(event, payload),
                selection: this.selection,
                getGroupBounds: () => this.computeGroupBounds(),
                ensureGroupGraphics: (b) => this.ensureGroupBoundsGraphics(b),
                updateGroupGraphics: (b) => this.updateGroupBoundsGraphics(b)
            });
            this._groupRotateCtrl = new GroupRotateController({
                emit: (event, payload) => this.emit(event, payload),
                selection: this.selection,
                getGroupBounds: () => this.computeGroupBounds(),
                ensureGroupGraphics: (b) => this.ensureGroupBoundsGraphics(b),
                updateHandles: () => { if (this.resizeHandles) this.resizeHandles.updateHandles(); }
            });
            this._groupDragCtrl = new GroupDragController({
                emit: (event, payload) => this.emit(event, payload),
                selection: this.selection,
                updateGroupBoundsByTopLeft: (pos) => this.updateGroupBoundsGraphicsByTopLeft(pos)
            });
            this._boxSelect = new BoxSelectController({
                app,
                selection: this.selection,
                emit: (event, payload) => this.emit(event, payload),
                setSelection: (ids) => this.setSelection(ids),
                clearSelection: () => this.clearSelection(),
                rectIntersectsRect: (a, b) => this.rectIntersectsRect(a, b)
            });
        } else if (!app) {
            console.log('❌ PIXI app не передан в activate');
        } else {
        }
    }

    // Удобные врапперы вокруг SelectionModel (для минимальных правок ниже)
    _has(id) { return this.selection.has(id); }
    _size() { return this.selection.size(); }
    _ids() { return this.selection.toArray(); }
    _clear() { this.selection.clear(); }
    _add(id) { this.selection.add(id); }
    _addMany(ids) { this.selection.addMany(ids); }
    _remove(id) { this.selection.remove(id); }
    _toggle(id) { this.selection.toggle(id); }
    _computeGroupBounds(getPixiById) { return this.selection.computeBounds(getPixiById); }
    
    /**
     * Деактивация инструмента
     */
    deactivate() {
        super.deactivate();
        
        // Закрываем текстовый/файловый редактор если открыт
        if (this.textEditor.active) {
            if (this.textEditor.objectType === 'file') {
                this._closeFileNameEditor(true);
            } else {
                this._closeTextEditor(true);
            }
        }
        
        // Очищаем выделение и ручки
        this.clearSelection();
        // Скрываем любые старые PIXI-ручки: используем только HTML-ручки
        
        // Сбрасываем курсор на стандартный
        if (this.app && this.app.view) {
            this.app.view.style.cursor = '';
        }
    }
    
    /**
     * Нажатие кнопки мыши
     */
    onMouseDown(event) {
        super.onMouseDown(event);
        
        // Если активен текстовый редактор, закрываем его при клике вне
        if (this.textEditor.active) {
            if (this.textEditor.objectType === 'file') {
                this._closeFileNameEditor(true);
            } else {
                this._closeTextEditor(true);
            }
            return; // Прерываем выполнение, чтобы не обрабатывать клик дальше
        }
        
        this.isMultiSelect = event.originalEvent.ctrlKey || event.originalEvent.metaKey;
        
        // Проверяем, что под курсором
        const hitResult = this.hitTest(event.x, event.y);
        
        if (hitResult.type === 'resize-handle') {
            this.startResize(hitResult.handle, hitResult.object);
        } else if (hitResult.type === 'rotate-handle') {
            this.startRotate(hitResult.object);
        } else if (this.selection.size() > 1) {
            // Особая логика для группового выделения: клики внутри общей рамки не снимают выделение
            const gb = this.computeGroupBounds();
            const insideGroup = this.isPointInBounds({ x: event.x, y: event.y }, { x: gb.x, y: gb.y, width: gb.width, height: gb.height });
            if (insideGroup) {
                // Если клик внутри группы (по объекту или пустому месту), сохраняем выделение и начинаем перетаскивание группы
                this.startGroupDrag(event);
                return;
            }
            // Вне группы — обычная логика
            if (hitResult.type === 'object') {
                this.handleObjectSelect(hitResult.object, event);
            } else {
                this.startBoxSelect(event);
            }
        } else if (hitResult.type === 'object') {
            // Особая логика для фреймов: если у фрейма есть дети и клик внутри внутренней области (без 20px рамки),
            // то не начинаем drag фрейма, а запускаем box-select для выбора объектов внутри
            const req = { objectId: hitResult.object, pixiObject: null };
            this.emit(Events.Tool.GetObjectPixi, req);
            const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
            if (mbType === 'frame') {
                // Получаем данные фрейма и его экранные границы
                const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                const frameObj = objects.find(o => o.id === hitResult.object);
                const hasChildren = !!(objects && objects.some(o => o.properties && o.properties.frameId === hitResult.object));
                if (req.pixiObject && hasChildren && frameObj) {
                    const bounds = req.pixiObject.getBounds(); // экранные координаты
                    const inner = { x: bounds.x + 20, y: bounds.y + 20, width: Math.max(0, bounds.width - 40), height: Math.max(0, bounds.height - 40) };
                    const insideInner = this.isPointInBounds({ x: event.x, y: event.y }, inner);
                    // Если клик внутри внутренней области — запускаем box-select и выходим
                    if (insideInner) {
                        // Запускаем рамку выделения вместо drag фрейма
                        this.startBoxSelect(event);
                        return;
                    }
                    // Если клик на 20px рамке — позволяем перетягивать фрейм. Но запрещаем box-select от рамки.
                    // Здесь ничего не делаем: ниже пойдёт обычная логика handleObjectSelect
                }
            }
            // Обычная логика: начинаем drag выбранного объекта
            this.handleObjectSelect(hitResult.object, event);
        } else {
            // Клик по пустому месту — если есть одиночное выделение, разрешаем drag за пределами объекта в пределах рамки
            if (this.selection.size() === 1) {
                const selId = this.selection.toArray()[0];
                // Если выбран фрейм с детьми и клик внутри внутренней области — не начинаем drag, а box-select
                const req = { objectId: selId, pixiObject: null };
                this.emit(Events.Tool.GetObjectPixi, req);
                const isFrame = !!(req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type === 'frame');
                if (isFrame) {
                    const objects = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                    const frameObj = objects.find(o => o.id === selId);
                    const hasChildren = !!(objects && objects.some(o => o.properties && o.properties.frameId === selId));
                    if (frameObj && hasChildren) {
                        const b = { x: frameObj.position.x, y: frameObj.position.y, width: frameObj.width || 0, height: frameObj.height || 0 };
                        const inner = { x: b.x + 20, y: b.y + 20, width: Math.max(0, b.width - 40), height: Math.max(0, b.height - 40) };
                        const insideInner = this.isPointInBounds({ x: event.x, y: event.y }, inner);
                        if (insideInner) {
                            this.startBoxSelect(event);
                            return;
                        }
                    }
                }
                // Обычная логика: если клик внутри рамки выбранного — начинаем drag
                const boundsReq = { objects: [] };
                this.emit(Events.Tool.GetAllObjects, boundsReq);
                const map = new Map(boundsReq.objects.map(o => [o.id, o.bounds]));
                const b = map.get(selId);
                if (b && this.isPointInBounds({ x: event.x, y: event.y }, b)) {
                    // Для фрейма c детьми: отфильтруем клики внутри внутренней области (box-select)
                    const req2 = { objectId: selId, pixiObject: null };
                    this.emit(Events.Tool.GetObjectPixi, req2);
                    const isFrame2 = !!(req2.pixiObject && req2.pixiObject._mb && req2.pixiObject._mb.type === 'frame');
                    if (isFrame2) {
                        const os = this.core?.state?.getObjects ? this.core.state.getObjects() : [];
                        const fr = os.find(o => o.id === selId);
                        const hasChildren2 = !!(os && os.some(o => o.properties && o.properties.frameId === selId));
                        if (req2.pixiObject && fr && hasChildren2) {
                            const bounds2 = req2.pixiObject.getBounds();
                            const inner2 = { x: bounds2.x + 20, y: bounds2.y + 20, width: Math.max(0, bounds2.width - 40), height: Math.max(0, bounds2.height - 40) };
                            if (this.isPointInBounds({ x: event.x, y: event.y }, inner2)) {
                                this.startBoxSelect(event);
                                return;
                            }
                        }
                    }
                    // Старт перетаскивания как если бы кликнули по объекту
                    this.startDrag(selId, event);
                    return;
                }
            }
            // Иначе — начинаем рамку выделения
            this.startBoxSelect(event);
        }
    }
    
    /**
     * Перемещение мыши
     */
		onMouseMove(event) {
        // Проверяем, что инструмент не уничтожен
        if (this.destroyed) {
            return;
        }
        
        super.onMouseMove(event);
        
        // Обновляем текущие координаты мыши
        this.currentX = event.x;
        this.currentY = event.y;
        
			if (this.isResizing || this.isGroupResizing) {
            this.updateResize(event);
			} else if (this.isRotating || this.isGroupRotating) {
            this.updateRotate(event);
			} else if (this.isDragging || this.isGroupDragging) {
            this.updateDrag(event);
        } else if (this.isBoxSelect) {
            this.updateBoxSelect(event);
        } else {
            // Обновляем курсор в зависимости от того, что под мышью
            this.updateCursor(event);
        }
    }
    
    /**
     * Отпускание кнопки мыши
     */
		onMouseUp(event) {
        if (this.isResizing || this.isGroupResizing) {
				this.endResize();
        } else if (this.isRotating || this.isGroupRotating) {
            this.endRotate();
			} else if (this.isDragging || this.isGroupDragging) {
            this.endDrag();
        } else if (this.isBoxSelect) {
            this.endBoxSelect();
        }
        
        super.onMouseUp(event);
    }
    
    /**
     * Двойной клик - переход в режим редактирования
     */
    onDoubleClick(event) {
        const hitResult = this.hitTest(event.x, event.y);
        
        if (hitResult.type === 'object') {
            // если это текст или записка — войдём в режим редактирования через ObjectEdit
            const req = { objectId: hitResult.object, pixiObject: null };
            this.emit(Events.Tool.GetObjectPixi, req);
            const pix = req.pixiObject;
            
            const isText = !!(pix && pix._mb && pix._mb.type === 'text');
            const isNote = !!(pix && pix._mb && pix._mb.type === 'note');
            const isFile = !!(pix && pix._mb && pix._mb.type === 'file');
            
            if (isText) {
                // Получаем позицию объекта для редактирования
                const posData = { objectId: hitResult.object, position: null };
                this.emit(Events.Tool.GetObjectPosition, posData);
                
                // Получаем содержимое из properties объекта
                const textContent = pix._mb?.properties?.content || '';
                
                this.emit(Events.Tool.ObjectEdit, { 
                    id: hitResult.object, 
                    type: 'text', 
                    position: posData.position,
                    properties: { content: textContent },
                    create: false 
                });
                return;
            }
            if (isNote) {
                const noteProps = pix._mb.properties || {};
                // Получаем позицию объекта для редактирования
                const posData = { objectId: hitResult.object, position: null };
                this.emit(Events.Tool.GetObjectPosition, posData);
                
                this.emit(Events.Tool.ObjectEdit, { 
                    id: hitResult.object, 
                    type: 'note', 
                    position: posData.position,
                    properties: { content: noteProps.content || '' },
                    create: false 
                });
                return;
            }
            
            if (isFile) {
                const fileProps = pix._mb.properties || {};
                // Получаем позицию объекта для редактирования
                const posData = { objectId: hitResult.object, position: null };
                this.emit(Events.Tool.GetObjectPosition, posData);
                
                this.emit(Events.Tool.ObjectEdit, { 
                    id: hitResult.object, 
                    type: 'file', 
                    position: posData.position,
                    properties: { fileName: fileProps.fileName || 'Untitled' },
                    create: false 
                });
                return;
            }
            this.editObject(hitResult.object);
        }
    }

    /**
     * Контекстное меню (правая кнопка) — пока пустое, только определяем контекст
     */
    onContextMenu(event) {
        // Определяем, что под курсором
        const hit = this.hitTest(event.x, event.y);
        let context = 'canvas';
        let targetId = null;
        if (hit && hit.type === 'object' && hit.object) {
            targetId = hit.object;
            if (this.selection.has(targetId) && this.selection.size() > 1) {
                context = 'group';
            } else {
                context = 'object';
            }
        } else if (this.selection.size() > 1) {
            context = 'group';
        }
        // Сообщаем ядру/UI, что нужно показать контекстное меню (пока без пунктов)
        this.emit(Events.Tool.ContextMenuShow, { x: event.x, y: event.y, context, targetId });
    }
    
    /**
     * Обработка клавиш
     */
    onKeyDown(event) {
        // Проверяем, не активен ли текстовый редактор (редактирование названия файла или текста)
        if (this.textEditor && this.textEditor.active) {
            return; // Не обрабатываем клавиши во время редактирования
        }
        
        switch (event.key) {
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedObjects();
                break;
                
            case 'a':
                if (event.ctrlKey) {
                    this.selectAll();
                    event.originalEvent.preventDefault();
                }
                break;
                
            case 'Escape':
                this.clearSelection();
                break;
        }
    }
    
    /**
     * Тестирование попадания курсора
     */
    hitTest(x, y) {
        // Проверяем, что инструмент не уничтожен
        if (this.destroyed) {
            return { type: 'empty' };
        }
        
        // Сначала проверяем ручки изменения размера (они имеют приоритет)
        if (this.resizeHandles) {
            const pixiObjectAtPoint = this.getPixiObjectAt(x, y);

            
            const handleInfo = this.resizeHandles.getHandleInfo(pixiObjectAtPoint);
            if (handleInfo) {

                
                // Определяем тип ручки
                const hitType = handleInfo.type === 'rotate' ? 'rotate-handle' : 'resize-handle';
                
                return {
                    type: hitType,
                    handle: handleInfo.type,
                    object: handleInfo.targetObjectId,
                    pixiObject: handleInfo.handle
                };
            }
        }
        
        // Получаем объекты из системы через событие
        const hitTestData = { x, y, result: null };
        this.emit(Events.Tool.HitTest, hitTestData);
        
        if (hitTestData.result && hitTestData.result.object) {
            return hitTestData.result;
        }
        
        return { type: 'empty' };
    }
    
    /**
     * Получить PIXI объект по координатам (для внутреннего использования)
     */
    getPixiObjectAt(x, y) {
        // Проверяем, что инструмент не уничтожен
        if (this.destroyed) {
            return null;
        }
        
        if (!this.resizeHandles || !this.resizeHandles.app || !this.resizeHandles.container) return null;
        
        const point = new PIXI.Point(x, y);
        
        // Сначала ищем в контейнере ручек (приоритет)
        if (this.resizeHandles.container && this.resizeHandles.container.visible) {
            const container = this.resizeHandles.container;
            if (!container || !container.children) return null;
            
            for (let i = container.children.length - 1; i >= 0; i--) {
                const child = container.children[i];
                
                // Проверяем обычные объекты
                if (child && child.containsPoint && typeof child.containsPoint === 'function') {
                    try {
                        if (child.containsPoint(point)) {
                            return child;
                        }
                    } catch (error) {
                        // Игнорируем ошибки containsPoint
                    }
                }
                
                // Специальная проверка для контейнеров (ручка вращения)
                if (child instanceof PIXI.Container && child.children && child.children.length > 0) {
                    // Проверяем границы контейнера
                    try {
                        const bounds = child.getBounds();
                        if (bounds && point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
                            point.y >= bounds.y && point.y <= bounds.y + bounds.height) {

                            return child;
                        }
                    } catch (error) {
                        // Игнорируем ошибки getBounds
                    }
                }
            }
        }
        
        // Затем ищем в основной сцене
        const stage = this.resizeHandles.app.stage;
        if (!stage || !stage.children) return null;
        
        for (let i = stage.children.length - 1; i >= 0; i--) {
            const child = stage.children[i];
            if (this.resizeHandles.container && child && child !== this.resizeHandles.container && 
                child.containsPoint && typeof child.containsPoint === 'function') {
                try {
                    if (child.containsPoint(point)) {
                        return child;
                    }
                } catch (error) {
                    // Игнорируем ошибки containsPoint
                }
            }
        }
        
		return null;
    }
    
    /**
     * Обработка выделения объекта
     */
    handleObjectSelect(objectId, event) {
        if (!this.isMultiSelect) {
            this.clearSelection();
        }
        
        if (this.selection.has(objectId)) {
            if (this.isMultiSelect) {
                this.removeFromSelection(objectId);
            } else if (this.selection.size() > 1) {
                // Перетаскивание группы
                this.startGroupDrag(event);
            } else {
                // Начинаем перетаскивание
                this.startDrag(objectId, event);
            }
        } else {
            this.addToSelection(objectId);
            if (this.selection.size() > 1) {
                this.startGroupDrag(event);
            } else {
                this.startDrag(objectId, event);
            }
        }
    }
    
    /**
     * Начало перетаскивания
     */
    startDrag(objectId, event) {
        this.isDragging = true;
        this.dragTarget = objectId;
        // Сообщаем HtmlHandlesLayer о начале перетаскивания одиночного объекта
        this.emit(Events.Tool.DragStart, { object: objectId });
        
        // Получаем текущую позицию объекта
        const objectData = { objectId, position: null };
        this.emit(Events.Tool.GetObjectPosition, objectData);
        // Нормализуем координаты в мировые (worldLayer), чтобы убрать влияние зума
        const w = this._toWorld(event.x, event.y);
        // Запоминаем смещение точки захвата курсора относительно левого-верхнего угла объекта (в мировых координатах)
        if (objectData.position) {
            this._dragGrabOffset = {
                x: w.x - objectData.position.x,
                y: w.y - objectData.position.y
            };
        } else {
            this._dragGrabOffset = null;
        }
        const worldEvent = { ...event, x: w.x, y: w.y };
        if (this._dragCtrl) this._dragCtrl.start(objectId, worldEvent);
    }
    
    /**
     * Обновление перетаскивания
     */
    updateDrag(event) {
        // Перетаскивание группы
        if (this.isGroupDragging && this._groupDragCtrl) {
            const w = this._toWorld(event.x, event.y);
            this._groupDragCtrl.update({ ...event, x: w.x, y: w.y });
            return;
        }
        // Если во время обычного перетаскивания зажали Alt — включаем режим клонирования на лету
        if (this.isDragging && !this.isAltCloneMode && event.originalEvent && event.originalEvent.altKey) {
            this.isAltCloneMode = true;
            this.cloneSourceId = this.dragTarget;
            this.clonePending = true;
            // Создаём дубликат так, чтобы курсор захватывал ту же точку объекта
            const wpos = this._toWorld(event.x, event.y);
            const targetTopLeft = this._dragGrabOffset
                ? { x: wpos.x - this._dragGrabOffset.x, y: wpos.y - this._dragGrabOffset.y }
                : { x: wpos.x, y: wpos.y };
            this.emit(Events.Tool.DuplicateRequest, {
                originalId: this.cloneSourceId,
                position: targetTopLeft
            });
            // Не сбрасываем dragTarget, чтобы исходник продолжал двигаться до появления копии
            // Визуально это ок: копия появится и захватит drag в onDuplicateReady
        }
        // Если ожидаем создание копии — продолжаем двигать текущую цель (исходник)
        if (!this.dragTarget) return;
        
        if (this._dragCtrl) {
            const w = this._toWorld(event.x, event.y);
            this._dragCtrl.update({ ...event, x: w.x, y: w.y });
        }
        // Обновление позиции в ядро уже выполняется через SimpleDragController (drag:update)
        // Дополнительный эмит здесь не нужен и приводил к некорректным данным
        
        // Обновляем ручки во время перетаскивания
        if (this.resizeHandles && this.selection.has(this.dragTarget)) {
            this.resizeHandles.updateHandles();
        }
    }
    
    /**
     * Завершение перетаскивания
     */
    endDrag() {
        if (this.isGroupDragging) {
            const ids = this.selection.toArray();
            this.emit(Events.Tool.GroupDragEnd, { objects: ids });
            if (this._groupDragCtrl) this._groupDragCtrl.end();
            this.isAltGroupCloneMode = false;
            this.groupClonePending = false;
            this.groupCloneOriginalIds = [];
            this.groupCloneMap = null;
        } else if (this.dragTarget) {
            if (this._dragCtrl) this._dragCtrl.end();
            // Сообщаем о завершении перетаскивания одиночного объекта
            this.emit(Events.Tool.DragEnd, { object: this.dragTarget });
        }
        
        this.isDragging = false;
        this.isGroupDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
		// Сбрасываем состояние Alt-клона
		this.isAltCloneMode = false;
		this.clonePending = false;
		this.cloneSourceId = null;
    }
    
    /**
     * Начало изменения размера
     */
    startResize(handle, objectId) {
        // Групповой resize
        if (objectId === this.groupId && this.selection.size() > 1) {
            this.isGroupResizing = true;
            this.resizeHandle = handle;
            if (this._groupResizeCtrl) this._groupResizeCtrl.start(handle, { x: this.currentX, y: this.currentY });
            this.isResizing = false;
            return;
        }

        this.isResizing = true;
        this.resizeHandle = handle;
        this.dragTarget = objectId;
        if (this._resizeCtrl) {
            const w = this._toWorld(this.currentX, this.currentY);
            this._resizeCtrl.start(handle, objectId, { x: w.x, y: w.y });
        }
    }
    
    /**
     * Обновление изменения размера
     */
    updateResize(event) {
		// Групповой resize
        if (this.isGroupResizing && this._groupResizeCtrl) {
            const w = this._toWorld(event.x, event.y);
            this._groupResizeCtrl.update({ ...event, x: w.x, y: w.y });
            return; 
        }

        if (this._resizeCtrl) {
            const w = this._toWorld(event.x, event.y);
            this._resizeCtrl.update({ ...event, x: w.x, y: w.y }, {
                calculateNewSize: (handleType, startBounds, dx, dy, keepAR) => {
                    const rot = (() => { const d = { objectId: this.dragTarget, rotation: 0 }; this.emit(Events.Tool.GetObjectRotation, d); return d.rotation || 0; })();
                    return this.calculateNewSize(handleType, startBounds, dx, dy, keepAR, rot);
                },
                calculatePositionOffset: (handleType, startBounds, newSize, objectRotation) => {
                    return this.calculatePositionOffset(handleType, startBounds, newSize, objectRotation);
                }
            });
        }
        
        // Обновляем ручки в реальном времени во время resize
        // HTML-ручки обновляются слоем HtmlHandlesLayer
    }
    
    /**
     * Завершение изменения размера
     */
    endResize() {
        if (this.isGroupResizing) {
            if (this._groupResizeCtrl) this._groupResizeCtrl.end();
            this.isGroupResizing = false;
            this.resizeHandle = null;
            this.groupStartBounds = null;
            this.groupStartMouse = null;
            this.groupObjectsInitial = null;
            // Принудительно синхронизируем ручки и рамку после завершения, чтобы отлипли от курсора
            const gb = this.computeGroupBounds();
            this.ensureGroupBoundsGraphics(gb);
            if (this.groupBoundsGraphics) {
                this.groupBoundsGraphics.rotation = 0;
                this.groupBoundsGraphics.pivot.set(0, 0);
                this.groupBoundsGraphics.position.set(gb.x, gb.y);
            }
            if (this.resizeHandles) {
                // Отключаем старые PIXI-ручки
                this.resizeHandles.hideHandles();
            }
            return;
        }
        if (this._resizeCtrl) this._resizeCtrl.end();
        
        // Обновляем позицию ручек после resize
        // HTML-ручки обновляются слоем HtmlHandlesLayer
        
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.resizeStartMousePos = null;
        this.resizeStartPosition = null;
    }
    
    /**
     * Начало поворота
     */
    startRotate(objectId) {
        // Групповой поворот
        if (objectId === this.groupId && this.selection.size() > 1) {
            this.isGroupRotating = true;
            const gb = this.computeGroupBounds();
            this.groupRotateBounds = gb;
            this.rotateCenter = { x: gb.x + gb.width / 2, y: gb.y + gb.height / 2 };
            this.rotateStartAngle = 0;
            this.rotateCurrentAngle = 0;
            this.rotateStartMouseAngle = Math.atan2(
                this.currentY - this.rotateCenter.y,
                this.currentX - this.rotateCenter.x
            );
            // Настраиваем целевой прямоугольник для ручек: центр в pivot для корректного вращения
            this.ensureGroupBoundsGraphics(gb);
            if (this.groupBoundsGraphics) {
                this.groupBoundsGraphics.pivot.set(gb.width / 2, gb.height / 2);
                this.groupBoundsGraphics.position.set(this.rotateCenter.x, this.rotateCenter.y);
                this.groupBoundsGraphics.rotation = 0;
            }
            // Подгоняем визуальную рамку под центр
            if (this.groupSelectionGraphics) {
                this.groupSelectionGraphics.pivot.set(0, 0);
                this.groupSelectionGraphics.position.set(0, 0);
                this.groupSelectionGraphics.clear();
                this.groupSelectionGraphics.lineStyle(1, 0x3B82F6, 1);
                // Нарисуем пока осевую рамку, вращение применим в update
                this.groupSelectionGraphics.drawRect(gb.x, gb.y, gb.width, gb.height);
            }
            const ids = this.selection.toArray();
            this.emit('group:rotate:start', { objects: ids, center: this.rotateCenter });
            return;
        }

        this.isRotating = true;
        this.dragTarget = objectId; // Используем dragTarget для совместимости
        const posData = { objectId, position: null };
        this.emit('get:object:position', posData);
        const sizeData = { objectId, size: null };
        this.emit('get:object:size', sizeData);
        if (posData.position && sizeData.size && this._rotateCtrl) {
            const center = { x: posData.position.x + sizeData.size.width / 2, y: posData.position.y + sizeData.size.height / 2 };
            const w = this._toWorld(this.currentX, this.currentY);
            this._rotateCtrl.start(objectId, { x: w.x, y: w.y }, center);
        }
    }
    
    /**
     * Обновление поворота
     */
    updateRotate(event) {
        // Групповой поворот
        if (this.isGroupRotating && this._groupRotateCtrl) {
            const w = this._toWorld(event.x, event.y);
            this._groupRotateCtrl.update({ ...event, x: w.x, y: w.y });
            return;
        }
        if (!this.isRotating || !this._rotateCtrl) return;
        {
            const w = this._toWorld(event.x, event.y);
            this._rotateCtrl.update({ ...event, x: w.x, y: w.y });
        }
        
        // Обновляем ручки в реальном времени во время поворота
        // HTML-ручки обновляются слоем HtmlHandlesLayer
    }
    
    /**
     * Завершение поворота
     */
    endRotate() {
        if (this.isGroupRotating) {
            if (this._groupRotateCtrl) this._groupRotateCtrl.end();
            this.isGroupRotating = false;
            // Восстановление рамки
            const gb = this.computeGroupBounds();
            this.ensureGroupBoundsGraphics(gb);
            if (this.groupBoundsGraphics) {
                this.groupBoundsGraphics.rotation = 0;
                this.groupBoundsGraphics.pivot.set(0, 0);
                this.groupBoundsGraphics.position.set(gb.x, gb.y);
            }
            if (this.resizeHandles) this.resizeHandles.hideHandles();
            return;
        }
        if (this._rotateCtrl) this._rotateCtrl.end();
        
        // Обновляем позицию ручек после поворота
        if (this.resizeHandles) {
            this.resizeHandles.updateHandles(); // Обновляем позицию ручек
        }
        
        this.isRotating = false;
        this.rotateCenter = null;
        this.rotateStartAngle = 0;
        this.rotateCurrentAngle = 0;
        this.rotateStartMouseAngle = 0;
    }
    
    /**
     * Начало рамки выделения
     */
    startBoxSelect(event) {
        this.isBoxSelect = true;
        if (this._boxSelect) this._boxSelect.start({ x: event.x, y: event.y }, this.isMultiSelect);
    }
    
    /**
     * Обновление рамки выделения
     */
    updateBoxSelect(event) {
        if (this._boxSelect) this._boxSelect.update({ x: event.x, y: event.y });
    }
    
    /**
     * Завершение рамки выделения
     */
    endBoxSelect() {
        this.isBoxSelect = false;
        if (this._boxSelect) this._boxSelect.end();
    }

	/**
	 * Пересечение прямоугольников
	 */
	rectIntersectsRect(a, b) {
		return !(
			b.x > a.x + a.width ||
			b.x + b.width < a.x ||
			b.y > a.y + a.height ||
			b.y + b.height < a.y
		);
	}

    /**
     * Установить выделение списком ID за один раз (батч)
     */
    setSelection(objectIds) {
        const prev = this.selection.toArray();
        this.selection.clear();
        this.selection.addMany(objectIds);
        // Эмитим события для совместимости
        if (prev.length > 0) {
            this.emit(Events.Tool.SelectionClear, { objects: prev });
        }
        for (const id of objectIds) {
            this.emit(Events.Tool.SelectionAdd, { object: id });
        }
        this.updateResizeHandles();
    }

    /**
     * Рисует рамки вокруг всех выбранных объектов (для множественного выделения)
     */
    drawGroupSelectionGraphics() {
        if (!this.app || !this.app.stage) return;
        const selectedIds = this.selection.toArray();
        if (selectedIds.length <= 1) {
            this.removeGroupSelectionGraphics();
            return;
        }
        // Получаем bounds всех объектов и отрисовываем контур на groupBoundsGraphics (одна рамка с ручками)
        const request = { objects: [] };
        this.emit(Events.Tool.GetAllObjects, request);
        const idToBounds = new Map(request.objects.map(o => [o.id, o.bounds]));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const id of selectedIds) {
            const b = idToBounds.get(id);
            if (!b) continue;
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
            const gb = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            this.ensureGroupBoundsGraphics(gb);
            this.updateGroupBoundsGraphics(gb);
        }
    }

    /**
     * Удаляет графику множественного выделения
     */
    removeGroupSelectionGraphics() {
        if (this.groupBoundsGraphics) {
            this.groupBoundsGraphics.clear();
            this.groupBoundsGraphics.rotation = 0;
        }
    }

    /**
     * Вычисляет общие границы текущего множественного выделения
     */
    computeGroupBounds() {
        const request = { objects: [] };
        this.emit(Events.Tool.GetAllObjects, request);
        const pixiMap = new Map(request.objects.map(o => [o.id, o.pixi]));
        const b = this.selection.computeBounds((id) => pixiMap.get(id));
        if (!b) return { x: 0, y: 0, width: 0, height: 0 };
        return b;
    }

    ensureGroupBoundsGraphics(bounds) {
        if (!this.app || !this.app.stage) return;
        if (!this.groupBoundsGraphics) {
            this.groupBoundsGraphics = new PIXI.Graphics();
            this.groupBoundsGraphics.name = 'group-bounds';
            this.groupBoundsGraphics.zIndex = 1400;
            this.app.stage.addChild(this.groupBoundsGraphics);
            this.app.stage.sortableChildren = true;
        }
        this.updateGroupBoundsGraphics(bounds);
    }

    updateGroupBoundsGraphics(bounds) {
        if (!this.groupBoundsGraphics) return;
        this.groupBoundsGraphics.clear();
        // Прозрачная заливка (alpha ~0), чтобы getBounds() давал корректные размеры и не было артефактов
        this.groupBoundsGraphics.beginFill(0x000000, 0.001);
        this.groupBoundsGraphics.drawRect(0, 0, Math.max(1, bounds.width), Math.max(1, bounds.height));
        this.groupBoundsGraphics.endFill();
        // Размещаем графику в левом-верхнем углу группы
        this.groupBoundsGraphics.position.set(bounds.x, bounds.y);
        // Обновляем ручки, если показаны
        // HTML-ручки обновляются слоем HtmlHandlesLayer
    }

    updateGroupBoundsGraphicsByTopLeft(topLeft) {
        if (!this.groupBoundsGraphics || !this.groupStartBounds) return;
        this.updateGroupBoundsGraphics({ x: topLeft.x, y: topLeft.y, width: this.groupStartBounds.width, height: this.groupStartBounds.height });
        // Рисуем визуальную общую рамку одновременно
        if (this.groupSelectionGraphics) {
            this.groupSelectionGraphics.clear();
            this.groupSelectionGraphics.lineStyle(1, 0x3B82F6, 0.9);
            this.groupSelectionGraphics.drawRect(topLeft.x, topLeft.y, this.groupStartBounds.width, this.groupStartBounds.height);
        }
    }

    // Преобразование экранных координат (canvas/view) в мировые (worldLayer)
    _toWorld(x, y) {
        if (!this.app || !this.app.stage) return { x, y };
        const world = this.app.stage.getChildByName && this.app.stage.getChildByName('worldLayer');
        if (!world || !world.toLocal) return { x, y };
        const p = new PIXI.Point(x, y);
        const local = world.toLocal(p);
        return { x: local.x, y: local.y };
    }

    startGroupDrag(event) {
        const gb = this.computeGroupBounds();
        this.groupStartBounds = gb;
        this.isGroupDragging = true;
        this.isDragging = false; // отключаем одиночный drag, если был
        this.ensureGroupBoundsGraphics(gb);
        if (this.groupBoundsGraphics && this.resizeHandles) {
            this.resizeHandles.hideHandles();
        }
        if (this._groupDragCtrl) {
            const w = this._toWorld(event.x, event.y);
            this._groupDragCtrl.start(gb, { x: w.x, y: w.y });
        }
        this.emit(Events.Tool.GroupDragStart, { objects: this.selection.toArray() });
    }

    /**
     * Переключение на клон группы после готовности
     */
    onGroupDuplicateReady(idMap) {
        this.groupClonePending = false;
        this.groupCloneMap = idMap;
        if (this._groupDragCtrl) this._groupDragCtrl.onGroupDuplicateReady(idMap);
        // Формируем новое выделение из клонов
        const newIds = [];
        for (const orig of this.groupCloneOriginalIds) {
            const nid = idMap[orig];
            if (nid) newIds.push(nid);
        }
        if (newIds.length > 0) {
            this.setSelection(newIds);
            // Пересчитываем стартовые параметры для продолжения drag
            const gb = this.computeGroupBounds();
            this.groupStartBounds = gb;
            this.groupDragOffset = { x: this.currentX - gb.x, y: this.currentY - gb.y };
            // Сообщаем ядру о старте drag для новых объектов, чтобы зафиксировать начальные позиции
            this.emit('group:drag:start', { objects: newIds });
        }
    }
    
    /**
     * Обновление курсора
     */
    updateCursor(event) {
        // Проверяем, что инструмент не уничтожен
        if (this.destroyed) {
            return;
        }
        
        const hitResult = this.hitTest(event.x, event.y);
        
        switch (hitResult.type) {
            case 'resize-handle':
                this.cursor = this.getResizeCursor(hitResult.handle);
                break;
            case 'rotate-handle':
                this.cursor = 'grab';
                break;
            case 'object':
                this.cursor = 'move';
                break;
            default:
                this.cursor = DEFAULT_CURSOR;
        }
        
        this.setCursor();
    }
    
    /**
     * Создает кастомный курсор изменения размера, повернутый на нужный угол
     */
    createRotatedResizeCursor(handleType, rotationDegrees) {
        // Базовые углы для каждого типа ручки (в градусах)
        const baseAngles = {
            'e': 0,     // Восток - горизонтальная стрелка →
            'se': 45,   // Юго-восток - диагональная стрелка ↘
            's': 90,    // Юг - вертикальная стрелка ↓
            'sw': 135,  // Юго-запад - диагональная стрелка ↙
            'w': 180,   // Запад - горизонтальная стрелка ←
            'nw': 225,  // Северо-запад - диагональная стрелка ↖
            'n': 270,   // Север - вертикальная стрелка ↑
            'ne': 315   // Северо-восток - диагональная стрелка ↗
        };
        
        // Вычисляем итоговый угол: базовый угол ручки + поворот объекта
        const totalAngle = (baseAngles[handleType] + rotationDegrees) % 360;
        
        // Создаем SVG курсор изменения размера, повернутый на нужный угол (белый, крупнее)
        const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(${totalAngle} 16 16)"><path d="M4 16 L9 11 L9 13 L23 13 L23 11 L28 16 L23 21 L23 19 L9 19 L9 21 Z" fill="white" stroke="black" stroke-width="1"/></g></svg>`;
        
        // Используем encodeURIComponent вместо btoa для безопасного кодирования
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        
        // Возвращаем CSS cursor с кастомным изображением (hotspot в центре 16x16)
        return `url("${dataUrl}") 16 16, auto`;
    }

    /**
     * Получение курсора для ресайз-хендла с учетом точного поворота объекта
     */
    getResizeCursor(handle) {
        // Получаем ID выбранного объекта для определения его поворота
        const selectedObject = Array.from(this.selectedObjects)[0];
        if (!selectedObject) {
            return DEFAULT_CURSOR;
        }
        
        // Получаем угол поворота объекта
        const rotationData = { objectId: selectedObject, rotation: 0 };
        this.emit(Events.Tool.GetObjectRotation, rotationData);
        const objectRotation = rotationData.rotation || 0;
        
        // Создаем кастомный курсор, повернутый на точный угол объекта
        return this.createRotatedResizeCursor(handle, objectRotation);
    }
    
    /**
     * Переопределяем setCursor для установки курсора на canvas
     */
    setCursor() {
        if (this.resizeHandles && this.resizeHandles.app && this.resizeHandles.app.view) {
            // Устанавливаем курсор на canvas, а не на body
            this.resizeHandles.app.view.style.cursor = this.cursor;
        } else {
            // Fallback на базовую реализацию
            super.setCursor();
        }
    }

    /**
     * Управление выделением
     */
    
        addToSelection(object) {
        this.selection.add(object);
        this.emit(Events.Tool.SelectionAdd, { object });
        this.updateResizeHandles();
    }

    removeFromSelection(object) {
        this.selection.remove(object);
        this.emit(Events.Tool.SelectionRemove, { object });
        this.updateResizeHandles();
    }

    clearSelection() {
        // Проверяем, что инструмент не уничтожен
        if (this.destroyed) {
            return;
        }
        
        const objects = this.selection.toArray();
        this.selection.clear();
        this.emit(Events.Tool.SelectionClear, { objects });
        this.updateResizeHandles();
    }
    
    selectAll() {
        // TODO: Выделить все объекты на доске
        this.emit(Events.Tool.SelectionAll);
    }
    
    deleteSelectedObjects() {
        const objects = this.selection.toArray();
        this.clearSelection();
        this.emit(Events.Tool.ObjectsDelete, { objects });
    }
    
    editObject(object) {
        this.emit(Events.Tool.ObjectEdit, { object });
    }
    
    /**
     * Получение информации о выделении
     */
    getSelection() {
        return this.selection.toArray();
    }

    // Совместимость с существующим кодом ядра: возвращаем Set выбранных id
    get selectedObjects() {
        return new Set(this.selection.toArray());
    }

    // Экспонируем выделение через EventBus для внешних слушателей (keyboard)
    onActivate() {
        // Подписка безопасна: EventBus простая шина, а вызов синхронный
        this.eventBus.on(Events.Tool.GetSelection, (data) => {
            data.selection = this.getSelection();
        });
    }
    
    hasSelection() {
        return this.selection.size() > 0;
    }
    
    /**
     * Обновление ручек изменения размера
     */
    updateResizeHandles() {
        // Проверяем, что инструмент не уничтожен
        if (this.destroyed) {
            return;
        }
        
        // Используем HTML-ручки (HtmlHandlesLayer). Прячем Pixi-ручки и групповые графики.
        try {
            if (this.resizeHandles && typeof this.resizeHandles.hideHandles === 'function') {
                this.resizeHandles.hideHandles();
            }
            const stage = this.app?.stage;
            const world = stage?.getChildByName && stage.getChildByName('worldLayer');
            const rh = world && world.getChildByName && world.getChildByName('resize-handles');
            if (rh) rh.visible = false;
            const gb = stage && stage.getChildByName && stage.getChildByName('group-bounds');
            if (gb) gb.visible = false;
        } catch (e) {
            // noop
        }
    }

    /**
     * Подготовка перетаскивания с созданием копии при зажатом Alt
     */
    prepareAltCloneDrag(objectId, event) {
        // Очищаем текущее выделение и выделяем исходный объект
        this.clearSelection();
        this.addToSelection(objectId);

        // Включаем режим Alt-клона и запрашиваем дубликат у ядра
        this.isAltCloneMode = true;
        this.clonePending = true;
        this.cloneSourceId = objectId;

        // Сохраняем текущее положение курсора
        this.currentX = event.x;
        this.currentY = event.y;

        // Запрашиваем текущую позицию исходного объекта
        const positionData = { objectId, position: null };
        this.emit('get:object:position', positionData);

        // Сообщаем ядру о необходимости создать дубликат у позиции исходного объекта
        this.emit('duplicate:request', {
            originalId: objectId,
            position: positionData.position || { x: event.x, y: event.y }
        });

        // Помечаем, что находимся в состоянии drag, но цели пока нет — ждём newId
        this.isDragging = true;
        this.dragTarget = null;
    }

    /**
     * Когда ядро сообщило о создании дубликата — переключаем drag на новый объект
     */
    onDuplicateReady(newObjectId) {
        this.clonePending = false;
        
        // Переключаем выделение на новый объект
        this.clearSelection();
        this.addToSelection(newObjectId);

        // Устанавливаем цель перетаскивания — новый объект
        this.dragTarget = newObjectId;

		// ВАЖНО: не пересчитываем dragOffset — сохраняем исходное смещение курсора
		// Это гарантирует, что курсор останется в той же точке относительно объекта

		// Сообщаем о старте перетаскивания для истории (Undo/Redo)
		this.emit('drag:start', { object: newObjectId, position: { x: this.currentX, y: this.currentY } });

		// Мгновенно обновляем позицию под курсор
		this.updateDrag({ x: this.currentX, y: this.currentY });

        // Обновляем ручки
        this.updateResizeHandles();
    }
    
    /**
     * Преобразует тип ручки с учетом поворота объекта
     */
    transformHandleType(handleType, rotationDegrees) {
        // Нормализуем угол поворота к диапазону 0-360
        let angle = rotationDegrees % 360;
        if (angle < 0) angle += 360;
        
        // Определяем количество поворотов на 90 градусов
        const rotations = Math.round(angle / 90) % 4;
        
        if (rotations === 0) return handleType; // Нет поворота
        
        // Карта преобразований для каждого поворота на 90°
        const transformMap = {
            'nw': ['ne', 'se', 'sw', 'nw'],  // nw -> ne -> se -> sw -> nw
            'n':  ['e',  's',  'w',  'n'],   // n -> e -> s -> w -> n
            'ne': ['se', 'sw', 'nw', 'ne'],  // ne -> se -> sw -> nw -> ne
            'e':  ['s',  'w',  'n',  'e'],   // e -> s -> w -> n -> e
            'se': ['sw', 'nw', 'ne', 'se'],  // se -> sw -> nw -> ne -> se
            's':  ['w',  'n',  'e',  's'],   // s -> w -> n -> e -> s
            'sw': ['nw', 'ne', 'se', 'sw'],  // sw -> nw -> ne -> se -> sw
            'w':  ['n',  'e',  's',  'w']    // w -> n -> e -> s -> w
        };
        
        return transformMap[handleType] ? transformMap[handleType][rotations - 1] : handleType;
    }

    /**
     * Вычисляет новые размеры объекта на основе типа ручки и смещения мыши
     */
    calculateNewSize(handleType, startBounds, deltaX, deltaY, maintainAspectRatio) {
        let newWidth = startBounds.width;
        let newHeight = startBounds.height;
        
        // Получаем угол поворота объекта
        const rotationData = { objectId: this.dragTarget, rotation: 0 };
        this.emit('get:object:rotation', rotationData);
        const objectRotation = rotationData.rotation || 0;
        
        // Преобразуем тип ручки с учетом поворота объекта
        const transformedHandleType = this.transformHandleType(handleType, objectRotation);
        
        // Вычисляем изменения в зависимости от преобразованного типа ручки
        switch (transformedHandleType) {
            case 'nw': // Северо-запад - левый верхний угол
                newWidth = startBounds.width - deltaX;  // влево = меньше ширина
                newHeight = startBounds.height - deltaY; // вверх = меньше высота
                break;
            case 'n': // Север - верхняя сторона
                newHeight = startBounds.height - deltaY; // вверх = меньше высота
                break;
            case 'ne': // Северо-восток - правый верхний угол
                newWidth = startBounds.width + deltaX;   // вправо = больше ширина
                newHeight = startBounds.height - deltaY; // вверх = меньше высота
                break;
            case 'e': // Восток - правая сторона
                newWidth = startBounds.width + deltaX;   // вправо = больше ширина
                break;
            case 'se': // Юго-восток - правый нижний угол
                newWidth = startBounds.width + deltaX;   // вправо = больше ширина
                newHeight = startBounds.height + deltaY; // вниз = больше высота
                break;
            case 's': // Юг - нижняя сторона
                newHeight = startBounds.height + deltaY; // вниз = больше высота
                break;
            case 'sw': // Юго-запад - левый нижний угол
                newWidth = startBounds.width - deltaX;   // влево = меньше ширина
                newHeight = startBounds.height + deltaY; // вниз = больше высота
                break;
            case 'w': // Запад - левая сторона
                newWidth = startBounds.width - deltaX;   // влево = меньше ширина
                break;
        }
        

        
        // Поддержка пропорционального изменения размера (Shift)
        if (maintainAspectRatio) {
            const aspectRatio = startBounds.width / startBounds.height;
            
            // Определяем, какую сторону использовать как основную
            if (['nw', 'ne', 'sw', 'se'].includes(handleType)) {
                // Угловые ручки - используем большее изменение
                const widthChange = Math.abs(newWidth - startBounds.width);
                const heightChange = Math.abs(newHeight - startBounds.height);
                
                if (widthChange > heightChange) {
                    newHeight = newWidth / aspectRatio;
                } else {
                    newWidth = newHeight * aspectRatio;
                }
            } else if (['e', 'w'].includes(handleType)) {
                // Горизонтальные ручки
                newHeight = newWidth / aspectRatio;
            } else if (['n', 's'].includes(handleType)) {
                // Вертикальные ручки
                newWidth = newHeight * aspectRatio;
            }
        }
        
        return {
            width: Math.round(newWidth),
            height: Math.round(newHeight)
        };
    }
    
    /**
     * Вычисляет смещение позиции при изменении размера через левые/верхние ручки
     */
    calculatePositionOffset(handleType, startBounds, newSize, objectRotation = 0) {
        // Позиция в состоянии — левый верх. Для правых/нижних ручек топ-лев остается на месте.
        // Для левых/верхних ручек топ-лев должен смещаться на полную величину изменения размера.
        // deltaWidth/deltaHeight = изменение размера (может быть отрицательным при уменьшении)
        
        const deltaWidth = newSize.width - startBounds.width;
        const deltaHeight = newSize.height - startBounds.height;

        let offsetX = 0;
        let offsetY = 0;

        switch (handleType) {
            case 'nw':
                offsetX = -deltaWidth; // левый край смещается на полную величину изменения ширины
                offsetY = -deltaHeight; // верхний край смещается на полную величину изменения высоты
                break;
            case 'n':
                offsetY = -deltaHeight; // только верхний край смещается
                break;
            case 'ne':
                offsetY = -deltaHeight; // верх смещается, правый край — нет
                break;
            case 'e':
                // правый край — левый верх не смещается
                break;
            case 'se':
                // правый нижний — левый верх не смещается
                break;
            case 's':
                // нижний — левый верх не смещается
                break;
            case 'sw':
                offsetX = -deltaWidth; // левый край смещается, низ — нет
                break;
            case 'w':
                offsetX = -deltaWidth; // левый край смещается на полную величину
                break;
        }

        // Для поворота корректное смещение требует преобразования в локальные координаты объекта
        // и обратно. В данной итерации оставляем смещение в мировых осях для устойчивости без вращения.
        return { x: offsetX, y: offsetY };
    }

    _openTextEditor(object, create = false) {

        
        // Проверяем структуру объекта и извлекаем данные
        let objectId, objectType, position, properties;
        
        if (create) {
            // Для создания нового объекта - данные в object.object
            const objData = object.object || object;
            objectId = objData.id || null;
            objectType = objData.type || 'text';
            position = objData.position;
            properties = objData.properties || {};
        } else {
            // Для редактирования существующего объекта - данные в корне
            objectId = object.id;
            objectType = object.type || 'text';
            position = object.position;
            properties = object.properties || {};
        }

        
        let { fontSize = 32, content = '', initialSize } = properties;
        
        // Определяем тип объекта
        const isNote = objectType === 'note';
        
        // Проверяем, что position существует
        if (!position) {
            console.error('❌ SelectTool: position is undefined in _openTextEditor', { object, create });
            return;
        }
        
        // Закрываем предыдущий редактор, если он открыт
        if (this.textEditor.active) this._closeTextEditor(true);
        
        // Если это редактирование существующего объекта, получаем его данные
        if (!create && objectId) {
            const posData = { objectId, position: null };
            const sizeData = { objectId, size: null };
            const pixiReq = { objectId, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
            this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
            this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
            
            // Обновляем данные из полученной информации
            if (posData.position) position = posData.position;
            if (sizeData.size) initialSize = sizeData.size;
            
            const meta = pixiReq.pixiObject && pixiReq.pixiObject._mb ? pixiReq.pixiObject._mb.properties || {} : {};
            if (meta.content) properties.content = meta.content;
            if (meta.fontSize) properties.fontSize = meta.fontSize;
        }
        
        // Уведомляем о начале редактирования (для разных типов отдельно)
        if (objectType === 'note') {
            this.eventBus.emit(Events.UI.NoteEditStart, { objectId: objectId || null });
        } else {
            this.eventBus.emit(Events.UI.TextEditStart, { objectId: objectId || null });
        }
        // Прячем глобальные HTML-ручки на время редактирования, чтобы не было второй рамки
        try {
            if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
                window.moodboardHtmlHandlesLayer.hide();
            }
        } catch (_) {}
        
        const app = this.app;
        const world = app?.stage?.getChildByName && app.stage.getChildByName('worldLayer');
        this.textEditor.world = world || null;
        const view = app?.view;
        if (!view) return;
        // Рассчитываем эффективный размер шрифта ДО вставки textarea в DOM, чтобы избежать скачка размера
        const worldLayerEarly = world || (this.app?.stage);
        const sEarly = worldLayerEarly?.scale?.x || 1;
        const viewResEarly = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
        const sCssEarly = sEarly / viewResEarly;
        let effectiveFontPx = Math.max(1, Math.round((fontSize || 14) * sCssEarly));
        // Точное выравнивание размеров:
        if (objectId) {
            if (objectType === 'note') {
                try {
                    const pixiReq = { objectId, pixiObject: null };
                    this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                    const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                    if (inst && inst.textField) {
                        const wt = inst.textField.worldTransform;
                        const scaleY = Math.max(0.0001, Math.hypot(wt.c || 0, wt.d || 0));
                        const baseFS = parseFloat(inst.textField.style?.fontSize || fontSize || 14) || (fontSize || 14);
                        effectiveFontPx = Math.max(1, Math.round(baseFS * (scaleY / viewResEarly)));
                    }
                } catch (_) {}
            } else if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el && typeof window.getComputedStyle === 'function') {
                    const cs = window.getComputedStyle(el);
                    const f = parseFloat(cs.fontSize);
                    if (isFinite(f) && f > 0) effectiveFontPx = Math.round(f);
                }
            }
        }
        // Используем только HTML-ручки во время редактирования текста
        // Обертка для рамки + textarea + ручек
        const wrapper = document.createElement('div');
        wrapper.className = 'moodboard-text-editor';
        
        // Базовые стили вынесены в CSS (.moodboard-text-editor)
        
        const textarea = document.createElement('textarea');
        textarea.className = 'moodboard-text-input';
        textarea.value = content || '';
        textarea.placeholder = 'Напишите что-нибудь';
        
        // Адаптивный межстрочный интервал для ввода, синхронно с HtmlTextLayer
        const computeLineHeightPx = (fs) => {
            if (fs <= 12) return Math.round(fs * 1.40);
            if (fs <= 18) return Math.round(fs * 1.34);
            if (fs <= 36) return Math.round(fs * 1.26);
            if (fs <= 48) return Math.round(fs * 1.24);
            if (fs <= 72) return Math.round(fs * 1.22);
            if (fs <= 96) return Math.round(fs * 1.20);
            return Math.round(fs * 1.18);
        };
        // Вычисляем межстрочный интервал; подгоняем к реальным значениям HTML-отображения
        let lhInitial = computeLineHeightPx(effectiveFontPx);
        try {
            if (objectId) {
                if (objectType === 'note') {
                    const pixiReq = { objectId, pixiObject: null };
                    this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                    const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                    if (inst && inst.textField) {
                        const wt = inst.textField.worldTransform;
                        const scaleY = Math.max(0.0001, Math.hypot(wt.c || 0, wt.d || 0));
                        const baseLH = parseFloat(inst.textField.style?.lineHeight || (fontSize * 1.2)) || (fontSize * 1.2);
                        lhInitial = Math.max(1, Math.round(baseLH * (scaleY / viewResEarly)));
                    }
                } else if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                    const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                    if (el) {
                        const cs = window.getComputedStyle(el);
                        const lh = parseFloat(cs.lineHeight);
                        if (isFinite(lh) && lh > 0) lhInitial = Math.round(lh);
                    }
                }
            }
        } catch (_) {}
        
        // Базовые стили вынесены в CSS (.moodboard-text-input); здесь — только динамика
        // Подбираем актуальный font-family из объекта
        try {
            if (objectId) {
                if (objectType === 'note') {
                    // Для записки читаем из PIXI-инстанса NoteObject
                    const pixiReq = { objectId, pixiObject: null };
                    this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                    const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                    const ff = (inst && inst.textField && inst.textField.style && inst.textField.style.fontFamily)
                        || (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.properties && pixiReq.pixiObject._mb.properties.fontFamily)
                        || null;
                    if (ff) textarea.style.fontFamily = ff;
                } else if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                    // Для обычного текста читаем из HTML-элемента
                    const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                    if (el) {
                        const cs = window.getComputedStyle(el);
                        const ff = cs && cs.fontFamily ? cs.fontFamily : null;
                        if (ff) textarea.style.fontFamily = ff;
                    }
                }
            }
        } catch (_) {}
        textarea.style.fontSize = `${effectiveFontPx}px`;
        textarea.style.lineHeight = `${lhInitial}px`;
        const BASELINE_FIX_INIT = 0; // без внутренних отступов — высота = line-height
        const initialH = Math.max(1, lhInitial);
        textarea.style.minHeight = `${initialH}px`;
        textarea.style.height = `${initialH}px`;
        textarea.setAttribute('rows', '1');
        textarea.style.overflowY = 'hidden';
        textarea.style.whiteSpace = 'pre-wrap';
        textarea.style.wordBreak = 'break-word';
        textarea.style.letterSpacing = '0px';
        textarea.style.fontKerning = 'normal';
        
        wrapper.appendChild(textarea);
        // Убрана зелёная рамка вокруг поля ввода по требованию
        
        // В режиме input не показываем локальные ручки
        
        // Не создаём локальные синие ручки: используем HtmlHandlesLayer (зелёные)
        
        // Убираем ручки ресайза для всех типов объектов
        // let handles = [];
        // let placeHandles = () => {};
        
        // if (!isNote) {
        //     // Ручки ресайза (8 штук) только для обычного текста
        //     handles = ['nw','n','ne','e','se','s','sw','w'].map(dir => {
        //         const h = document.createElement('div');
        //         h.dataset.dir = dir;
        //         Object.assign(h.style, {
        //             position: 'absolute', width: '12px', height: '12px', background: '#007ACC',
        //             border: '1px solid #fff', boxSizing: 'border-box', zIndex: 10001,
        //         });
        //         return h;
        //     });
        //     
        //     placeHandles = () => {
        //         const w = wrapper.offsetWidth;
        //         const h = wrapper.offsetHeight;
        //         handles.forEach(hd => {
        //             const dir = hd.dataset.dir;
        //             // default reset
        //             hd.style.left = '0px';
        //             hd.style.top = '0px';
        //             hd.style.right = '';
        //             hd.style.bottom = '';
        //             switch (dir) {
        //                 case 'nw':
        //                     hd.style.left = `${-6}px`;
        //                     hd.style.top = `${-6}px`;
        //                             hd.style.cursor = 'nwse-resize';
        //                             break;
        //                         case 'n':
        //                             hd.style.left = `${Math.round(w / 2 - 6)}px`;
        //                             hd.style.top = `${-6}px`;
        //                             hd.style.cursor = 'n-resize';
        //                             break;
        //                         case 'ne':
        //                             hd.style.left = `${Math.max(-6, w - 6)}px`;
        //                             hd.style.top = `${-6}px`;
        //                             hd.style.cursor = 'nesw-resize';
        //                             break;
        //                         case 'e':
        //                             hd.style.left = `${Math.max(-6, w - 6)}px`;
        //                             hd.style.top = `${Math.round(h / 2 - 6)}px`;
        //                             hd.style.cursor = 'e-resize';
        //                             break;
        //                         case 'se':
        //                             hd.style.left = `${Math.max(-6, w - 6)}px`;
        //                             hd.style.top = `${Math.max(-6, h - 6)}px`;
        //                             hd.style.cursor = 'nwse-resize';
        //                             break;
        //                         case 's':
        //                             hd.style.left = `${Math.round(w / 2 - 6)}px`;
        //                             hd.style.top = `${Math.max(-6, h - 6)}px`;
        //                             hd.style.cursor = 's-resize';
        //                             break;
        //                         case 'sw':
        //                             hd.style.left = `${-6}px`;
        //                             hd.style.top = `${Math.max(-6, h - 6)}px`;
        //                             hd.style.cursor = 'nesw-resize';
        //                             break;
        //                         case 'w':
        //                             hd.style.left = `${-6}px`;
        //                             hd.style.top = `${Math.round(h / 2 - 6)}px`;
        //                             hd.style.cursor = 'w-resize';
        //                             break;
        //                     }
        //                 });
        //             }
        //         }
        
        // Добавляем в DOM
        wrapper.appendChild(textarea);
        view.parentElement.appendChild(wrapper);
        
        // Позиция обертки по миру → экран
        const toScreen = (wx, wy) => {
            const worldLayer = this.textEditor.world || (this.app?.stage);
            if (!worldLayer) return { x: wx, y: wy };
            const global = worldLayer.toGlobal(new PIXI.Point(wx, wy));
            const viewRes = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
            return { x: global.x / viewRes, y: global.y / viewRes };
        };
        const screenPos = toScreen(position.x, position.y);
        
        // Для записок позиционируем редактор внутри записки
        if (objectType === 'note') {
            // Получаем актуальные размеры записки
            let noteWidth = 160;
            let noteHeight = 100;
            
            if (initialSize) {
                noteWidth = initialSize.width;
                noteHeight = initialSize.height;
            } else if (objectId) {
                // Если размер не передан, пытаемся получить его из объекта
                const sizeData = { objectId, size: null };
                this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
                if (sizeData.size) {
                    noteWidth = sizeData.size.width;
                    noteHeight = sizeData.size.height;
                }
            }
            
            // Текст у записки центрирован по обеим осям; textarea тоже центрируем
            const horizontalPadding = 16; // немного больше, чем раньше
            // Преобразуем мировые размеры/отступы в CSS-пиксели с учётом текущего зума
            const viewResLocal = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
            const worldLayerRefForCss = this.textEditor.world || (this.app?.stage);
            const sForCss = worldLayerRefForCss?.scale?.x || 1;
            const sCssLocal = sForCss / viewResLocal;
            const editorWidthWorld = Math.min(360, Math.max(1, noteWidth - (horizontalPadding * 2)));
            const editorHeightWorld = Math.min(180, Math.max(1, noteHeight - (horizontalPadding * 2)));
            const editorWidthPx = Math.max(1, Math.round(editorWidthWorld * sCssLocal));
            const editorHeightPx = Math.max(1, Math.round(editorHeightWorld * sCssLocal));
            const textCenterXWorld = noteWidth / 2;
            const textCenterYWorld = noteHeight / 2;
            const editorLeftWorld = textCenterXWorld - (editorWidthWorld / 2);
            const editorTopWorld = textCenterYWorld - (editorHeightWorld / 2);
            wrapper.style.left = `${Math.round(screenPos.x + editorLeftWorld * sCssLocal)}px`;
            wrapper.style.top = `${Math.round(screenPos.y + editorTopWorld * sCssLocal)}px`;
            // Устанавливаем размеры редактора (центрируем по контенту) в CSS-пикселях
            textarea.style.width = `${editorWidthPx}px`;
            textarea.style.height = `${editorHeightPx}px`;
            wrapper.style.width = `${editorWidthPx}px`;
            wrapper.style.height = `${editorHeightPx}px`;

            // Для записок: авто-ресайз редактора под содержимое с сохранением центрирования
            textarea.style.textAlign = 'center';
            const maxEditorWidthPx = Math.max(1, Math.round((noteWidth - (horizontalPadding * 2)) * sCssLocal));
            const maxEditorHeightPx = Math.max(1, Math.round((noteHeight - (horizontalPadding * 2)) * sCssLocal));
            const MIN_NOTE_EDITOR_W = 20;
            const MIN_NOTE_EDITOR_H = Math.max(1, computeLineHeightPx(effectiveFontPx));

            const autoSizeNote = () => {
                // Сначала сбрасываем размеры, чтобы измерить естественные
                const prevW = textarea.style.width;
                const prevH = textarea.style.height;
                textarea.style.width = 'auto';
                textarea.style.height = 'auto';

                // Ширина по содержимому, но не шире границ записки (в CSS-пикселях)
                const naturalW = Math.ceil(textarea.scrollWidth + 1);
                const targetW = Math.min(maxEditorWidthPx, Math.max(MIN_NOTE_EDITOR_W, naturalW));
                textarea.style.width = `${targetW}px`;
                wrapper.style.width = `${targetW}px`;

                // Высота по содержимому, c нижним пределом = одна строка
                const computed = (typeof window !== 'undefined') ? window.getComputedStyle(textarea) : null;
                const lineH = (computed ? parseFloat(computed.lineHeight) : computeLineHeightPx(effectiveFontPx));
                const naturalH = Math.ceil(textarea.scrollHeight);
                const targetH = Math.min(maxEditorHeightPx, Math.max(MIN_NOTE_EDITOR_H, naturalH));
                textarea.style.height = `${targetH}px`;
                wrapper.style.height = `${targetH}px`;

                // Центрируем wrapper внутри записки после смены размеров (в CSS-пикселях)
                const left = Math.round(screenPos.x + (noteWidth * sCssLocal) / 2 - (targetW / 2));
                const top = Math.round(screenPos.y + (noteHeight * sCssLocal) / 2 - (targetH / 2));
                wrapper.style.left = `${left}px`;
                wrapper.style.top = `${top}px`;
            };
            // Первый вызов — синхронизировать с текущим содержимым
            autoSizeNote();

            // Динамическое обновление позиции/размера редактора при зуме/панорамировании/трансформациях
            const updateNoteEditor = () => {
                try {
                    // Актуальная позиция и размер объекта в мире
                    const posDataNow = { objectId, position: null };
                    const sizeDataNow = { objectId, size: null };
                    this.eventBus.emit(Events.Tool.GetObjectPosition, posDataNow);
                    this.eventBus.emit(Events.Tool.GetObjectSize, sizeDataNow);
                    const posNow = posDataNow.position || position;
                    const sizeNow = sizeDataNow.size || { width: noteWidth, height: noteHeight };
                    const screenNow = toScreen(posNow.x, posNow.y);
                    // Пересчитываем масштаб в CSS пикселях
                    const vr = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
                    const wl = this.textEditor.world || (this.app?.stage);
                    const sc = wl?.scale?.x || 1;
                    const sCss = sc / vr;
                    const maxWpx = Math.max(1, Math.round((sizeNow.width - (horizontalPadding * 2)) * sCss));
                    const maxHpx = Math.max(1, Math.round((sizeNow.height - (horizontalPadding * 2)) * sCss));
                    // Измеряем естественный размер по контенту
                    const prevW = textarea.style.width;
                    const prevH = textarea.style.height;
                    textarea.style.width = 'auto';
                    textarea.style.height = 'auto';
                    const naturalW = Math.ceil(textarea.scrollWidth + 1);
                    const naturalH = Math.ceil(textarea.scrollHeight);
                    const wPx = Math.min(maxWpx, Math.max(MIN_NOTE_EDITOR_W, naturalW));
                    const hPx = Math.min(maxHpx, Math.max(MIN_NOTE_EDITOR_H, naturalH));
                    // Применяем размеры редактора
                    textarea.style.width = `${wPx}px`;
                    wrapper.style.width = `${wPx}px`;
                    textarea.style.height = `${hPx}px`;
                    wrapper.style.height = `${hPx}px`;
                    // Центрируем в пределах записки
                    const left = Math.round(screenNow.x + (sizeNow.width * sCss) / 2 - (wPx / 2));
                    const top = Math.round(screenNow.y + (sizeNow.height * sCss) / 2 - (hPx / 2));
                    wrapper.style.left = `${left}px`;
                    wrapper.style.top = `${top}px`;
                    // Восстанавливаем прошлые значения, чтобы избежать мигания в стилях при следующем измерении
                    textarea.style.width = `${wPx}px`;
                    textarea.style.height = `${hPx}px`;
                } catch (_) {}
            };
            const onZoom = () => updateNoteEditor();
            const onPan = () => updateNoteEditor();
            const onDrag = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
            const onResize = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
            const onRotate = (e) => { if (e && e.object === objectId) updateNoteEditor(); };
            this.eventBus.on(Events.UI.ZoomPercent, onZoom);
            this.eventBus.on(Events.Tool.PanUpdate, onPan);
            this.eventBus.on(Events.Tool.DragUpdate, onDrag);
            this.eventBus.on(Events.Tool.ResizeUpdate, onResize);
            this.eventBus.on(Events.Tool.RotateUpdate, onRotate);
            // Сохраняем слушателей для снятия при закрытии редактора
            this.textEditor._listeners = [
                [Events.UI.ZoomPercent, onZoom],
                [Events.Tool.PanUpdate, onPan],
                [Events.Tool.DragUpdate, onDrag],
                [Events.Tool.ResizeUpdate, onResize],
                [Events.Tool.RotateUpdate, onRotate],
            ];
        } else {
            // Для обычного текста используем стандартное позиционирование
            // Динамически компенсируем внутренние отступы textarea, чтобы каретка оказалась ровно в точке клика
            let padTop = 0;
            let padLeft = 0;
            let lineHeightPx = 0;
            try {
                if (typeof window !== 'undefined' && window.getComputedStyle) {
                    const cs = window.getComputedStyle(textarea);
                    const pt = parseFloat(cs.paddingTop);
                    const pl = parseFloat(cs.paddingLeft);
                    const lh = parseFloat(cs.lineHeight);
                    if (isFinite(pt)) padTop = pt;
                    if (isFinite(pl)) padLeft = pl;
                    if (isFinite(lh)) lineHeightPx = lh;
                }
            } catch (_) {}
            if (!isFinite(lineHeightPx) || lineHeightPx <= 0) {
                try {
                    const r = textarea.getBoundingClientRect && textarea.getBoundingClientRect();
                    if (r && isFinite(r.height)) lineHeightPx = r.height;
                } catch (_) {}
            }
            const leftPx = create ? Math.round(screenPos.x - padLeft) : Math.round(screenPos.x);
            const topPx = create ? Math.round(screenPos.y - padTop - (lineHeightPx / 2)) : Math.round(screenPos.y);
            wrapper.style.left = `${leftPx}px`;
            wrapper.style.top = `${topPx}px`;
            // Сохраняем CSS-позицию редактора для точной синхронизации при закрытии
            this.textEditor._cssLeftPx = leftPx;
            this.textEditor._cssTopPx = topPx;
            // Диагностика: логируем позицию инпута и вычисленные параметры позиционирования
            try {
                console.log('🧭 Text input', {
                    input: { left: leftPx, top: topPx },
                    screenPos,
                    padding: { top: padTop, left: padLeft },
                    lineHeightPx,
                    caretCenterY: create ? (topPx + padTop + (lineHeightPx / 2)) : topPx,
                    create
                });
            } catch (_) {}

            // Для новых текстов: синхронизируем мировую позицию объекта с фактической позицией wrapper,
            // чтобы после закрытия редактора статичный текст встал ровно туда же без сдвига
            try {
                if (create && objectId) {
                    const worldLayerRef = this.textEditor.world || (this.app?.stage);
                    const viewRes = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
                    // Статичный HTML-текст не имеет верхнего внутреннего отступа (HtmlTextLayer ставит padding: 0),
                    // поэтому добавляем padTop к topPx при расчёте мировых координат
                    const yCssStaticTop = Math.round(topPx + padTop);
                    const globalPoint = new PIXI.Point(Math.round(leftPx * viewRes), Math.round(yCssStaticTop * viewRes));
                    const worldPoint = worldLayerRef && worldLayerRef.toLocal ? worldLayerRef.toLocal(globalPoint) : { x: position.x, y: position.y };
                    const newWorldPos = { x: Math.round(worldPoint.x), y: Math.round(worldPoint.y) };
                    this.eventBus.emit(Events.Object.StateChanged, {
                        objectId: objectId,
                        updates: { position: newWorldPos }
                    });
                    // Диагностика
                    console.log('🧭 Text position sync', { objectId, newWorldPos, leftPx, topPx, yCssStaticTop, padTop, viewRes });
                }
            } catch (_) {}
        }
        // Минимальные границы (зависят от текущего режима: новый объект или редактирование существующего)
        const worldLayerRef = this.textEditor.world || (this.app?.stage);
        const s = worldLayerRef?.scale?.x || 1;
        const viewRes = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
        const sCss = s / viewRes;
        // Синхронизируем стартовый размер шрифта textarea с текущим зумом (как HtmlTextLayer)
        // Используем ранее вычисленный effectiveFontPx (до вставки в DOM), если он есть в замыкании
        textarea.style.fontSize = `${effectiveFontPx}px`;
        const initialWpx = initialSize ? Math.max(1, (initialSize.width || 0) * s / viewRes) : null;
        const initialHpx = initialSize ? Math.max(1, (initialSize.height || 0) * s / viewRes) : null;
        
        // Определяем минимальные границы для всех типов объектов
        let minWBound = initialWpx || 120; // базово близко к призраку
        let minHBound = effectiveFontPx; // базовая высота
        // Уменьшаем визуальный нижний запас, который браузеры добавляют к textarea
        const BASELINE_FIX = 2; // px
        if (!isNote) {
            minHBound = Math.max(1, effectiveFontPx - BASELINE_FIX);
        }

        // Если создаём новый текст — длина поля ровно как placeholder
        if (create && !isNote) {
            const measureTextWidth = (text) => {
                const sEl = document.createElement('span');
                sEl.style.position = 'absolute';
                sEl.style.visibility = 'hidden';
                sEl.style.whiteSpace = 'pre';
                sEl.style.fontFamily = textarea.style.fontFamily;
                sEl.style.fontSize = textarea.style.fontSize;
                sEl.textContent = 'Напишите что-нибудь';
                document.body.appendChild(sEl);
                const w = Math.ceil(sEl.getBoundingClientRect().width);
                sEl.remove();
                return w;
            };
            const startWidth = Math.max(1, measureTextWidth('Напишите что-нибудь'));
            const startHeight = Math.max(1, lhInitial - BASELINE_FIX + 10); // +5px сверху и +5px снизу
            textarea.style.width = `${startWidth}px`;
            textarea.style.height = `${startHeight}px`;
            wrapper.style.width = `${startWidth}px`;
            wrapper.style.height = `${startHeight}px`;
            // Зафиксируем минимальные границы, чтобы авторазмер не схлопывал пустое поле
            minWBound = startWidth;
            minHBound = startHeight;
        }
        
        // Для записок размеры уже установлены выше, пропускаем эту логику
        if (!isNote) {
            if (initialWpx) {
                textarea.style.width = `${initialWpx}px`;
                wrapper.style.width = `${initialWpx}px`;
            }
            if (initialHpx) {
                textarea.style.height = `${initialHpx}px`;
                wrapper.style.height = `${initialHpx}px`;
            }
        }
        // Автоподгон
        const MAX_AUTO_WIDTH = 360; // Поведение как в Miro: авто-ширина до порога, далее перенос строк
        const autoSize = () => {
            if (isNote) {
                // Для заметок используем фиксированные размеры, вычисленные выше
                return;
            }
            // Сначала измеряем естественную ширину без ограничений
            const prevWidth = textarea.style.width;
            const prevHeight = textarea.style.height;
            textarea.style.width = 'auto';
            textarea.style.height = 'auto';

            // Желаемая ширина: не уже минимальной и не шире максимальной авто-ширины
            const naturalW = textarea.scrollWidth + 1;
            const targetW = Math.min(MAX_AUTO_WIDTH, Math.max(minWBound, naturalW));
            textarea.style.width = `${targetW}px`;
            wrapper.style.width = `${targetW}px`;

            // Высота по содержимому при установленной ширине
            textarea.style.height = 'auto';
            // Коррекция высоты: для одной строки принудительно равна line-height,
            // для нескольких строк используем scrollHeight с небольшим вычетом браузерного запаса
            const adjust = BASELINE_FIX;
            const computed = (typeof window !== 'undefined') ? window.getComputedStyle(textarea) : null;
            const lineH = (computed ? parseFloat(computed.lineHeight) : computeLineHeightPx(effectiveFontPx)) + 10; // +5px сверху и +5px снизу
            const rawH = textarea.scrollHeight;
            const lines = lineH > 0 ? Math.max(1, Math.round(rawH / lineH)) : 1;
            const targetH = lines <= 1
                ? Math.max(minHBound, Math.max(1, lineH - BASELINE_FIX))
                : Math.max(minHBound, Math.max(1, rawH - adjust));
            textarea.style.height = `${targetH}px`;
            wrapper.style.height = `${targetH}px`;
            // Ручки скрыты в режиме input
        };
        
        // Вызываем autoSize только для обычного текста
        if (!isNote) {
            autoSize();
        }
        textarea.focus();
        // Ручки скрыты в режиме input
        // Локальная CSS-настройка placeholder (меньше базового шрифта)
        const uid = 'mbti-' + Math.random().toString(36).slice(2);
        textarea.classList.add(uid);
        const styleEl = document.createElement('style');
        const phSize = effectiveFontPx;
        const placeholderOpacity = isNote ? '0.4' : '0.6'; // Для записок делаем placeholder менее заметным
        styleEl.textContent = `.${uid}::placeholder{font-size:${phSize}px;opacity:${placeholderOpacity};line-height:${computeLineHeightPx(phSize)}px;white-space:nowrap;}`;
        document.head.appendChild(styleEl);
        this.textEditor = { active: true, objectId, textarea, wrapper, world: this.textEditor.world, position, properties: { fontSize }, objectType, _phStyle: styleEl };

        // Если редактируем записку — скрываем PIXI-текст записки (чтобы не было дублирования)
        if (objectType === 'note' && objectId) {
            try {
                const pixiReq = { objectId, pixiObject: null };
                this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                if (inst && typeof inst.hideText === 'function') {
                    inst.hideText();
                }
            } catch (_) {}
        }

        // Скрываем статичный текст во время редактирования для всех типов объектов
        if (objectId) {
            // Проверяем, что HTML-элемент существует перед попыткой скрыть текст
            if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el) {
                    this.eventBus.emit(Events.Tool.HideObjectText, { objectId });
                } else {
                    console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем HideObjectText`);
                }
            } else {
                this.eventBus.emit(Events.Tool.HideObjectText, { objectId });
            }
        }
        // Ресайз мышью только для обычного текста
        // Не используем локальные ручки: ресайз обрабатывает HtmlHandlesLayer
        // Завершение
        const isNewCreation = !!create;
        const finalize = (commit) => {
            const value = textarea.value.trim();
            const commitValue = commit && value.length > 0;
            
            // Сохраняем objectType ДО сброса this.textEditor
            const currentObjectType = this.textEditor.objectType;
            
            // Показываем статичный текст только если не отменяем создание нового пустого
            if (objectId && (commitValue || !isNewCreation)) {
                // Проверяем, что HTML-элемент существует перед попыткой показать текст
                if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                    const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                    if (el) {
                        this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                    } else {
                        console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
                    }
                } else {
                    this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                }
            }
            
            // Перед скрытием — если редактировался существующий текст, обновим его размер под текущий редактор
            if (objectId && (currentObjectType === 'text' || currentObjectType === 'simple-text')) {
                try {
                    const worldLayerRef = this.textEditor.world || (this.app?.stage);
                    const s = worldLayerRef?.scale?.x || 1;
                    const viewResLocal = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
                    const wPx = Math.max(1, wrapper.offsetWidth);
                    const hPx = Math.max(1, wrapper.offsetHeight);
                    const newW = Math.max(1, Math.round(wPx * viewResLocal / s));
                    const newH = Math.max(1, Math.round(hPx * viewResLocal / s));
                    // Получим старые размеры для команды
                    const sizeReq = { objectId, size: null };
                    this.eventBus.emit(Events.Tool.GetObjectSize, sizeReq);
                    const oldSize = sizeReq.size || { width: newW, height: newH };
                    // Позиция в state хранится как левый-верх
                    const posReq = { objectId, position: null };
                    this.eventBus.emit(Events.Tool.GetObjectPosition, posReq);
                    const oldPos = posReq.position || { x: position.x, y: position.y };
                    const newSize = { width: newW, height: newH };
                    // Во время ResizeUpdate ядро обновит и PIXI, и state
                    this.eventBus.emit(Events.Tool.ResizeUpdate, { object: objectId, size: newSize, position: oldPos });
                    // Зафиксируем изменение одной командой
                    this.eventBus.emit(Events.Tool.ResizeEnd, { object: objectId, oldSize: oldSize, newSize: newSize, oldPosition: oldPos, newPosition: oldPos });
                } catch (err) {
                    console.warn('⚠️ Не удалось применить размеры после редактирования текста:', err);
                }
            }

            // Убираем редактор
            // Снимем навешанные на время редактирования слушатели
            try {
                if (this.textEditor && Array.isArray(this.textEditor._listeners)) {
                    this.textEditor._listeners.forEach(([evt, fn]) => {
                        try { this.eventBus.off(evt, fn); } catch (_) {}
                    });
                }
            } catch (_) {}
            wrapper.remove();
            this.textEditor = { active: false, objectId: null, textarea: null, wrapper: null, world: null, position: null, properties: null, objectType: 'text' };
            if (currentObjectType === 'note') {
                this.eventBus.emit(Events.UI.NoteEditEnd, { objectId: objectId || null });
                // Вернём PIXI-текст записки
                try {
                    const pixiReq = { objectId, pixiObject: null };
                    this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
                    const inst = pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance;
                    if (inst && typeof inst.showText === 'function') {
                        inst.showText();
                    }
                } catch (_) {}
            } else {
                this.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
            }
            // Возвращаем глобальные HTML-ручки (обновляем слой)
            try {
                if (typeof window !== 'undefined' && window.moodboardHtmlHandlesLayer) {
                    window.moodboardHtmlHandlesLayer.update();
                }
            } catch (_) {}
            if (!commitValue) {
                // Если это было создание нового текста и оно отменено — удаляем пустой объект
                if (isNewCreation && objectId) {
                    this.eventBus.emit(Events.Tool.ObjectsDelete, { objects: [objectId] });
                }
                return;
            }
            if (objectId == null) {
                // Создаем объект с правильным типом
                const objectType = currentObjectType || 'text';
                // Конвертируем размеры редактора (px) в мировые единицы
                const worldLayerRef = this.textEditor.world || (this.app?.stage);
                const s = worldLayerRef?.scale?.x || 1;
                const wPx = Math.max(1, wrapper.offsetWidth);
                const hPx = Math.max(1, wrapper.offsetHeight);
                const wWorld = Math.max(1, Math.round(wPx * viewRes / s));
                const hWorld = Math.max(1, Math.round(hPx * viewRes / s));
                this.eventBus.emit(Events.UI.ToolbarAction, {
                    type: objectType,
                    id: objectType,
                    position: { x: position.x, y: position.y },
                    properties: { content: value, fontSize, width: wWorld, height: hWorld }
                });
            } else {
                // Обновление существующего: используем команду обновления содержимого
                if (currentObjectType === 'note') {
                    // Для записок обновляем содержимое через PixiEngine
                    this.eventBus.emit(Events.Tool.UpdateObjectContent, { 
                        objectId: objectId, 
                        content: value 
                    });
                    
                    // Обновляем состояние объекта в StateManager
                    this.eventBus.emit(Events.Object.StateChanged, {
                        objectId: objectId,
                        updates: {
                            content: value
                        }
                    });
                } else {
                    // Для обычного текста тоже используем обновление содержимого
                    this.eventBus.emit(Events.Tool.UpdateObjectContent, { 
                        objectId: objectId, 
                        content: value 
                    });
                    
                    // Обновляем состояние объекта в StateManager
                    this.eventBus.emit(Events.Object.StateChanged, {
                        objectId: objectId,
                        updates: {
                            content: value
                        }
                    });
                }
            }
        };
        textarea.addEventListener('blur', (e) => {
            const value = (textarea.value || '').trim();
            if (isNewCreation && value.length === 0) {
                // Клик вне поля при пустом значении — отменяем и удаляем созданный объект
                finalize(false);
                return;
            }
            finalize(true);
        });
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finalize(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finalize(false);
            }
        });
        // Автоподгон при вводе
        if (!isNote) {
            textarea.addEventListener('input', autoSize);
        } else {
            // Для заметок растягиваем редактор по содержимому и центрируем с учётом зума
            textarea.addEventListener('input', () => { try { updateNoteEditor(); } catch (_) {} });
        }
    }

    /**
     * Открывает редактор названия файла
     */
    _openFileNameEditor(object, create = false) {
        // Проверяем структуру объекта и извлекаем данные
        let objectId, position, properties;
        
        if (create) {
            // Для создания нового объекта - данные в object.object
            const objData = object.object || object;
            objectId = objData.id || null;
            position = objData.position;
            properties = objData.properties || {};
        } else {
            // Для редактирования существующего объекта - данные в корне
            objectId = object.id;
            position = object.position;
            properties = object.properties || {};
        }

        const fileName = properties.fileName || 'Untitled';
        
        // Проверяем, что position существует
        if (!position) {
            console.error('❌ SelectTool: position is undefined in _openFileNameEditor', { object, create });
            return;
        }
        
        // Закрываем предыдущий редактор, если он открыт
        if (this.textEditor.active) {
            if (this.textEditor.objectType === 'file') {
                this._closeFileNameEditor(true);
            } else {
                this._closeTextEditor(true);
            }
        }
        
        // Если это редактирование существующего объекта, получаем его данные
        if (!create && objectId) {
            const posData = { objectId, position: null };
            const pixiReq = { objectId, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
            this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
            
            // Обновляем данные из полученной информации
            if (posData.position) position = posData.position;
            
            const meta = pixiReq.pixiObject && pixiReq.pixiObject._mb ? pixiReq.pixiObject._mb.properties || {} : {};
            
            // Скрываем текст файла на время редактирования
            if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
                const fileInstance = pixiReq.pixiObject._mb.instance;
                if (typeof fileInstance.hideText === 'function') {
                    fileInstance.hideText();
                }
            }
        }
        
        // Создаем wrapper для input
        const wrapper = document.createElement('div');
        wrapper.className = 'moodboard-file-name-editor';
        wrapper.style.cssText = `
            position: absolute;
            z-index: 1000;
            background: white;
            border: 2px solid #2563eb;
            border-radius: 6px;
            padding: 6px 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 140px;
            max-width: 200px;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        `;
        
        // Создаем input для редактирования названия
        const input = document.createElement('input');
        input.type = 'text';
        input.value = fileName;
        input.style.cssText = `
            border: none;
            outline: none;
            background: transparent;
            font-family: inherit;
            font-size: 12px;
            text-align: center;
            width: 100%;
            padding: 2px 4px;
            color: #1f2937;
            font-weight: 500;
        `;
        
        wrapper.appendChild(input);
        document.body.appendChild(wrapper);
        
        // Позиционируем редактор (аналогично _openTextEditor)
        const toScreen = (wx, wy) => {
            const worldLayer = this.textEditor.world || (this.app?.stage);
            if (!worldLayer) return { x: wx, y: wy };
            const global = worldLayer.toGlobal(new PIXI.Point(wx, wy));
            const view = this.app?.view || document.querySelector('canvas');
            const viewRes = (this.app?.renderer?.resolution) || (view && view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
            return { x: global.x / viewRes, y: global.y / viewRes };
        };
        const screenPos = toScreen(position.x, position.y);
        
        // Получаем размеры файлового объекта для точного позиционирования
        let fileWidth = 120;
        let fileHeight = 140;
        
        if (objectId) {
            const sizeData = { objectId, size: null };
            this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
            if (sizeData.size) {
                fileWidth = sizeData.size.width;
                fileHeight = sizeData.size.height;
            }
        }
        
        // Позиционируем редактор в нижней части файла (где название)
        // В FileObject название находится в позиции y = height - 40
        const nameY = fileHeight - 40;
        const centerX = fileWidth / 2;
        
        wrapper.style.left = `${screenPos.x + centerX - 60}px`;  // Центрируем относительно файла
        wrapper.style.top = `${screenPos.y + nameY}px`;  // Позиционируем на уровне названия
        
        // Сохраняем состояние редактора
        this.textEditor = {
            active: true,
            objectId: objectId,
            textarea: input,
            wrapper: wrapper,
            position: position,
            properties: properties,
            objectType: 'file',
            isResizing: false
        };
        
        // Фокусируем и выделяем весь текст
        input.focus();
        input.select();
        
        // Функция завершения редактирования
        const finalize = (commit) => {
            this._closeFileNameEditor(commit);
        };
        
        // Обработчики событий
        input.addEventListener('blur', () => finalize(true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finalize(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finalize(false);
            }
        });
    }

    /**
     * Закрывает редактор названия файла
     */
    _closeFileNameEditor(commit) {
        
        // Проверяем, что редактор существует и не закрыт
        if (!this.textEditor || !this.textEditor.textarea || this.textEditor.closing) {
            return;
        }
        
        // Устанавливаем флаг закрытия, чтобы избежать повторных вызовов
        this.textEditor.closing = true;
        
        const input = this.textEditor.textarea;
        const value = input.value.trim();
        const commitValue = commit && value.length > 0;
        const objectId = this.textEditor.objectId;
        
        
        // Убираем wrapper из DOM
        if (this.textEditor.wrapper && this.textEditor.wrapper.parentNode) {
            this.textEditor.wrapper.remove();
        }
        
        // Показываем обратно текст файла
        if (objectId) {
            const pixiReq = { objectId, pixiObject: null };
            this.eventBus.emit(Events.Tool.GetObjectPixi, pixiReq);
            
            if (pixiReq.pixiObject && pixiReq.pixiObject._mb && pixiReq.pixiObject._mb.instance) {
                const fileInstance = pixiReq.pixiObject._mb.instance;
                if (typeof fileInstance.showText === 'function') {
                    fileInstance.showText();
                }
                
                // Применяем изменения если нужно
                if (commitValue && value !== this.textEditor.properties.fileName) {
                    
                    // Создаем команду изменения названия файла
                    const oldName = this.textEditor.properties.fileName || 'Untitled';
                    this.eventBus.emit(Events.Object.FileNameChange, {
                        objectId: objectId,
                        oldName: oldName,
                        newName: value
                    });
                }
            }
        }
        
        // Сбрасываем состояние редактора
        this.textEditor = {
            active: false,
            objectId: null,
            textarea: null,
            wrapper: null,
            world: null,
            position: null,
            properties: null,
            objectType: 'text',
            isResizing: false
        };
    }

    _closeTextEditor(commit) {
        const textarea = this.textEditor.textarea;
        if (!textarea) return;
        const value = textarea.value.trim();
        const commitValue = commit && value.length > 0;
        const objectType = this.textEditor.objectType || 'text';
        const objectId = this.textEditor.objectId;
        const position = this.textEditor.position;
        const properties = this.textEditor.properties;
        
        
        // Показываем статичный текст после завершения редактирования для всех типов объектов
        if (objectId) {
            // Проверяем, что HTML-элемент существует перед попыткой показать текст
            if (typeof window !== 'undefined' && window.moodboardHtmlTextLayer) {
                const el = window.moodboardHtmlTextLayer.idToEl.get(objectId);
                if (el) {
                    this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                    // После отображения статичного текста — выровняем его позицию ровно под textarea
                    try {
                        const view = this.app?.view;
                        const worldLayerRef = this.textEditor.world || (this.app?.stage);
                        const viewRes = (this.app?.renderer?.resolution) || (view && view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
                        const cssLeft = this.textEditor._cssLeftPx;
                        const cssTop = this.textEditor._cssTopPx;
                        if (isFinite(cssLeft) && isFinite(cssTop) && worldLayerRef) {
                            // Ждем один тик, чтобы HtmlTextLayer успел обновить DOM
                            setTimeout(() => {
                                try {
                                    const desiredGlobal = new PIXI.Point(Math.round(cssLeft * viewRes), Math.round(cssTop * viewRes));
                                    const desiredWorld = worldLayerRef.toLocal(desiredGlobal);
                                    const newPos = { x: Math.round(desiredWorld.x), y: Math.round(desiredWorld.y) };
                                    this.eventBus.emit(Events.Object.StateChanged, {
                                        objectId,
                                        updates: { position: newPos }
                                    });
                                    console.log('🧭 Text post-show align', { objectId, cssLeft, cssTop, newPos });
                                } catch (_) {}
                            }, 0);
                        }
                    } catch (_) {}
                } else {
                    console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
                }
            } else {
                this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
            }
        }
        
        textarea.remove();
        this.textEditor = { active: false, objectId: null, textarea: null, world: null, objectType: 'text' };
        if (!commitValue) return;
        if (objectId == null) {
            // Создаём новый объект через ToolbarAction
            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: objectType,
                id: objectType,
                position: { x: position.x, y: position.y },
                properties: { content: value, fontSize: properties.fontSize }
            });
        } else {
            // Обновление существующего: используем команду обновления содержимого
            if (objectType === 'note') {
                console.log('🔧 SelectTool: updating note content via UpdateObjectContent');
                // Для записок обновляем содержимое через PixiEngine
                this.eventBus.emit(Events.Tool.UpdateObjectContent, { 
                    objectId: objectId, 
                    content: value 
                });
                
                // Обновляем состояние объекта в StateManager
                this.eventBus.emit(Events.Object.StateChanged, {
                    objectId: objectId,
                    updates: {
                        content: value
                    }
                });
            } else {
                // Для обычного текста тоже используем обновление содержимого
                console.log('🔧 SelectTool: updating text content via UpdateObjectContent');
                this.eventBus.emit(Events.Tool.UpdateObjectContent, { 
                    objectId: objectId, 
                    content: value 
                });
                
                // Обновляем состояние объекта в StateManager
                this.eventBus.emit(Events.Object.StateChanged, {
                    objectId: objectId,
                    updates: {
                        content: value
                    }
                });
            }
        }
    }

    /**
     * Уничтожение инструмента
     */
    destroy() {
        if (this.destroyed) {
            return;
        }
        
        this.destroyed = true;
        
        // Очищаем выделение
        this.clearSelection();
        
        // Уничтожаем ручки изменения размера
        if (this.resizeHandles) {
            this.resizeHandles.destroy();
            this.resizeHandles = null;
        }
        
        // Очищаем контроллеры
        this.dragController = null;
        this.resizeController = null;
        this.rotateController = null;
        this.groupDragController = null;
        this.groupResizeController = null;
        this.groupRotateController = null;
        this.boxSelectController = null;
        
        // Очищаем модель выделения
        this.selection = null;
        
        // Вызываем destroy родительского класса
        super.destroy();
    }

    onDuplicateReady(newObjectId) {
        this.clonePending = false;
        
        // Переключаем выделение на новый объект
        this.clearSelection();
        this.addToSelection(newObjectId);

        // Завершаем drag исходного объекта и переключаем контроллер на новый объект
        if (this._dragCtrl) this._dragCtrl.end();
        this.dragTarget = newObjectId;
        this.isDragging = true;
        // Стартуем drag нового объекта под текущим курсором (в мировых координатах)
        const w = this._toWorld(this.currentX, this.currentY);
        if (this._dragCtrl) this._dragCtrl.start(newObjectId, { x: w.x, y: w.y });
        // Мгновенно обновляем позицию под курсор
        this.updateDrag({ x: this.currentX, y: this.currentY });
        // Обновляем ручки
        this.updateResizeHandles();
    }

}
