/**
 * ResizeController — изменение размера одного объекта (не группы)
 */
export class ResizeController {
    constructor({ emit, getRotation }) {
        this.emit = emit;
        this.getRotation = getRotation;
        this.isResizing = false;
        this.resizeHandle = null;
        this.dragTarget = null;
        this.resizeStartBounds = null;
        this.resizeStartMousePos = null;
        this.resizeStartPosition = null;
    }

    start(handle, objectId, currentMouse) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.dragTarget = objectId;
        const sizeData = { objectId, size: null };
        this.emit('get:object:size', sizeData);
        const positionData = { objectId, position: null };
        this.emit('get:object:position', positionData);
        this.resizeStartBounds = sizeData.size || { width: 100, height: 100 };
        this.resizeStartMousePos = { x: currentMouse.x, y: currentMouse.y };
        this.resizeStartPosition = positionData.position || { x: 0, y: 0 };
        this.emit('resize:start', { object: objectId, handle });
    }

    update(event, helpers) {
        if (!this.isResizing || !this.resizeStartBounds || !this.resizeStartMousePos) return;
        const { calculateNewSize, calculatePositionOffset } = helpers;
        const deltaX = event.x - this.resizeStartMousePos.x;
        const deltaY = event.y - this.resizeStartMousePos.y;
        const maintainAspectRatio = !!(event.originalEvent && event.originalEvent.shiftKey);
        const newSize = calculateNewSize(this.resizeHandle, this.resizeStartBounds, deltaX, deltaY, maintainAspectRatio);
        newSize.width = Math.max(20, newSize.width);
        newSize.height = Math.max(20, newSize.height);
        const rotation = this.getRotation ? (this.getRotation(this.dragTarget) || 0) : 0;
        const positionOffset = calculatePositionOffset(this.resizeHandle, this.resizeStartBounds, newSize, rotation);
        const newPosition = { x: this.resizeStartPosition.x + positionOffset.x, y: this.resizeStartPosition.y + positionOffset.y };
        this.emit('resize:update', { object: this.dragTarget, handle: this.resizeHandle, size: newSize, position: newPosition });
    }

    end() {
        if (this.isResizing && this.dragTarget) {
            const finalSizeData = { objectId: this.dragTarget, size: null };
            this.emit('get:object:size', finalSizeData);
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
        this.isResizing = false;
        this.resizeHandle = null;
        this.dragTarget = null;
        this.resizeStartBounds = null;
        this.resizeStartMousePos = null;
        this.resizeStartPosition = null;
    }
}


