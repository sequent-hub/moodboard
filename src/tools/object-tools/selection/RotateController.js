/**
 * RotateController — вращение одного объекта (не группы)
 */
export class RotateController {
    constructor({ emit }) {
        this.emit = emit;
        this.isRotating = false;
        this.dragTarget = null;
        this.rotateCenter = null;
        this.rotateStartAngle = 0; // начальный угол объекта
        this.rotateStartMouseAngle = 0; // начальный угол мыши от центра
        this.rotateCurrentAngle = 0;
    }

    start(objectId, currentMouse, center) {
        this.isRotating = true;
        this.dragTarget = objectId;
        // Текущий угол объекта
        const rotationData = { objectId, rotation: 0 };
        this.emit('get:object:rotation', rotationData);
        this.rotateStartAngle = rotationData.rotation || 0;
        this.rotateCurrentAngle = this.rotateStartAngle;
        // Центр вращения приходит снаружи (рассчитан по pos+size)
        this.rotateCenter = center;
        this.rotateStartMouseAngle = Math.atan2(currentMouse.y - center.y, currentMouse.x - center.x);
        this.emit('rotate:start', { object: objectId });
    }

    update(event) {
        if (!this.isRotating || !this.rotateCenter) return;
        const currentMouseAngle = Math.atan2(event.y - this.rotateCenter.y, event.x - this.rotateCenter.x);
        let delta = currentMouseAngle - this.rotateStartMouseAngle;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        let deltaDeg = delta * 180 / Math.PI;
        if (event.originalEvent && event.originalEvent.shiftKey) {
            deltaDeg = Math.round(deltaDeg / 15) * 15;
        }
        this.rotateCurrentAngle = this.rotateStartAngle + deltaDeg;
        while (this.rotateCurrentAngle < 0) this.rotateCurrentAngle += 360;
        while (this.rotateCurrentAngle >= 360) this.rotateCurrentAngle -= 360;
        this.emit('rotate:update', { object: this.dragTarget, angle: this.rotateCurrentAngle });
    }

    end() {
        if (this.isRotating && this.dragTarget) {
            this.emit('rotate:end', { object: this.dragTarget, oldAngle: this.rotateStartAngle, newAngle: this.rotateCurrentAngle });
        }
        this.isRotating = false;
        this.dragTarget = null;
        this.rotateCenter = null;
        this.rotateStartAngle = 0;
        this.rotateStartMouseAngle = 0;
        this.rotateCurrentAngle = 0;
    }
}


