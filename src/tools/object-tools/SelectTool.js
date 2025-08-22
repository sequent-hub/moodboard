import { calculateNewSize, calculatePositionOffset } from './selection/GeometryUtils.js';
import { BaseTool } from '../BaseTool.js';
import { ResizeHandles } from '../ResizeHandles.js';
import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { SelectionModel } from './selection/SelectionModel.js';
import { HandlesSync } from './selection/HandlesSync.js';
import { SimpleDragController } from './selection/SimpleDragController.js';
import { ResizeController } from './selection/ResizeController.js';
import { RotateController } from './selection/RotateController.js';
import { GroupResizeController } from './selection/GroupResizeController.js';
import { GroupRotateController } from './selection/GroupRotateController.js';
import { GroupDragController } from './selection/GroupDragController.js';
import { BoxSelectController } from './selection/BoxSelectController.js';

/**
 * Инструмент выделения и работы с объектами
 * Основной инструмент для выделения, перемещения, изменения размера и поворота объектов
 */
export class SelectTool extends BaseTool {
    constructor(eventBus) {
        super('select', eventBus);
        this.cursor = 'default';
        this.hotkey = 'v';
        
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
                if (object.create) {
                    // Создание нового объекта с редактированием
                    this._openTextEditor(object, true);
                } else {
                    // Редактирование существующего объекта
                    this._openTextEditor(object, false);
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
        console.log('🔧 SelectTool активирован, app:', !!app);
		// Сохраняем ссылку на PIXI app для оверлеев (рамка выделения)
		this.app = app;
        
        // Устанавливаем стандартный курсор для select инструмента
        if (this.app && this.app.view) {
            this.app.view.style.cursor = 'default';
        }
        
        // Инициализируем систему ручек изменения размера
        if (!this.resizeHandles && app) {
            this.resizeHandles = new ResizeHandles(app);
            this._handlesSync = new HandlesSync({
                app,
                resizeHandles: this.resizeHandles,
                selection: this.selection,
                emit: (event, payload) => this.emit(event, payload)
            });
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
            console.log('ℹ️ ResizeHandles уже созданы');
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
        
        // Очищаем выделение и ручки
        this.clearSelection();
        if (this.resizeHandles) {
            this.resizeHandles.hideHandles();
        }
        
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
            console.log('🔧 SelectTool: closing text editor on mouse down, objectType:', this.textEditor.objectType, 'objectId:', this.textEditor.objectId);
            this._closeTextEditor(true);
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
            // Начинаем обычный drag исходника; Alt-режим включим на лету при движении
            this.handleObjectSelect(hitResult.object, event);
        } else {
            // Клик по пустому месту — если есть одиночное выделение, разрешаем drag за пределами объекта в пределах рамки
            if (this.selection.size() === 1) {
                const selId = this.selection.toArray()[0];
                const boundsReq = { objects: [] };
                this.emit(Events.Tool.GetAllObjects, boundsReq);
                const map = new Map(boundsReq.objects.map(o => [o.id, o.bounds]));
                const b = map.get(selId);
                if (b && this.isPointInBounds({ x: event.x, y: event.y }, b)) {
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
        if (!this.resizeHandles || !this.resizeHandles.app) return null;
        
        const point = new PIXI.Point(x, y);
        
        // Сначала ищем в контейнере ручек (приоритет)
        if (this.resizeHandles.container.visible) {
            for (let i = this.resizeHandles.container.children.length - 1; i >= 0; i--) {
                const child = this.resizeHandles.container.children[i];
                
                // Проверяем обычные объекты
                if (child.containsPoint && child.containsPoint(point)) {

                    return child;
                }
                
                // Специальная проверка для контейнеров (ручка вращения)
                if (child instanceof PIXI.Container && child.children.length > 0) {
                    // Проверяем границы контейнера
                    const bounds = child.getBounds();
                    if (point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
                        point.y >= bounds.y && point.y <= bounds.y + bounds.height) {

                        return child;
                    }
                }
            }
        }
        
        // Затем ищем в основной сцене
        const stage = this.resizeHandles.app.stage;
        for (let i = stage.children.length - 1; i >= 0; i--) {
            const child = stage.children[i];
            if (child !== this.resizeHandles.container && child.containsPoint && child.containsPoint(point)) {

                return child;
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
        
        // Получаем текущую позицию объекта
        const objectData = { objectId, position: null };
        this.emit(Events.Tool.GetObjectPosition, objectData);
        // Нормализуем координаты в мировые (worldLayer), чтобы убрать влияние зума
        const w = this._toWorld(event.x, event.y);
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
            // Запрашиваем текущую позицию исходного объекта
            const positionData = { objectId: this.cloneSourceId, position: null };
            this.emit(Events.Tool.GetObjectPosition, positionData);
            // Сообщаем ядру о необходимости создать дубликат у позиции исходного объекта
            this.emit(Events.Tool.DuplicateRequest, {
                originalId: this.cloneSourceId,
                position: positionData.position || { x: event.x, y: event.y }
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
        console.log(`🔧 Начинаем resize: ручка ${handle}, объект ${objectId}`);
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
        if (this.resizeHandles) {
            this.resizeHandles.updateHandles();
        }
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
                this.resizeHandles.showHandles(this.groupBoundsGraphics, this.groupId);
            }
            return;
        }
        if (this._resizeCtrl) this._resizeCtrl.end();
        
        // Обновляем позицию ручек после resize
        if (this.resizeHandles) {
            this.resizeHandles.updateHandles(); // Обновляем позицию ручек
        }
        
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
        if (this.resizeHandles) {
            this.resizeHandles.updateHandles();
        }
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
            if (this.resizeHandles) this.resizeHandles.showHandles(this.groupBoundsGraphics, this.groupId);
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
        if (this.resizeHandles) {
            this.resizeHandles.updateHandles();
        }
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
            this.resizeHandles.showHandles(this.groupBoundsGraphics, this.groupId);
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
                this.cursor = 'default';
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
            return 'default';
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
        console.log(`➕ Добавляем в выделение: ${object}`);
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
        // Позиция в состоянии — левый верх. Для левых/верхних ручек топ-лев должен 
        // смещаться на ту же величину, что и движение мыши в соответствующей оси.
        // Мы восстанавливаем это через разницу размеров: 
        // deltaX = start.width - new.width (эквивалентно мировому смещению мыши по X для левых ручек)
        // deltaY = start.height - new.height (эквивалентно мировому смещению мыши по Y для верхних ручек)

        const deltaX = startBounds.width - newSize.width;
        const deltaY = startBounds.height - newSize.height;

        let offsetX = 0;
        let offsetY = 0;

        switch (handleType) {
            case 'nw':
                offsetX = deltaX; // левый край движется вместе с мышью
                offsetY = deltaY; // верхний край движется вместе с мышью
                break;
            case 'n':
                offsetY = deltaY; // только верхний край
                break;
            case 'ne':
                offsetY = deltaY; // верх двигается, правый — нет
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
                offsetX = deltaX; // левый двигается, низ — нет
                break;
            case 'w':
                offsetX = deltaX; // левый край двигается
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

        
        let { fontSize = 18, content = '', initialSize } = properties;
        
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
        
        // Уведомляем о начале редактирования
        this.eventBus.emit(Events.UI.TextEditStart, { objectId: objectId || null });
        
        const app = this.app;
        const world = app?.stage?.getChildByName && app.stage.getChildByName('worldLayer');
        this.textEditor.world = world || null;
        const view = app?.view;
        if (!view) return;
        if (this.resizeHandles && typeof this.resizeHandles.hideHandles === 'function') {
            this.resizeHandles.hideHandles();
        }
        // Обертка для рамки + textarea + ручек
        const wrapper = document.createElement('div');
        wrapper.className = 'moodboard-text-editor';
        
        // Убираем рамки и ручки для всех типов объектов в режиме редактирования
        Object.assign(wrapper.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            transformOrigin: '0 0',
            boxSizing: 'border-box',
            border: 'none', // Убираем рамку для всех типов
            background: 'transparent',
            zIndex: 10000,
        });
        
        const textarea = document.createElement('textarea');
        textarea.className = 'moodboard-text-input';
        textarea.value = content || '';
        textarea.placeholder = 'напишите что-нибудь';
        
        Object.assign(textarea.style, {
            position: 'relative',
            left: '0px',
            top: '0px',
            border: 'none',
            padding: '6px 8px', // Увеличиваем отступы для лучшего отображения
            fontSize: `${fontSize}px`,
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.2',
            color: '#111', // Для записок делаем текст черным для лучшей видимости
            background: 'white',
            outline: 'none',
            resize: 'none',
            minWidth: '240px', // Для заметок уменьшаем минимальную ширину
            minHeight: '28px', // Для заметок уменьшаем минимальную высоту
            width: '280px', // Для заметок уменьшаем начальную ширину
            height: '36px', // Для заметок уменьшаем начальную высоту
            boxSizing: 'border-box',
            // Повыше чёткость текста в CSS
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
        });
        
        wrapper.appendChild(textarea);
        
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
        
        // Автоматически устанавливаем фокус на textarea
        textarea.focus();
        
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
            
            // Позиционируем редактор точно там, где находится текст на заметке
            // В NoteObject текст позиционируется с topMargin = 20 и центрируется по горизонтали
            const topMargin = 20; // Отступ от верха (ниже полоски)
            const horizontalPadding = 8; // Отступы по горизонтали
            const editorWidth = Math.min(280, noteWidth - (horizontalPadding * 2));
            const editorHeight = Math.min(36, noteHeight - topMargin - horizontalPadding);
            
            // Позиционируем редактор точно там, где находится текст
            // Текст центрирован по горизонтали и имеет отступ topMargin от верха
            const textCenterX = noteWidth / 2; // центр текста по горизонтали
            const textTopY = topMargin; // позиция текста по вертикали
            
            // Позиционируем редактор так, чтобы его центр совпадал с центром текста
            const editorLeft = textCenterX - (editorWidth / 2);
            const editorTop = textTopY;
            
            wrapper.style.left = `${screenPos.x + editorLeft}px`;
            wrapper.style.top = `${screenPos.y + editorTop}px`;
            
            // Устанавливаем размеры редактора
            textarea.style.width = `${editorWidth}px`;
            textarea.style.height = `${editorHeight}px`;
            wrapper.style.width = `${editorWidth}px`;
            wrapper.style.height = `${editorHeight}px`;
        } else {
            // Для обычного текста используем стандартное позиционирование
            wrapper.style.left = `${screenPos.x}px`;
            wrapper.style.top = `${screenPos.y}px`;
        }
        // Минимальные границы (зависят от текущего режима: новый объект или редактирование существующего)
        const worldLayerRef = this.textEditor.world || (this.app?.stage);
        const s = worldLayerRef?.scale?.x || 1;
        const viewRes = (this.app?.renderer?.resolution) || (view.width && view.clientWidth ? (view.width / view.clientWidth) : 1);
        const initialWpx = initialSize ? Math.max(1, (initialSize.width || 0) * s / viewRes) : null;
        const initialHpx = initialSize ? Math.max(1, (initialSize.height || 0) * s / viewRes) : null;
        
        // Определяем минимальные границы для всех типов объектов
        let minWBound = initialWpx || 240;
        let minHBound = 28;
        
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
        const autoSize = () => {
            if (isNote) {
                // Для заметок используем фиксированные размеры, вычисленные выше
                // Не вызываем autoSize, чтобы сохранить точное позиционирование
                return;
            }
            
            // Для обычного текста восстанавливаем автоподгон
            textarea.style.height = '1px';
            textarea.style.width = '1px';
            const w = Math.max(minWBound, textarea.scrollWidth + 8);
            const h = Math.max(minHBound, textarea.scrollHeight + 4);
            textarea.style.width = `${w}px`;
            textarea.style.height = `${h}px`;
            wrapper.style.width = `${w}px`;
            wrapper.style.height = `${h}px`;
            // Обновляем ручки только для обычного текста
            // placeHandles();
        };
        
        // Вызываем autoSize только для обычного текста
        if (!isNote) {
            autoSize();
        }
        textarea.focus();
        // Локальная CSS-настройка placeholder (меньше базового шрифта)
        const uid = 'mbti-' + Math.random().toString(36).slice(2);
        textarea.classList.add(uid);
        const styleEl = document.createElement('style');
        const phSize = Math.max(12, Math.round(fontSize * 0.8));
        const placeholderOpacity = isNote ? '0.4' : '0.6'; // Для записок делаем placeholder менее заметным
        styleEl.textContent = `.${uid}::placeholder{font-size:${phSize}px;opacity:${placeholderOpacity};}`;
        document.head.appendChild(styleEl);
        this.textEditor = { active: true, objectId, textarea, wrapper, world: this.textEditor.world, position, properties: { fontSize }, objectType, _phStyle: styleEl };

        // Скрываем статичный текст во время редактирования для всех типов объектов
        if (objectId) {
            // Проверяем, что HTML-элемент существует перед попыткой скрыть текст
            if (window.moodboard && window.moodboard.htmlTextLayer) {
                const el = window.moodboard.htmlTextLayer.idToEl.get(objectId);
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
        if (!isNote) {
            const onHandleDown = (e) => {
                e.preventDefault(); e.stopPropagation();
                const dir = e.target.dataset.dir;
                if (!dir) return;
                const start = {
                    x: e.clientX, y: e.clientY,
                    w: wrapper.offsetWidth, h: wrapper.offsetHeight,
                    left: parseFloat(wrapper.style.left), top: parseFloat(wrapper.style.top), dir
                };
                const onMove = (ev) => {
                    const dx = ev.clientX - start.x;
                    const dy = ev.clientY - start.y;
                    let newW = start.w, newH = start.h, newLeft = start.left, newTop = start.top;
                    if (dir.includes('e')) newW = Math.max(80, start.w + dx);
                    if (dir.includes('s')) newH = Math.max(24, start.h + dy);
                    if (dir.includes('w')) { newW = Math.max(80, start.w - dx); newLeft = start.left + dx; }
                    if (dir.includes('n')) { newH = Math.max(24, start.h - dy); newTop = start.top + dy; }
                    wrapper.style.width = `${newW}px`;
                    wrapper.style.height = `${newH}px`;
                    wrapper.style.left = `${newLeft}px`;
                    wrapper.style.top = `${newTop}px`;
                    textarea.style.width = `${Math.max(minWBound, newW)}px`;
                    textarea.style.height = `${Math.max(minHBound, newH)}px`;
                    // placeHandles();
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            };
            // handles.forEach(h => h.addEventListener('mousedown', onHandleDown));
        }
        // Завершение
        const finalize = (commit) => {
            console.log('🔧 SelectTool: finalize called with commit:', commit, 'objectId:', objectId, 'objectType:', this.textEditor.objectType);
            const value = textarea.value.trim();
            const commitValue = commit && value.length > 0;
            
            // Сохраняем objectType ДО сброса this.textEditor
            const currentObjectType = this.textEditor.objectType;
            console.log('🔧 SelectTool: finalize - saved objectType:', currentObjectType);
            
            // Показываем статичный текст после завершения редактирования для всех типов объектов
            if (objectId) {
                // Проверяем, что HTML-элемент существует перед попыткой показать текст
                if (window.moodboard && window.moodboard.htmlTextLayer) {
                    const el = window.moodboard.htmlTextLayer.idToEl.get(objectId);
                    if (el) {
                        this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                    } else {
                        console.warn(`❌ SelectTool: HTML-элемент для объекта ${objectId} не найден, пропускаем ShowObjectText`);
                    }
                } else {
                    this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
                }
            }
            
            wrapper.remove();
            this.textEditor = { active: false, objectId: null, textarea: null, wrapper: null, world: null, position: null, properties: null, objectType: 'text' };
            this.eventBus.emit(Events.UI.TextEditEnd, { objectId: objectId || null });
            if (!commitValue) {
                console.log('🔧 SelectTool: finalize - no commit, returning');
                return;
            }
            if (objectId == null) {
                console.log('🔧 SelectTool: finalize - creating new object');
                // Создаем объект с правильным типом
                const objectType = currentObjectType || 'text';
                this.eventBus.emit(Events.UI.ToolbarAction, {
                    type: objectType,
                    id: objectType,
                    position: { x: position.x, y: position.y },
                    properties: { content: value, fontSize }
                });
            } else {
                // Обновление существующего: используем команду обновления содержимого
                if (currentObjectType === 'note') {
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
                    console.log('🔧 SelectTool: finalize - updating text content via UpdateObjectContent');
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
            // Не закрываем новый пустой текст по потере фокуса — чтобы поле не исчезало сразу
            const isNew = objectId == null;
            const value = (textarea.value || '').trim();
            if (isNew && value.length === 0) {
                // Вернём фокус обратно, чтобы пользователь мог ввести текст
                setTimeout(() => textarea.focus(), 0);
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
        // Автоподгон при вводе только для обычного текста
        if (!isNote) {
            textarea.addEventListener('input', autoSize);
        }
    }

    _closeTextEditor(commit) {
        console.log('🔧 SelectTool: _closeTextEditor called with commit:', commit);
        const textarea = this.textEditor.textarea;
        if (!textarea) return;
        const value = textarea.value.trim();
        const commitValue = commit && value.length > 0;
        const objectType = this.textEditor.objectType || 'text';
        const objectId = this.textEditor.objectId;
        const position = this.textEditor.position;
        const properties = this.textEditor.properties;
        
        console.log('🔧 SelectTool: _closeTextEditor - objectType:', objectType, 'objectId:', objectId, 'commitValue:', commitValue);
        
        // Показываем статичный текст после завершения редактирования для всех типов объектов
        if (objectId) {
            // Проверяем, что HTML-элемент существует перед попыткой показать текст
            if (window.moodboard && window.moodboard.htmlTextLayer) {
                const el = window.moodboard.htmlTextLayer.idToEl.get(objectId);
                if (el) {
                    this.eventBus.emit(Events.Tool.ShowObjectText, { objectId });
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
            console.log('🔧 SelectTool: creating new object via ToolbarAction, type:', objectType);
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


}
