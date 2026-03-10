import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';

export class HandlesPositioningService {
    constructor(host) {
        this.host = host;
    }

    _rotatePoint(point, center, angleDegrees) {
        const angleRad = angleDegrees * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return {
            x: center.x + dx * cos - dy * sin,
            y: center.y + dx * sin + dy * cos,
        };
    }

    _getWorldRectFromState(position, size, rotation = 0) {
        if (!position || !size) return null;
        const width = Math.max(1, size.width || 1);
        const height = Math.max(1, size.height || 1);
        if (Math.abs(rotation || 0) < 0.001) {
            return {
                x: position.x,
                y: position.y,
                width,
                height,
            };
        }

        const center = {
            x: position.x + width / 2,
            y: position.y + height / 2,
        };
        const corners = [
            { x: position.x, y: position.y },
            { x: position.x + width, y: position.y },
            { x: position.x + width, y: position.y + height },
            { x: position.x, y: position.y + height },
        ].map((point) => this._rotatePoint(point, center, rotation));

        const xs = corners.map((point) => point.x);
        const ys = corners.map((point) => point.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
        };
    }

    toWorldScreenInverse(dx, dy) {
        const world = this.host.core.pixi.worldLayer || this.host.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        return { dxWorld: dx / s, dyWorld: dy / s };
    }

    getViewportOffsets() {
        const containerRect = this.host.container.getBoundingClientRect();
        const view = this.host.core.pixi.app.view;
        const viewRect = view.getBoundingClientRect();
        return {
            offsetLeft: viewRect.left - containerRect.left,
            offsetTop: viewRect.top - containerRect.top,
        };
    }

    getWorldTransform() {
        const world = this.host.core.pixi.worldLayer || this.host.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const tx = world?.x || 0;
        const ty = world?.y || 0;
        const rendererRes = (this.host.core.pixi.app.renderer?.resolution) || 1;
        return { world, s, tx, ty, rendererRes };
    }

    worldBoundsToCssRect(worldBounds) {
        const { world } = this.getWorldTransform();
        const { offsetLeft, offsetTop } = this.getViewportOffsets();
        const tl = world.toGlobal(new PIXI.Point(worldBounds.x, worldBounds.y));
        const br = world.toGlobal(new PIXI.Point(worldBounds.x + worldBounds.width, worldBounds.y + worldBounds.height));
        return {
            left: offsetLeft + tl.x,
            top: offsetTop + tl.y,
            width: Math.max(1, br.x - tl.x),
            height: Math.max(1, br.y - tl.y),
            offsetLeft,
            offsetTop,
        };
    }

    cssRectToWorldRect(cssRect, offsets = null) {
        const { s, tx, ty, rendererRes } = this.getWorldTransform();
        const { offsetLeft, offsetTop } = offsets || this.getViewportOffsets();
        const screenX = cssRect.left - offsetLeft;
        const screenY = cssRect.top - offsetTop;
        return {
            x: ((screenX * rendererRes) - tx) / s,
            y: ((screenY * rendererRes) - ty) / s,
            width: (cssRect.width * rendererRes) / s,
            height: (cssRect.height * rendererRes) / s,
        };
    }

    getSingleSelectionWorldBounds(id, pixi) {
        const positionData = { objectId: id, position: null };
        const sizeData = { objectId: id, size: null };
        this.host.eventBus.emit(Events.Tool.GetObjectPosition, positionData);
        this.host.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (positionData.position && sizeData.size) {
            return {
                x: positionData.position.x,
                y: positionData.position.y,
                width: sizeData.size.width,
                height: sizeData.size.height,
            };
        }

        const { world } = this.getWorldTransform();
        const b = pixi.getBounds();
        const tl = world.toLocal(new PIXI.Point(b.x, b.y));
        const br = world.toLocal(new PIXI.Point(b.x + b.width, b.y + b.height));
        const wx = Math.min(tl.x, br.x);
        const wy = Math.min(tl.y, br.y);
        const ww = Math.max(1, Math.abs(br.x - tl.x));
        const wh = Math.max(1, Math.abs(br.y - tl.y));
        return { x: wx, y: wy, width: ww, height: wh };
    }

    getGroupSelectionWorldBounds(ids) {
        const { world } = this.getWorldTransform();
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        ids.forEach((id) => {
            const positionData = { objectId: id, position: null };
            const sizeData = { objectId: id, size: null };
            const rotationData = { objectId: id, rotation: 0 };
            this.host.eventBus.emit(Events.Tool.GetObjectPosition, positionData);
            this.host.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
            this.host.eventBus.emit(Events.Tool.GetObjectRotation, rotationData);

            const rectFromState = this._getWorldRectFromState(
                positionData.position,
                sizeData.size,
                rotationData.rotation || 0
            );

            let x0;
            let y0;
            let x1;
            let y1;

            if (rectFromState) {
                x0 = rectFromState.x;
                y0 = rectFromState.y;
                x1 = rectFromState.x + rectFromState.width;
                y1 = rectFromState.y + rectFromState.height;
            } else {
                const p = this.host.core.pixi.objects.get(id);
                if (!p) return;
                const b = p.getBounds();
                const tl = world.toLocal(new PIXI.Point(b.x, b.y));
                const br = world.toLocal(new PIXI.Point(b.x + b.width, b.y + b.height));
                x0 = Math.min(tl.x, br.x);
                y0 = Math.min(tl.y, br.y);
                x1 = Math.max(tl.x, br.x);
                y1 = Math.max(tl.y, br.y);
            }

            minX = Math.min(minX, x0);
            minY = Math.min(minY, y0);
            maxX = Math.max(maxX, x1);
            maxY = Math.max(maxY, y1);
        });

        if (!isFinite(minX)) return null;
        return {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
        };
    }

    cssPointToWorld(centerX, centerY) {
        const { s, tx, ty, rendererRes } = this.getWorldTransform();
        const { offsetLeft, offsetTop } = this.getViewportOffsets();
        const screenX = centerX - offsetLeft;
        const screenY = centerY - offsetTop;
        return {
            x: ((screenX * rendererRes) - tx) / s,
            y: ((screenY * rendererRes) - ty) / s,
        };
    }
}
