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
        this.cursor = 'crosshair';
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
}
