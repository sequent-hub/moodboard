import { BaseTool } from '../BaseTool.js';

// Новый упрощенный PanTool: только drag-логика, без инерции и колесика
export class PanTool extends BaseTool {
    constructor(eventBus) {
        super('pan', eventBus);
        // По умолчанию курсор для панорамирования — системный move
        this.cursor = 'move';
        this.isDragging = false;
        this.last = { x: 0, y: 0 };
        this.app = null;
    }

    /**
     * Активация инструмента панорамирования
     * @param {PIXI.Application} app
     */
    activate(app) {
        super.activate();
        this.app = app || this.app;
        // При активации сразу показываем курсор move
        this.cursor = 'move';
        this.setCursor();
    }

    onMouseDown(event) {
        // ЛКМ или средняя кнопка
        if (event.button === 0 || event.button === 1) {
            this.isDragging = true;
            this.last = { x: event.x, y: event.y };
            // Во время активного drag оставляем курсор move,
            // чтобы пользователь всегда видел иконку перемещения
            this.cursor = 'move';
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
            // После завершения drag возвращаем курсор move
            this.cursor = 'move';
            this.setCursor();
        }
    }

    onDeactivate() {
        this.isDragging = false;
        // Сбрасываем курсор на стандартный для canvas
        this.cursor = '';
        this.setCursor();
        super.onDeactivate();
    }

    /**
     * Устанавливает курсор на canvas PIXI
     */
    setCursor() {
        if (this.app && this.app.view) {
            this.app.view.style.cursor = this.cursor || '';
        }
    }
}
