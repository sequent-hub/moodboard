import { Events } from '../../../core/events/Events.js';

export function addToSelection(object) {
    this.selection.add(object);
    this.emit(Events.Tool.SelectionAdd, { object });
    this.updateResizeHandles();
}

export function removeFromSelection(object) {
    this.selection.remove(object);
    this.emit(Events.Tool.SelectionRemove, { object });
    this.updateResizeHandles();
}

export function clearSelection() {
    // Проверяем, что инструмент не уничтожен
    if (this.destroyed) {
        return;
    }

    const objects = this.selection.toArray();
    this.selection.clear();
    this.emit(Events.Tool.SelectionClear, { objects });
    this.updateResizeHandles();
}

export function selectAll() {
    // TODO: Выделить все объекты на доске
    this.emit(Events.Tool.SelectionAll);
}

export function deleteSelectedObjects() {
    const objects = this.selection.toArray();
    this.clearSelection();
    this.emit(Events.Tool.ObjectsDelete, { objects });
}

export function editObject(object) {
    this.emit(Events.Tool.ObjectEdit, { object });
}

export function getSelection() {
    return this.selection.toArray();
}

export function hasSelection() {
    return this.selection.size() > 0;
}

export function setSelection(objectIds) {
    if (this.textEditor?.active && !this._selectionSyncFromEditor) {
        if (this.textEditor.objectType === 'file' && typeof this._closeFileNameEditor === 'function') {
            this._closeFileNameEditor(true);
        } else if (typeof this._closeTextEditor === 'function') {
            this._closeTextEditor(true);
        }
    }
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

export function updateResizeHandles() {
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
    } catch (_) {
        // noop
    }
}

export function onActivateSelection() {
    // Подписка безопасна: EventBus простая шина, а вызов синхронный
    this.eventBus.on(Events.Tool.GetSelection, (data) => {
        data.selection = this.getSelection();
    });
}
