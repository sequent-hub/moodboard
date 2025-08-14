/**
 * GroupRotateController — вращение группы объектов
 */
export class GroupRotateController {
    constructor({ emit, selection, getGroupBounds, ensureGroupGraphics, updateHandles }) {
        this.emit = emit;
        this.selection = selection;
        this.getGroupBounds = getGroupBounds;
        this.ensureGroupGraphics = ensureGroupGraphics;
        this.updateHandles = updateHandles; // функция для обновления ResizeHandles

        this.isActive = false;
        this.center = null;
        this.groupRotateBounds = null;
        this.rotateStartMouseAngle = 0;
        this.rotateCurrentAngle = 0;
    }

    start(currentMouse) {
        this.isActive = true;
        const gb = this.getGroupBounds();
        this.groupRotateBounds = gb;
        this.center = { x: gb.x + gb.width / 2, y: gb.y + gb.height / 2 };
        this.rotateStartMouseAngle = Math.atan2(currentMouse.y - this.center.y, currentMouse.x - this.center.x);
        // Настроим pivot и позицию group-bounds
        this.ensureGroupGraphics(gb);
        this.emit('group:rotate:start', { objects: this.selection.toArray(), center: this.center });
    }

    update(event) {
        if (!this.isActive || !this.center) return;
        const currentMouseAngle = Math.atan2(event.y - this.center.y, event.x - this.center.x);
        let delta = currentMouseAngle - this.rotateStartMouseAngle;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        let deltaDeg = delta * 180 / Math.PI;
        if (event.originalEvent && event.originalEvent.shiftKey) {
            deltaDeg = Math.round(deltaDeg / 15) * 15;
        }
        this.rotateCurrentAngle = deltaDeg;
        this.emit('group:rotate:update', { objects: this.selection.toArray(), center: this.center, angle: this.rotateCurrentAngle });
        // Вращение рамки группы вокруг центра — для согласованности ручек
        const angleRad = this.rotateCurrentAngle * Math.PI / 180;
        if (this.ensureGroupGraphics && this.groupRotateBounds) {
            // обновление ручек через внешний колбек
            if (typeof this.updateHandles === 'function') this.updateHandles();
        }
    }

    end() {
        if (!this.isActive) return;
        this.emit('group:rotate:end', { objects: this.selection.toArray(), angle: this.rotateCurrentAngle });
        this.isActive = false;
        this.center = null;
        this.groupRotateBounds = null;
        this.rotateStartMouseAngle = 0;
        this.rotateCurrentAngle = 0;
    }
}


