import { BaseTool } from '../BaseTool.js';
import { ResizeHandles } from '../ResizeHandles.js';
import * as PIXI from 'pixi.js';

/**
 * Инструмент выделения и работы с объектами
 * Основной инструмент для выделения, перемещения, изменения размера и поворота объектов
 */
export class SelectTool extends BaseTool {
    constructor(eventBus) {
        super('select', eventBus);
        this.cursor = 'default';
        this.hotkey = 'v';
        
        // Состояние выделения
        this.selectedObjects = new Set();
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
			this.eventBus.on('tool:duplicate:ready', (data) => {
				// data: { originalId, newId }
				if (!this.isAltCloneMode || !this.clonePending) return;
				if (!data || data.originalId !== this.cloneSourceId) return;
				this.onDuplicateReady(data.newId);
			});
			// Групповой клон готов
			this.eventBus.on('tool:group:duplicate:ready', (data) => {
				// data: { map: { [originalId]: newId } }
				if (!this.isAltGroupCloneMode || !this.groupClonePending) return;
				if (!data || !data.map) return;
				this.onGroupDuplicateReady(data.map);
			});
		}
    }
    
    /**
     * Активация инструмента
     */
    activate(app) {
        super.activate();
        console.log('🔧 SelectTool активирован, app:', !!app);
		// Сохраняем ссылку на PIXI app для оверлеев (рамка выделения)
		this.app = app;
        
        // Инициализируем систему ручек изменения размера
        if (!this.resizeHandles && app) {

            this.resizeHandles = new ResizeHandles(app);
        } else if (!app) {
            console.log('❌ PIXI app не передан в activate');
        } else {
            console.log('ℹ️ ResizeHandles уже созданы');
        }
    }
    
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
    }
    
    /**
     * Нажатие кнопки мыши
     */
    onMouseDown(event) {
        super.onMouseDown(event);
        
        this.isMultiSelect = event.originalEvent.ctrlKey || event.originalEvent.metaKey;
        
        // Проверяем, что под курсором
        const hitResult = this.hitTest(event.x, event.y);
        
        if (hitResult.type === 'resize-handle') {
            this.startResize(hitResult.handle, hitResult.object);
        } else if (hitResult.type === 'rotate-handle') {
            this.startRotate(hitResult.object);
        } else if (this.selectedObjects.size > 1) {
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
            if (this.selectedObjects.size === 1) {
                const selId = Array.from(this.selectedObjects)[0];
                const boundsReq = { objects: [] };
                this.emit('get:all:objects', boundsReq);
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
            if (this.selectedObjects.has(targetId) && this.selectedObjects.size > 1) {
                context = 'group';
            } else {
                context = 'object';
            }
        } else if (this.selectedObjects.size > 1) {
            context = 'group';
        }
        // Сообщаем ядру/UI, что нужно показать контекстное меню (пока без пунктов)
        this.emit('context:menu:show', { x: event.x, y: event.y, context, targetId });
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
        this.emit('hit:test', hitTestData);
        
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
        
        if (this.selectedObjects.has(objectId)) {
            if (this.isMultiSelect) {
                this.removeFromSelection(objectId);
            } else if (this.selectedObjects.size > 1) {
                // Перетаскивание группы
                this.startGroupDrag(event);
            } else {
                // Начинаем перетаскивание
                this.startDrag(objectId, event);
            }
        } else {
            this.addToSelection(objectId);
            if (this.selectedObjects.size > 1) {
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
        this.emit('get:object:position', objectData);
        
        if (objectData.position) {
            this.dragOffset = {
                x: event.x - objectData.position.x,
                y: event.y - objectData.position.y
            };
        } else {
            this.dragOffset = { x: 0, y: 0 };
        }
        
        this.emit('drag:start', { object: objectId, position: { x: event.x, y: event.y } });
    }
    
    /**
     * Обновление перетаскивания
     */
    updateDrag(event) {
        // Перетаскивание группы
        if (this.isGroupDragging && this.groupStartBounds && this.groupDragOffset) {
            // Если Alt зажат и клон группы ещё не запрошен — запускаем групповой клон
            if (event.originalEvent && event.originalEvent.altKey && !this.isAltGroupCloneMode && !this.groupClonePending) {
                this.isAltGroupCloneMode = true;
                this.groupClonePending = true;
                this.groupCloneOriginalIds = Array.from(this.selectedObjects);
                // Запрашиваем групповой клон на текущих позициях
                this.emit('group:duplicate:request', { objects: this.groupCloneOriginalIds });
                return; // дождемся маппинга и переключимся
            }
            const newTopLeft = {
                x: event.x - this.groupDragOffset.x,
                y: event.y - this.groupDragOffset.y
            };
            const delta = {
                dx: newTopLeft.x - this.groupStartBounds.x,
                dy: newTopLeft.y - this.groupStartBounds.y
            };
            const ids = Array.from(this.selectedObjects);
            this.emit('group:drag:update', { objects: ids, delta });
            this.updateGroupBoundsGraphicsByTopLeft(newTopLeft);
            return;
        }
        // Если во время обычного перетаскивания зажали Alt — включаем режим клонирования на лету
        if (this.isDragging && !this.isAltCloneMode && event.originalEvent && event.originalEvent.altKey) {
            this.isAltCloneMode = true;
            this.cloneSourceId = this.dragTarget;
            this.clonePending = true;
            // Запрашиваем текущую позицию исходного объекта
            const positionData = { objectId: this.cloneSourceId, position: null };
            this.emit('get:object:position', positionData);
            // Сообщаем ядру о необходимости создать дубликат у позиции исходного объекта
            this.emit('duplicate:request', {
                originalId: this.cloneSourceId,
                position: positionData.position || { x: event.x, y: event.y }
            });
            // Не сбрасываем dragTarget, чтобы исходник продолжал двигаться до появления копии
            // Визуально это ок: копия появится и захватит drag в onDuplicateReady
        }
        // Если ожидаем создание копии — продолжаем двигать текущую цель (исходник)
        if (!this.dragTarget) return;
        
        const newX = event.x - this.dragOffset.x;
        const newY = event.y - this.dragOffset.y;
        
        this.emit('drag:update', { 
            object: this.dragTarget, 
            position: { x: newX, y: newY } 
        });
        
        // Обновляем ручки во время перетаскивания
        if (this.resizeHandles && this.selectedObjects.has(this.dragTarget)) {
            this.resizeHandles.updateHandles();
        }
    }
    
    /**
     * Завершение перетаскивания
     */
    endDrag() {
        if (this.isGroupDragging) {
            const ids = Array.from(this.selectedObjects);
            this.emit('group:drag:end', { objects: ids });
            this.isAltGroupCloneMode = false;
            this.groupClonePending = false;
            this.groupCloneOriginalIds = [];
            this.groupCloneMap = null;
        } else if (this.dragTarget) {
            this.emit('drag:end', { object: this.dragTarget });
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
        if (objectId === this.groupId && this.selectedObjects.size > 1) {
            this.isGroupResizing = true;
            this.groupStartBounds = this.computeGroupBounds();
            this.groupStartMouse = { x: this.currentX, y: this.currentY };
            // Снимок делается в Core для точности; здесь просто эмит старт
            const ids = Array.from(this.selectedObjects);
            this.emit('group:resize:start', { objects: ids, startBounds: this.groupStartBounds, handle });
            this.resizeHandle = handle;
            // Блокируем обычный флаг isResizing, чтобы не конфликтовало
            this.isResizing = false;
            return;
        }

        this.isResizing = true;
        this.resizeHandle = handle;
        this.dragTarget = objectId; // Используем dragTarget для совместимости
        
        // Получаем данные объекта для сохранения начального состояния
        const sizeData = { objectId, size: null };
        this.emit('get:object:size', sizeData);
        
        // Получаем начальную позицию объекта
        const positionData = { objectId, position: null };
        this.emit('get:object:position', positionData);
        
        this.resizeStartBounds = sizeData.size || { width: 100, height: 100 };
        this.resizeStartMousePos = { x: this.currentX, y: this.currentY };
        this.resizeStartPosition = positionData.position || { x: 0, y: 0 };
        
        console.log(`📐 Начальный размер:`, this.resizeStartBounds);
        console.log(`📍 Начальная позиция мыши:`, this.resizeStartMousePos);
        console.log(`📍 Начальная позиция объекта:`, this.resizeStartPosition);
        
        // Ручки остаются видными во время resize для лучшего UX
        
        this.emit('resize:start', { object: objectId, handle });
    }
    
    /**
     * Обновление изменения размера
     */
    updateResize(event) {
		// Групповой resize
		if (this.isGroupResizing && this.groupStartBounds && this.resizeHandle) {
            const start = this.groupStartBounds;
            const deltaX = event.x - this.groupStartMouse.x;
            const deltaY = event.y - this.groupStartMouse.y;
            const minW = 20;
            const minH = 20;
            let x = start.x;
            let y = start.y;
            let w = start.width;
            let h = start.height;

			// Пропорциональный ресайз с Shift
			const maintainAspectRatio = !!(event.originalEvent && event.originalEvent.shiftKey);

            switch (this.resizeHandle) {
                case 'e':
                    w = start.width + deltaX;
                    break;
                case 'w':
                    w = start.width - deltaX;
                    x = start.x + deltaX;
                    break;
                case 's':
                    h = start.height + deltaY;
                    break;
                case 'n':
                    h = start.height - deltaY;
                    y = start.y + deltaY;
                    break;
                case 'se':
                    w = start.width + deltaX;
                    h = start.height + deltaY;
                    break;
                case 'ne':
                    w = start.width + deltaX;
                    h = start.height - deltaY;
                    y = start.y + deltaY;
                    break;
                case 'sw':
                    w = start.width - deltaX;
                    x = start.x + deltaX;
                    h = start.height + deltaY;
                    break;
                case 'nw':
                    w = start.width - deltaX;
                    x = start.x + deltaX;
                    h = start.height - deltaY;
                    y = start.y + deltaY;
                    break;
            }

			// Если зажат Shift — сохраняем исходные пропорции группы
			if (maintainAspectRatio && start.height !== 0) {
				const ar = start.width / start.height;
				if (['nw','ne','sw','se'].includes(this.resizeHandle)) {
					const widthChange = Math.abs(w - start.width);
					const heightChange = Math.abs(h - start.height);
					if (widthChange > heightChange) {
						// Корректируем высоту по ширине
						h = w / ar;
						// Если тянем верхние ручки — двигаем y, чтобы верх оставался закреплен
						if (['n','ne','nw'].includes(this.resizeHandle)) {
							y = start.y + (start.height - h);
						} else {
							y = start.y;
						}
					} else {
						// Корректируем ширину по высоте
						w = h * ar;
						// Если тянем левые ручки — двигаем x, чтобы левый край оставался закреплен
						if (['w','sw','nw'].includes(this.resizeHandle)) {
							x = start.x + (start.width - w);
						} else {
							x = start.x;
						}
					}
				} else if (['e','w'].includes(this.resizeHandle)) {
					// Горизонтальные ручки — ширина задает высоту
					h = w / ar;
					// Верхний край корректируем, если тянем верх
					if (['n'].includes(this.resizeHandle)) {
						y = start.y + (start.height - h);
					} else {
						y = start.y;
					}
					// Если тянем левую — корректируем x уже задан во время переключения ручки
					if (this.resizeHandle === 'w') {
						x = start.x + (start.width - w);
					} else {
						x = start.x;
					}
				} else if (['n','s'].includes(this.resizeHandle)) {
					// Вертикальные ручки — высота задает ширину
					w = h * ar;
					if (this.resizeHandle === 'n') {
						y = start.y + (start.height - h);
					} else {
						y = start.y;
					}
					if (['w'].includes(this.resizeHandle)) {
						x = start.x + (start.width - w);
					} else {
						x = start.x;
					}
				}
			}

            // Минимальные размеры и коррекция позиции для левых/верхних ручек
            if (w < minW) {
                if (['w', 'sw', 'nw'].includes(this.resizeHandle)) {
                    x += (w - minW);
                }
                w = minW;
            }
            if (h < minH) {
                if (['n', 'ne', 'nw'].includes(this.resizeHandle)) {
                    y += (h - minH);
                }
                h = minH;
            }

            const scale = { x: w / start.width, y: h / start.height };
            const ids = Array.from(this.selectedObjects);
            const newBounds = { x, y, width: w, height: h };
            this.emit('group:resize:update', { objects: ids, startBounds: start, newBounds, scale });
            this.updateGroupBoundsGraphics(newBounds);
            return;
        }

        if (!this.isResizing || !this.resizeStartBounds || !this.resizeStartMousePos) return;
        
        // Вычисляем изменение позиции мыши
        const deltaX = event.x - this.resizeStartMousePos.x;
        const deltaY = event.y - this.resizeStartMousePos.y;
        
        // Проверяем, зажат ли Shift для пропорционального изменения размера
        const maintainAspectRatio = event.originalEvent.shiftKey;
        
        // Вычисляем новые размеры в зависимости от типа ручки
        const newSize = this.calculateNewSize(
            this.resizeHandle, 
            this.resizeStartBounds, 
            deltaX, 
            deltaY, 
            maintainAspectRatio
        );
        
        // Ограничиваем минимальный размер
        newSize.width = Math.max(20, newSize.width);
        newSize.height = Math.max(20, newSize.height);
        
        // Получаем угол поворота для расчета смещения позиции
        const rotationData = { objectId: this.dragTarget, rotation: 0 };
        this.emit('get:object:rotation', rotationData);
        const objectRotation = rotationData.rotation || 0;
        
        // Вычисляем новую абсолютную позицию для левых/верхних ручек
        const positionOffset = this.calculatePositionOffset(
            this.resizeHandle, 
            this.resizeStartBounds, 
            newSize,
            objectRotation
        );
        
        // Вычисляем абсолютную позицию относительно начальной позиции
        const newPosition = {
            x: this.resizeStartPosition.x + positionOffset.x,
            y: this.resizeStartPosition.y + positionOffset.y
        };
        
        this.emit('resize:update', { 
            object: this.dragTarget,
            handle: this.resizeHandle,
            size: newSize,
            position: newPosition
        });
        
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
            const ids = Array.from(this.selectedObjects);
            this.emit('group:resize:end', { objects: ids });
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
        if (this.dragTarget && this.resizeStartBounds) {
            // Получаем финальный размер
            const finalSizeData = { objectId: this.dragTarget, size: null };
            this.emit('get:object:size', finalSizeData);
            
            // Получаем финальную позицию
            const finalPositionData = { objectId: this.dragTarget, position: null };
            this.emit('get:object:position', finalPositionData);
            
            this.emit('resize:end', { 
                object: this.dragTarget,
                oldSize: this.resizeStartBounds,
                newSize: finalSizeData.size || this.resizeStartBounds,
                oldPosition: this.resizeStartPosition,
                newPosition: finalPositionData.position || this.resizeStartPosition
            });
        }
        
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
        if (objectId === this.groupId && this.selectedObjects.size > 1) {
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
            const ids = Array.from(this.selectedObjects);
            this.emit('group:rotate:start', { objects: ids, center: this.rotateCenter });
            return;
        }

        this.isRotating = true;
        this.dragTarget = objectId; // Используем dragTarget для совместимости
        
        // Получаем текущий угол объекта
        const rotationData = { objectId, rotation: 0 };
        this.emit('get:object:rotation', rotationData);
        this.rotateStartAngle = rotationData.rotation || 0;
        this.rotateCurrentAngle = this.rotateStartAngle;
        
        // Получаем позицию объекта для вычисления центра вращения
        const positionData = { objectId, position: null };
        this.emit('get:object:position', positionData);
        
        const sizeData = { objectId, size: null };
        this.emit('get:object:size', sizeData);
        
        if (positionData.position && sizeData.size) {
            // Центр объекта = позиция + половина размера
            this.rotateCenter = {
                x: positionData.position.x + sizeData.size.width / 2,
                y: positionData.position.y + sizeData.size.height / 2
            };
            
            // Вычисляем начальный угол мыши относительно центра
            this.rotateStartMouseAngle = Math.atan2(
                this.currentY - this.rotateCenter.y,
                this.currentX - this.rotateCenter.x
            );
            

        }
        
        // Ручки остаются видными во время вращения для лучшего UX
        
        this.emit('rotate:start', { object: objectId });
    }
    
    /**
     * Обновление поворота
     */
    updateRotate(event) {
        // Групповой поворот
        if (this.isGroupRotating && this.rotateCenter) {
            const currentMouseAngle = Math.atan2(
                event.y - this.rotateCenter.y,
                event.x - this.rotateCenter.x
            );
            let deltaAngle = currentMouseAngle - this.rotateStartMouseAngle;
            while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
            while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
            let deltaAngleDegrees = deltaAngle * 180 / Math.PI;
            if (event.originalEvent.shiftKey) {
                deltaAngleDegrees = Math.round(deltaAngleDegrees / 15) * 15;
            }
            this.rotateCurrentAngle = deltaAngleDegrees;
            const ids = Array.from(this.selectedObjects);
            this.emit('group:rotate:update', { objects: ids, center: this.rotateCenter, angle: this.rotateCurrentAngle });
        // Вращаем общую рамку (groupBoundsGraphics) вокруг центра — это и есть рамка с ручками
            const angleRad = this.rotateCurrentAngle * Math.PI / 180;
        if (this.groupBoundsGraphics && this.groupRotateBounds) {
            this.groupBoundsGraphics.pivot.set(this.groupRotateBounds.width / 2, this.groupRotateBounds.height / 2);
            this.groupBoundsGraphics.position.set(this.rotateCenter.x, this.rotateCenter.y);
            this.groupBoundsGraphics.rotation = angleRad;
            if (this.resizeHandles) {
                this.resizeHandles.updateHandles();
            }
        }
            return;
        }
        if (!this.isRotating || !this.rotateCenter) return;
        
        // Вычисляем текущий угол мыши относительно центра объекта
        const currentMouseAngle = Math.atan2(
            event.y - this.rotateCenter.y,
            event.x - this.rotateCenter.x
        );
        
        // Вычисляем разность углов (сколько повернула мышь)
        let deltaAngle = currentMouseAngle - this.rotateStartMouseAngle;
        
        // Нормализуем угол в диапазон -π до π
        while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        
        // Конвертируем в градусы
        let deltaAngleDegrees = deltaAngle * 180 / Math.PI;
        
        // Если зажат Shift - ступенчатое вращение (15° шаги)
        if (event.originalEvent.shiftKey) {
            deltaAngleDegrees = Math.round(deltaAngleDegrees / 15) * 15;
        }
        
        // Вычисляем финальный угол объекта
        this.rotateCurrentAngle = this.rotateStartAngle + deltaAngleDegrees;
        
        // Нормализуем угол объекта в диапазон 0-360°
        while (this.rotateCurrentAngle < 0) this.rotateCurrentAngle += 360;
        while (this.rotateCurrentAngle >= 360) this.rotateCurrentAngle -= 360;
        
        this.emit('rotate:update', { 
            object: this.dragTarget,
            angle: this.rotateCurrentAngle
        });
        
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
            const ids = Array.from(this.selectedObjects);
            this.emit('group:rotate:end', { objects: ids, angle: this.rotateCurrentAngle });
            this.isGroupRotating = false;
            // После финализации пересчитываем осевые границы группы и
            // перестраиваем рамку с ручками в осевом виде (rotation=0)
            const gb = this.computeGroupBounds();
            this.ensureGroupBoundsGraphics(gb);
            if (this.groupBoundsGraphics) {
                this.groupBoundsGraphics.rotation = 0;
                this.groupBoundsGraphics.pivot.set(0, 0);
                this.groupBoundsGraphics.position.set(gb.x, gb.y);
            }
            // Обновляем ручки на новых границах
            if (this.resizeHandles) {
                this.resizeHandles.showHandles(this.groupBoundsGraphics, this.groupId);
            }
            this.rotateCenter = null;
            this.rotateStartAngle = 0;
            this.rotateCurrentAngle = 0;
            this.rotateStartMouseAngle = 0;
            this.groupRotateBounds = null;
            return;
        }
        if (this.dragTarget && this.rotateStartAngle !== undefined) {
            this.emit('rotate:end', { 
                object: this.dragTarget,
                oldAngle: this.rotateStartAngle,
                newAngle: this.rotateCurrentAngle
            });
        }
        
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
        this.selectionBox = {
            startX: event.x,
            startY: event.y,
            endX: event.x,
            endY: event.y
        };
        
        // Сохраняем исходное выделение для корректного union при Ctrl/Meta
        this.initialSelectionBeforeBox = Array.from(this.selectedObjects);
        if (!this.isMultiSelect) {
            this.clearSelection();
        }

		// Создаем графику рамки на стадии (поверх всех объектов и ручек)
		if (this.app && this.app.stage) {
			this.app.stage.sortableChildren = true;
			this.selectionGraphics = new PIXI.Graphics();
			this.selectionGraphics.zIndex = 2000; // выше ручек (1000/2000)
			this.selectionGraphics.name = 'selection-box';
			this.app.stage.addChild(this.selectionGraphics);
		}
    }
    
    /**
     * Обновление рамки выделения
     */
    updateBoxSelect(event) {
        if (!this.selectionBox) return;
        
        this.selectionBox.endX = event.x;
        this.selectionBox.endY = event.y;
		// Визуализация рамки
		if (this.selectionGraphics) {
			const x = Math.min(this.selectionBox.startX, this.selectionBox.endX);
			const y = Math.min(this.selectionBox.startY, this.selectionBox.endY);
			const w = Math.abs(this.selectionBox.endX - this.selectionBox.startX);
			const h = Math.abs(this.selectionBox.endY - this.selectionBox.startY);

			this.selectionGraphics.clear();
			this.selectionGraphics.lineStyle(1, 0x3B82F6, 1);
			this.selectionGraphics.beginFill(0x3B82F6, 0.08);
			this.selectionGraphics.drawRect(x, y, w, h);
			this.selectionGraphics.endFill();
		}

		// Живое обновление множественного выделения по пересечению с рамкой
		const x = Math.min(this.selectionBox.startX, this.selectionBox.endX);
		const y = Math.min(this.selectionBox.startY, this.selectionBox.endY);
		const w = Math.abs(this.selectionBox.endX - this.selectionBox.startX);
		const h = Math.abs(this.selectionBox.endY - this.selectionBox.startY);
		if (w >= 2 && h >= 2) {
			const box = { x, y, width: w, height: h };
			const request = { objects: [] };
			this.emit('get:all:objects', request);
			const matched = [];
			for (const item of request.objects) {
				if (this.rectIntersectsRect(box, item.bounds)) matched.push(item.id);
			}
			let newSelection;
			if (this.isMultiSelect && this.initialSelectionBeforeBox) {
				const base = new Set(this.initialSelectionBeforeBox);
				for (const id of matched) base.add(id);
				newSelection = Array.from(base);
			} else {
				newSelection = matched;
			}
			this.setSelection(newSelection);
		}
    }
    
    /**
     * Завершение рамки выделения
     */
    endBoxSelect() {
		this.isBoxSelect = false;
		
		// Выделяем объекты, пересекающиеся с рамкой
		if (this.selectionBox) {
			const x = Math.min(this.selectionBox.startX, this.selectionBox.endX);
			const y = Math.min(this.selectionBox.startY, this.selectionBox.endY);
			const w = Math.abs(this.selectionBox.endX - this.selectionBox.startX);
			const h = Math.abs(this.selectionBox.endY - this.selectionBox.startY);
			const box = { x, y, width: w, height: h };

			// Пропускаем очень маленькие рамки (случайные клики)
            if (w >= 2 && h >= 2) {
                // Запрашиваем у ядра список объектов и их bounds
                const request = { objects: [] };
                this.emit('get:all:objects', request);

                const matched = [];
                for (const item of request.objects) {
                    if (this.rectIntersectsRect(box, item.bounds)) {
                        matched.push(item.id);
                    }
                }

                if (matched.length > 0) {
                    if (this.isMultiSelect) {
                        // Добавляем к текущему выделению
                        for (const id of matched) {
                            if (!this.selectedObjects.has(id)) {
                                this.addToSelection(id);
                            }
                        }
                    } else {
                        // Заменяем выделение целиком
                        this.setSelection(matched);
                    }
                }
            }
		}

        // Удаляем графику рамки
        if (this.selectionGraphics && this.selectionGraphics.parent) {
            this.selectionGraphics.parent.removeChild(this.selectionGraphics);
            this.selectionGraphics.destroy();
        }
        this.selectionGraphics = null;
        this.selectionBox = null;
		this.initialSelectionBeforeBox = null;
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
        const prev = Array.from(this.selectedObjects);
        this.selectedObjects = new Set(objectIds);
        // Эмитим события для совместимости
        if (prev.length > 0) {
            this.emit('selection:clear', { objects: prev });
        }
        for (const id of objectIds) {
            this.emit('selection:add', { object: id });
        }
        this.updateResizeHandles();
    }

    /**
     * Рисует рамки вокруг всех выбранных объектов (для множественного выделения)
     */
    drawGroupSelectionGraphics() {
        if (!this.app || !this.app.stage) return;
        const selectedIds = Array.from(this.selectedObjects);
        if (selectedIds.length <= 1) {
            this.removeGroupSelectionGraphics();
            return;
        }
        // Получаем bounds всех объектов и отрисовываем контур на groupBoundsGraphics (одна рамка с ручками)
        const request = { objects: [] };
        this.emit('get:all:objects', request);
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
        this.emit('get:all:objects', request);
        const selected = new Set(this.getSelection());
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const item of request.objects) {
            if (!selected.has(item.id)) continue;
            const b = item.bounds;
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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

    startGroupDrag(event) {
        const gb = this.computeGroupBounds();
        this.groupStartBounds = gb;
        this.groupDragOffset = { x: event.x - gb.x, y: event.y - gb.y };
        this.isGroupDragging = true;
        this.isDragging = false; // отключаем одиночный drag, если был
        // Обеспечиваем наличие невидимой геометрии и ручек на группе
        this.ensureGroupBoundsGraphics(gb);
        if (this.groupBoundsGraphics && this.resizeHandles) {
            this.resizeHandles.showHandles(this.groupBoundsGraphics, this.groupId);
        }
        const ids = Array.from(this.selectedObjects);
        this.emit('group:drag:start', { objects: ids });
    }

    /**
     * Переключение на клон группы после готовности
     */
    onGroupDuplicateReady(idMap) {
        this.groupClonePending = false;
        this.groupCloneMap = idMap;
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
        this.emit('get:object:rotation', rotationData);
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
        this.selectedObjects.add(object);
        this.emit('selection:add', { object });
        this.updateResizeHandles();
    }

    removeFromSelection(object) {
        this.selectedObjects.delete(object);
        this.emit('selection:remove', { object });
        this.updateResizeHandles();
    }

    clearSelection() {
        const objects = Array.from(this.selectedObjects);
        this.selectedObjects.clear();
        this.emit('selection:clear', { objects });
        this.updateResizeHandles();
    }
    
    selectAll() {
        // TODO: Выделить все объекты на доске
        this.emit('selection:all');
    }
    
    deleteSelectedObjects() {
        const objects = Array.from(this.selectedObjects);
        this.clearSelection();
        this.emit('objects:delete', { objects });
    }
    
    editObject(object) {
        this.emit('object:edit', { object });
    }
    
    /**
     * Получение информации о выделении
     */
    getSelection() {
        return Array.from(this.selectedObjects);
    }

    // Экспонируем выделение через EventBus для внешних слушателей (keyboard)
    onActivate() {
        // Подписка безопасна: EventBus простая шина, а вызов синхронный
        this.eventBus.on('tool:get:selection', (data) => {
            data.selection = this.getSelection();
        });
    }
    
    hasSelection() {
        return this.selectedObjects.size > 0;
    }
    
    /**
     * Обновление ручек изменения размера
     */
    updateResizeHandles() {
        if (!this.resizeHandles) {
            console.log('❌ ResizeHandles не инициализированы');
            return;
        }
        
        // Показываем ручки только для одного выделенного объекта
        if (this.selectedObjects.size === 1) {
            // Удаляем графику группового выделения
            this.removeGroupSelectionGraphics();
            const objectId = Array.from(this.selectedObjects)[0];
            const pixiObjectData = { objectId, pixiObject: null };
            
            // Получаем PIXI объект
            this.emit('get:object:pixi', pixiObjectData);
            
            if (pixiObjectData.pixiObject) {
                this.resizeHandles.showHandles(pixiObjectData.pixiObject, objectId);
            }
        } else if (this.selectedObjects.size >= 2) {
            // Для группы: создаем невидимый прямоугольник и вешаем на него ручки
            const gb = this.computeGroupBounds();
            // Если границы пока невалидны (например, временно пусты во время box-select), скрываем
            if (gb.width <= 0 || gb.height <= 0) {
                this.resizeHandles.hideHandles();
                return;
            }
            this.ensureGroupBoundsGraphics(gb);
            if (this.groupBoundsGraphics) {
                this.resizeHandles.showHandles(this.groupBoundsGraphics, this.groupId);
            }
            // Общая рамка группы для визуализации
            this.drawGroupSelectionGraphics();
        } else {
            // Нет выделения
            this.resizeHandles.hideHandles();
            this.removeGroupSelectionGraphics();
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
        // Вычисляем изменения размера
        const deltaWidth = newSize.width - startBounds.width;
        const deltaHeight = newSize.height - startBounds.height;
        
        // Определяем смещение в локальной системе координат объекта (до поворота)
        let localOffsetX = 0;
        let localOffsetY = 0;
        
        // В локальной системе координат (не повернутой) определяем смещение
        // в зависимости от исходного типа ручки (до трансформации)
        switch (handleType) {
            case 'nw': // Левый верхний угол
                localOffsetX = -deltaWidth / 2;  // Левый край неподвижен
                localOffsetY = -deltaHeight / 2; // Верхний край неподвижен
                break;
            case 'n': // Верхняя сторона
                localOffsetX = 0;                // Центр по горизонтали
                localOffsetY = -deltaHeight / 2; // Верхний край неподвижен
                break;
            case 'ne': // Правый верхний угол
                localOffsetX = deltaWidth / 2;   // Правый край неподвижен
                localOffsetY = -deltaHeight / 2; // Верхний край неподвижен
                break;
            case 'e': // Правая сторона
                localOffsetX = deltaWidth / 2;   // Правый край неподвижен
                localOffsetY = 0;                // Центр по вертикали
                break;
            case 'se': // Правый нижний угол
                localOffsetX = deltaWidth / 2;   // Правый край неподвижен
                localOffsetY = deltaHeight / 2;  // Нижний край неподвижен
                break;
            case 's': // Нижняя сторона
                localOffsetX = 0;                // Центр по горизонтали
                localOffsetY = deltaHeight / 2;  // Нижний край неподвижен
                break;
            case 'sw': // Левый нижний угол
                localOffsetX = -deltaWidth / 2;  // Левый край неподвижен
                localOffsetY = deltaHeight / 2;  // Нижний край неподвижен
                break;
            case 'w': // Левая сторона
                localOffsetX = -deltaWidth / 2;  // Левый край неподвижен
                localOffsetY = 0;                // Центр по вертикали
                break;
        }
        
        // Поворачиваем смещение на угол объекта для получения мирового смещения
        const angleRad = objectRotation * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        
        const worldOffsetX = localOffsetX * cos - localOffsetY * sin;
        const worldOffsetY = localOffsetX * sin + localOffsetY * cos;
        
        return { x: worldOffsetX, y: worldOffsetY };
    }
}
