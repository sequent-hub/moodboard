import * as PIXI from 'pixi.js';
import { BaseTool } from '../BaseTool.js';
import { Events } from '../../core/events/Events.js';

/**
 * Инструмент «комментарий» — клик по холсту открывает черновик треда у world-точки.
 */
export class CommentTool extends BaseTool {
    constructor(eventBus, core, commentService, threadPopover) {
        super('comment', eventBus);
        this.core = core;
        this.commentService = commentService;
        this.threadPopover = threadPopover;
        this.cursor = CommentTool._buildCursor();
        this.app = null;
        this.world = null;
    }

    activate(app) {
        super.activate(app);
        this.app = app;
        this.world = this.core?.pixi?.worldLayer || app?.stage;
        if (this.app?.view) {
            this.app.view.style.cursor = this.cursor;
        }
    }

    deactivate() {
        if (this.app?.view) this.app.view.style.cursor = '';
        this.app = null;
        this.world = null;
        super.deactivate();
    }

    onMouseDown(event) {
        super.onMouseDown(event);
        if (!this.world) return;

        const worldPt = this._toWorld(event.x, event.y);
        const hitData = { x: event.x, y: event.y, result: null };
        this.eventBus.emit(Events.Tool.HitTest, hitData);

        let anchor = null;
        if (hitData.result?.object) {
            const objectId = hitData.result.object;
            const pos = { objectId, position: null };
            this.eventBus.emit(Events.Tool.GetObjectPosition, pos);
            if (pos.position) {
                anchor = {
                    anchor_object_id: objectId,
                    anchor_dx: worldPt.x - pos.position.x,
                    anchor_dy: worldPt.y - pos.position.y,
                };
            }
        }

        this.threadPopover?.openDraftAt(
            { x: worldPt.x, y: worldPt.y },
            anchor
        );
        this.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
    }

    _toWorld(x, y) {
        if (!this.world) return { x, y };
        const local = this.world.toLocal(new PIXI.Point(x, y));
        return { x: local.x, y: local.y };
    }

    /**
     * Строит CSS-курсор: залитый пузырь комментария с острым углом снизу слева.
     * Hotspot совпадает с острием уголка (2, 30).
     */
    static _buildCursor() {
        const svg = [
            '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
            '<path d="M12 2 C6.477 2 2 6.477 2 12 C2 14.8 3.1 17.3 5 19.2 L2 22 L7 20.5',
            ' C8.5 21.4 10.2 22 12 22 C17.523 22 22 17.523 22 12 C22 6.477 17.523 2 12 2 Z"',
            ' fill="#193042" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>',
            '</svg>',
        ].join('');
        const url = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
        return `${url} 2 22, crosshair`;
    }
}
