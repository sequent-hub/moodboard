import { BaseTool } from '../BaseTool.js';
import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import {
    terminalWorldPoint,
    computeAnchor,
    drawPreview,
    createConnectorFromTerminals,
    objectBounds,
} from './connector/connectorGesture.js';
import {
    getObjectPorts,
    findNearestPort,
    portAvailabilityRule,
    portTargetRule,
    soleCompatiblePort,
    terminalForPort,
    PORT_SNAP_CSS,
} from '../../services/ConnectorPortRegistry.js';
import { canConnectTerminals } from '../../services/ai/imageGeneratorContract.js';
import { CONNECTOR_Z_INDEX } from '../../ui/connectors/ConnectorLayer.js';

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
            // Начало жеста: пары портов ещё нет, проверяем только занятость.
            this._sourceTerminal = this._terminalForObject(objectId, worldPt, portAvailabilityRule(this._objects()));
        } else {
            this._sourceTerminal = { point: worldPt };
        }

        this._isDragging = true;
        this._previewGraphics = new PIXI.Graphics();
        this._previewGraphics.zIndex = CONNECTOR_Z_INDEX;
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
            const rule = portTargetRule(this._objects(), this._sourceTerminal?.portId || null);
            endTerminal = this._terminalForObject(hitData.result.object, worldPt, rule);
        } else {
            endTerminal = { point: worldPt };
        }

        this._clearPreview();
        this._isDragging = false;

        // Связь от порта результата допустима только со входом изображения.
        if (this.core && this._sourceTerminal && canConnectTerminals(this._sourceTerminal, endTerminal)) {
            createConnectorFromTerminals(this.core, this.eventBus, this._sourceTerminal, endTerminal);
        }

        this._sourceTerminal = null;
    }

    /**
     * Терминал для объекта под курсором: у объектов с именованными портами
     * связь примагничивается к ближайшему порту, у остальных — как раньше,
     * к произвольной точке внутри bbox.
     *
     * @param {string} objectId
     * @param {{x: number, y: number}} worldPt
     * @param {((port: object, targetId: string) => boolean)|null} [rule=null] правило выбора порта
     * @returns {object}
     */
    _terminalForObject(objectId, worldPt, rule = null) {
        const ports = getObjectPorts(this.eventBus, objectId);
        if (ports.length > 0) {
            const bounds = objectBounds(this.eventBus, objectId);
            const port = findNearestPort(
                ports,
                bounds,
                worldPt,
                this.world?.scale?.x || 1,
                PORT_SNAP_CSS,
                rule ? (candidate) => rule(candidate, objectId) : null,
            ) || soleCompatiblePort(ports, rule, objectId);
            if (port) return terminalForPort(objectId, port);
        }

        return {
            boundId: objectId,
            anchor: computeAnchor(this.eventBus, objectId, worldPt),
            isPrecise: true,
            isExact: false,
        };
    }

    _objects() {
        return this.core?.state?.getObjects ? this.core.state.getObjects() : [];
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
