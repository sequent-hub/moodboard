import { Events } from '../../../core/events/Events.js';

export function initializeSelectToolState(instance) {
    // Флаг состояния объекта
    instance.destroyed = false;

    // Состояние выделения перенесено в модель
    instance.isMultiSelect = false;

    // Режим Alt-клонирования при перетаскивании
    // Если Alt зажат при начале drag, создаем копию и перетаскиваем именно её
    instance.isAltCloneMode = false; // активен ли режим Alt-клона
    instance.clonePending = false;   // ожидаем подтверждение создания копии
    instance.cloneRequested = false; // запрос на создание копии уже отправлен
    instance.cloneSourceId = null;   // исходный объект для копии
    // Групповой Alt-клон
    instance.isAltGroupCloneMode = false;
    instance.groupClonePending = false;
    instance.groupCloneOriginalIds = [];
    instance.groupCloneMap = null; // { originalId: newId }

    // Состояние перетаскивания
    instance.isDragging = false;
    instance.dragOffset = { x: 0, y: 0 };
    instance.dragTarget = null;

    // Состояние изменения размера
    instance.isResizing = false;
    instance.resizeHandle = null;
    instance.resizeStartBounds = null;
    instance.resizeStartMousePos = null;
    instance.resizeStartPosition = null;

    // Система ручек изменения размера
    instance.resizeHandles = null;
    instance.groupSelectionGraphics = null; // визуализация рамок при множественном выделении
    instance.groupBoundsGraphics = null; // невидимая геометрия для ручек группы
    instance.groupId = '__group__';
    instance.isGroupDragging = false;
    instance.isGroupResizing = false;
    instance.isGroupRotating = false;
    instance.groupStartBounds = null;
    instance.groupStartMouse = null;
    instance.groupDragOffset = null;
    instance.groupObjectsInitial = null; // Map id -> { position, size, rotation }

    // Текущие координаты мыши
    instance.currentX = 0;
    instance.currentY = 0;

    // Состояние поворота
    instance.isRotating = false;
    instance.rotateCenter = null;
    instance.rotateStartAngle = 0;
    instance.rotateCurrentAngle = 0;
    instance.rotateStartMouseAngle = 0;

    // Состояние рамки выделения
    instance.isBoxSelect = false;
    instance.selectionBox = null;
    instance.selectionGraphics = null; // PIXI.Graphics для визуализации рамки
    instance.initialSelectionBeforeBox = null; // снимок выделения перед началом box-select

    instance.textEditor = {
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

export function registerSelectToolCoreSubscriptions(instance) {
    if (!instance.eventBus) return;

    const onDuplicateReady = (data) => {
        if (!instance.isAltCloneMode || !instance.clonePending) return;
        if (!data || data.originalId !== instance.cloneSourceId) return;
        instance.onDuplicateReady(data.newId);
    };

    const onGroupDuplicateReady = (data) => {
        if (!instance.isAltGroupCloneMode || !instance.groupClonePending) return;
        if (!data || !data.map) return;
        instance.onGroupDuplicateReady(data.map);
    };

    const onObjectEdit = (object) => {
        const objectType = object.type || (object.object && object.object.type) || 'text';
        if (objectType === 'file') {
            instance._openFileNameEditor(object, object.create || false);
        } else {
            if (object.create) {
                instance._openTextEditor(object, true);
            } else {
                instance._openTextEditor(object, false);
            }
        }
    };

    const onObjectDeleted = (data) => {
        const objectId = data?.objectId || data;
        if (!objectId) return;
        if (instance.selection?.has(objectId)) {
            instance.removeFromSelection(objectId);
            if (instance.selection.size() === 0) {
                instance.emit(Events.Tool.SelectionClear);
                instance.updateResizeHandles();
            }
        } else {
            instance.updateResizeHandles();
        }
    };

    instance._coreHandlers = { onDuplicateReady, onGroupDuplicateReady, onObjectEdit, onObjectDeleted };
    instance.eventBus.on(Events.Tool.DuplicateReady, onDuplicateReady);
    instance.eventBus.on(Events.Tool.GroupDuplicateReady, onGroupDuplicateReady);
    instance.eventBus.on(Events.Tool.ObjectEdit, onObjectEdit);
    instance.eventBus.on(Events.Object.Deleted, onObjectDeleted);
}

export function unregisterSelectToolCoreSubscriptions(instance) {
    if (!instance.eventBus || !instance._coreHandlers) return;
    const { onDuplicateReady, onGroupDuplicateReady, onObjectEdit, onObjectDeleted } = instance._coreHandlers;
    instance.eventBus.off(Events.Tool.DuplicateReady, onDuplicateReady);
    instance.eventBus.off(Events.Tool.GroupDuplicateReady, onGroupDuplicateReady);
    instance.eventBus.off(Events.Tool.ObjectEdit, onObjectEdit);
    instance.eventBus.off(Events.Object.Deleted, onObjectDeleted);
    instance._coreHandlers = null;
}
