import { Events } from '../../../core/events/Events.js';

export function tryStartAltCloneDuringDrag(event) {
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
}

export function resetCloneStateAfterDragEnd() {
    this.isAltGroupCloneMode = false;
    this.groupClonePending = false;
    this.groupCloneOriginalIds = [];
    this.groupCloneMap = null;
    this.isAltCloneMode = false;
    this.clonePending = false;
    this.cloneSourceId = null;
}

export function onGroupDuplicateReady(idMap) {
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

export function onDuplicateReady(newObjectId) {
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
