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
    // Подписка на событие готовности дубликата (от Core)
    // Когда PasteObjectCommand завершится, ядро сообщит newId
    if (!instance.eventBus) return;

    instance.eventBus.on(Events.Tool.DuplicateReady, (data) => {
        // data: { originalId, newId }
        if (!instance.isAltCloneMode || !instance.clonePending) return;
        if (!data || data.originalId !== instance.cloneSourceId) return;
        instance.onDuplicateReady(data.newId);
    });

    // Групповой клон готов
    instance.eventBus.on(Events.Tool.GroupDuplicateReady, (data) => {
        // data: { map: { [originalId]: newId } }
        if (!instance.isAltGroupCloneMode || !instance.groupClonePending) return;
        if (!data || !data.map) return;
        instance.onGroupDuplicateReady(data.map);
    });

    instance.eventBus.on(Events.Tool.ObjectEdit, (object) => {
        // Определяем тип редактируемого объекта
        const objectType = object.type || (object.object && object.object.type) || 'text';

        if (objectType === 'file') {
            // Для файлов используем специальный редактор названия
            instance._openFileNameEditor(object, object.create || false);
        } else {
            // Для текста и записок используем обычный редактор
            if (object.create) {
                // Создание нового объекта с редактированием
                instance._openTextEditor(object, true);
            } else {
                // Редактирование существующего объекта
                instance._openTextEditor(object, false);
            }
        }
    });

    // Обработка удаления объектов (undo создания, delete команды и т.д.)
    instance.eventBus.on(Events.Object.Deleted, (data) => {
        const objectId = data?.objectId || data;
        console.log('🗑️ SelectTool: получено событие удаления объекта:', objectId, 'данные:', data);

        // ЗАЩИТА: Проверяем что данные валидны
        if (!objectId) {
            console.warn('⚠️ SelectTool: получено событие удаления с невалидным objectId');
            return;
        }

        if (instance.selection.has(objectId)) {
            console.log('🗑️ SelectTool: удаляем объект из selection:', objectId);
            instance.removeFromSelection(objectId);

            // ИСПРАВЛЕНИЕ: Принудительно очищаем selection если он стал пустым
            if (instance.selection.size() === 0) {
                console.log('🗑️ SelectTool: selection пустой, скрываем ручки');
                instance.emit(Events.Tool.SelectionClear);
                instance.updateResizeHandles();
            }
        } else {
            console.log('🗑️ SelectTool: объект не был в selection, обновляем ручки на всякий случай');
            // Принудительно обновляем ручки без излишних действий
            instance.updateResizeHandles();
        }
    });
}
