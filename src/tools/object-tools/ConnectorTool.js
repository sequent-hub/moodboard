import { BaseTool } from '../BaseTool.js';
import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import {
    terminalWorldPoint,
    computeAnchor,
    drawPreview,
    createConnectorFromTerminals,
} from './connector/connectorGesture.js';

/**
 * ConnectorTool — инструмент рисования универсальных коннекторов.
 *
 * Сценарий: зажать на объекте-источнике (или пустом холсте) → тянуть →
 * отпустить на объекте-цели (или пустом холсте).
 *
 * Свободные концы разрешены. Привязанный терминал хранит нормализованный
 * якорь по позиции клика внутри bbox объекта (isPrecise=true, isExact=false).
 */
export class ConnectorTool extends BaseTool {
    constructor(eventBus, core = null) {
        super('connector', eventBus);
        this.cursor = 'crosshair';
        this.hotkey = null;
        this.core = core;

        this.app = null;
        this.world = null;
        this._isDragging = false;
        this._sourceTerminal = null;
        this._previewGraphics = null;
    }

    /** Принимает pixiApp от ToolActivationController (как DrawingTool). */
    activate(app) {
        super.activate();
        this.app = app;
        this.world = this._getWorldLayer();
        if (this.app && this.app.view) {
            this.app.view.style.cursor = this.cursor;
        }
    }

    deactivate() {
        super.deactivate();
        this._clearPreview();
        this._isDragging = false;
        this._sourceTerminal = null;
        if (this.app && this.app.view) {
            this.app.view.style.cursor = '';
        }
        this.app = null;
        this.world = null;
    }

    onMouseDown(event) {
        super.onMouseDown(event);
        if (!this.world) this.world = this._getWorldLayer();
        if (!this.world) return;

        const worldPt = this._toWorld(event.x, event.y);

        const hitData = { x: event.x, y: event.y, result: null };
        this.eventBus.emit(Events.Tool.HitTest, hitData);

        if (hitData.result && hitData.result.object) {
            const objectId = hitData.result.object;
            const anchor = computeAnchor(this.eventBus, objectId, worldPt);
            this._sourceTerminal = { boundId: objectId, anchor, isPrecise: true, isExact: false };
        } else {
            this._sourceTerminal = { point: worldPt };
        }

        this._isDragging = true;
        this._previewGraphics = new PIXI.Graphics();
        this.world.addChild(this._previewGraphics);
    }

    onMouseMove(event) {
        super.onMouseMove(event);
        if (!this._isDragging || !this._previewGraphics) return;
        const worldPt = this._toWorld(event.x, event.y);
        this._drawPreview(worldPt);
    }

    onMouseUp(event) {
        super.onMouseUp(event);
        if (!this._isDragging) return;

        const worldPt = this._toWorld(event.x, event.y);

        const hitData = { x: event.x, y: event.y, result: null };
        this.eventBus.emit(Events.Tool.HitTest, hitData);

        let endTerminal;
        if (hitData.result && hitData.result.object) {
            const objectId = hitData.result.object;
            const anchor = computeAnchor(this.eventBus, objectId, worldPt);
            endTerminal = { boundId: objectId, anchor, isPrecise: true, isExact: false };
        } else {
            endTerminal = { point: worldPt };
        }

        this._clearPreview();
        this._isDragging = false;

        if (this.core && this._sourceTerminal) {
            createConnectorFromTerminals(this.core, this.eventBus, this._sourceTerminal, endTerminal);
        }

        this._sourceTerminal = null;
    }

    // ─── Превью ─────────────────────────────────────────────────────────────

    _drawPreview(worldPt) {
        const from = terminalWorldPoint(this.eventBus, this._sourceTerminal);
        drawPreview(this._previewGraphics, from, worldPt);
    }

    _clearPreview() {
        if (!this._previewGraphics) return;
        if (this._previewGraphics.parent) {
            this._previewGraphics.parent.removeChild(this._previewGraphics);
        }
        this._previewGraphics.destroy();
        this._previewGraphics = null;
    }

    // ─── Координаты ─────────────────────────────────────────────────────────

    /**
     * Screen-space → world-space через PIXI worldLayer.toLocal (как DrawingTool._toWorld).
     */
    _toWorld(x, y) {
        if (!this.world) return { x, y };
        const p = new PIXI.Point(x, y);
        const local = this.world.toLocal(p);
        return { x: local.x, y: local.y };
    }

    _getWorldLayer() {
        if (!this.app || !this.app.stage) return null;
        const world = this.app.stage.getChildByName && this.app.stage.getChildByName('worldLayer');
        return world || this.app.stage;
    }
}
