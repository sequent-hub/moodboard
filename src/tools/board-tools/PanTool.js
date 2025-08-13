import { BaseTool } from '../BaseTool.js';

// Новый упрощенный PanTool: только drag-логика, без инерции и колесика
export class PanTool extends BaseTool {
    constructor(eventBus) {
        super('pan', eventBus);
        this.cursor = 'grab';
        this.isDragging = false;
        this.last = { x: 0, y: 0 };
    }

    onMouseDown(event) {
        // ЛКМ или средняя кнопка
        if (event.button === 0 || event.button === 1) {
            this.isDragging = true;
            this.last = { x: event.x, y: event.y };
            this.cursor = 'grabbing';
            this.setCursor();
        }
    }

    onMouseMove(event) {
        if (!this.isDragging) return;
        const dx = event.x - this.last.x;
        const dy = event.y - this.last.y;
        this.last = { x: event.x, y: event.y };
        this.emit('pan:update', { delta: { x: dx, y: dy } });
    }

    onMouseUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.cursor = 'grab';
            this.setCursor();
        }
    }

    onDeactivate() {
        this.isDragging = false;
        this.cursor = 'default';
        this.setCursor();
    }
}
