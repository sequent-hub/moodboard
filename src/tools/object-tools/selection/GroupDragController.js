/**
 * GroupDragController — перетаскивание группы объектов + Alt-клонирование группы
 */
export class GroupDragController {
    constructor({ emit, selection, updateGroupBoundsByTopLeft }) {
        this.emit = emit;
        this.selection = selection;
        this.updateGroupBoundsByTopLeft = updateGroupBoundsByTopLeft; // (topLeft)=>void

        this.isActive = false;
        this.groupStartBounds = null;
        this.groupDragOffset = null;
        this.isAltGroupCloneMode = false;
        this.groupClonePending = false;
        this.groupCloneOriginalIds = [];
    }

    start(groupBounds, mouse) {
        this.isActive = true;
        this.groupStartBounds = groupBounds;
        this.groupDragOffset = { x: mouse.x - groupBounds.x, y: mouse.y - groupBounds.y };
    }

    update(event) {
        if (!this.isActive || !this.groupStartBounds || !this.groupDragOffset) return;

        // Alt-клонирование группы на лету
        if (event.originalEvent && event.originalEvent.altKey && !this.isAltGroupCloneMode && !this.groupClonePending) {
            this.isAltGroupCloneMode = true;
            this.groupClonePending = true;
            this.groupCloneOriginalIds = this.selection.toArray();
            this.emit('group:duplicate:request', { objects: this.groupCloneOriginalIds });
            return;
        }

        const newTopLeft = { x: event.x - this.groupDragOffset.x, y: event.y - this.groupDragOffset.y };
        const delta = { dx: newTopLeft.x - this.groupStartBounds.x, dy: newTopLeft.y - this.groupStartBounds.y };
        this.emit('group:drag:update', { objects: this.selection.toArray(), delta });
        if (this.updateGroupBoundsByTopLeft) this.updateGroupBoundsByTopLeft(newTopLeft);
    }

    end() {
        if (!this.isActive) return;
        this.emit('group:drag:end', { objects: this.selection.toArray() });
        this.isActive = false;
        this.groupStartBounds = null;
        this.groupDragOffset = null;
        this.isAltGroupCloneMode = false;
        this.groupClonePending = false;
        this.groupCloneOriginalIds = [];
    }

    onGroupDuplicateReady(map) {
        if (!this.groupClonePending) return;
        // Перенос ответственности за обработку idMap оставляем SelectTool
        this.groupClonePending = false;
        this.isAltGroupCloneMode = false;
    }
}


