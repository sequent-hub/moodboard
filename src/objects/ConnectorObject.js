import * as PIXI from 'pixi.js';

/**
 * ConnectorObject — универсальный коннектор (стрелка/линия с привязкой к объектам).
 *
 * Визуальный рендер делегирован ConnectorLayer; здесь только тип, дефолты и сериализация.
 *
 * properties:
 *   start  — { boundId, anchor:{x,y}, isPrecise, isExact } | { point:{x,y} }
 *   end    — то же
 *   style  — { stroke, width, dash, head:{start,end}, route }
 *
 * position/size номинальны (bounding box линии); реальная геометрия — из терминалов.
 */
export class ConnectorObject {
    constructor(objectData = {}) {
        this.objectData = objectData;

        // Номинальные размеры (bbox); реальная геометрия — из терминалов
        this.width  = objectData.width  ?? 0;
        this.height = objectData.height ?? 0;

        const props = objectData.properties || {};

        this.start = props.start || { point: { x: 0, y: 0 } };
        this.end   = props.end   || { point: { x: 100, y: 0 } };

        this.style = {
            stroke: 0x2563EB,
            width:  2,
            dash:   false,
            head: { start: false, end: true },
            route: 'straight',
            ...(props.style || {}),
        };

        // Невидимый контейнер-заглушка: реальный рендер в ConnectorLayer
        this._container = new PIXI.Container();
        this._container.visible = false;
        this._container.eventMode = 'none';

        this._container._mb = {
            type:       'connector',
            instance:   this,
            properties: this._buildProperties(),
        };
    }

    _buildProperties() {
        return {
            start: this.start,
            end:   this.end,
            style: { ...this.style, head: { ...this.style.head } },
        };
    }

    getPixi() {
        return this._container;
    }

    /** Обновляет терминалы и/или стиль; синхронизирует _mb.properties */
    setProperties({ start, end, style } = {}) {
        if (start !== undefined) this.start = start;
        if (end   !== undefined) this.end   = end;
        if (style !== undefined) this.style = { ...this.style, ...style };

        if (this._container?._mb) {
            this._container._mb.properties = this._buildProperties();
        }
    }

    /** Обновляет номинальные размеры (используется ядром при resize) */
    updateSize(size) {
        if (!size) return;
        if (size.width  != null) this.width  = size.width;
        if (size.height != null) this.height = size.height;
    }

    destroy() {
        if (this._container) {
            try { this._container.destroy(); } catch (_) {}
            this._container = null;
        }
    }
}
