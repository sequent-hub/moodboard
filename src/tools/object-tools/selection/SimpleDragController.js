/**
 * SimpleDragController — управляет перетаскиванием одного объекта
 * Делегирует в ядро события drag:start/update/end
 */
export class SimpleDragController {
    constructor({ emit }) {
        this.emit = emit;
        this.active = false;
        this.dragTarget = null;
        this.offset = { x: 0, y: 0 };
    }

    start(objectId, event) {
        this.active = true;
        this.dragTarget = objectId;
        // Получаем текущую позицию объекта
        const objectData = { objectId, position: null };
        this.emit('get:object:position', objectData);
        if (objectData.position) {
            this.offset = { x: event.x - objectData.position.x, y: event.y - objectData.position.y };
        } else {
            this.offset = { x: 0, y: 0 };
        }
        // Позиция и координаты — уже в мировых координатах (SelectTool нормализует)
        this.emit('drag:start', { object: objectId, position: { x: event.x, y: event.y } });
    }

    update(event) {
        if (!this.active || !this.dragTarget) return;
        const newX = event.x - this.offset.x;
        const newY = event.y - this.offset.y;
        this.emit('drag:update', { object: this.dragTarget, position: { x: newX, y: newY } });
    }

    end() {
        if (!this.active) return;
        if (this.dragTarget) {
            this.emit('drag:end', { object: this.dragTarget });
        }
        this.active = false;
        this.dragTarget = null;
    }
}


