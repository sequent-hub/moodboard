import { Events } from '../../../core/events/Events.js';
import { tryStartAltCloneDuringDrag, resetCloneStateAfterDragEnd } from './CloneFlowController.js';

export function handleObjectSelect(objectId, event) {
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

export function startDrag(objectId, event) {
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

export function updateDrag(event) {
    // Перетаскивание группы
    if (this.isGroupDragging && this._groupDragCtrl) {
        const w = this._toWorld(event.x, event.y);
        this._groupDragCtrl.update({ ...event, x: w.x, y: w.y });
        return;
    }
    tryStartAltCloneDuringDrag.call(this, event);
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

export function endDrag() {
    if (this.isGroupDragging) {
        const ids = this.selection.toArray();
        this.emit(Events.Tool.GroupDragEnd, { objects: ids });
        if (this._groupDragCtrl) this._groupDragCtrl.end();
    } else if (this.dragTarget) {
        if (this._dragCtrl) this._dragCtrl.end();
        // Сообщаем о завершении перетаскивания одиночного объекта
        this.emit(Events.Tool.DragEnd, { object: this.dragTarget });
    }

    this.isDragging = false;
    this.isGroupDragging = false;
    this.dragTarget = null;
    this.dragOffset = { x: 0, y: 0 };
    resetCloneStateAfterDragEnd.call(this);
}

export function startResize(handle, objectId) {
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

export function updateResize(event) {
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

export function endResize() {
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

export function startRotate(objectId) {
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

export function updateRotate(event) {
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

export function endRotate() {
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

export function startBoxSelect(event) {
    this.isBoxSelect = true;
    if (this._boxSelect) this._boxSelect.start({ x: event.x, y: event.y }, this.isMultiSelect);
}

export function updateBoxSelect(event) {
    if (this._boxSelect) this._boxSelect.update({ x: event.x, y: event.y });
}

export function endBoxSelect() {
    this.isBoxSelect = false;
    if (this._boxSelect) this._boxSelect.end();
}

export function startGroupDrag(event) {
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

export function prepareAltCloneDrag(objectId, event) {
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

export function transformHandleType(handleType, rotationDegrees) {
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

export function calculateNewSize(handleType, startBounds, deltaX, deltaY, maintainAspectRatio) {
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

export function calculatePositionOffset(handleType, startBounds, newSize) {
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
