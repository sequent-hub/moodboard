import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';

export class HandlesPositioningService {
    constructor(host) {
        this.host = host;
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
            left: Math.round(offsetLeft + tl.x),
            top: Math.round(offsetTop + tl.y),
            width: Math.round(Math.max(1, br.x - tl.x)),
            height: Math.round(Math.max(1, br.y - tl.y)),
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
            const p = this.host.core.pixi.objects.get(id);
            if (!p) return;
            const b = p.getBounds();
            const tl = world.toLocal(new PIXI.Point(b.x, b.y));
            const br = world.toLocal(new PIXI.Point(b.x + b.width, b.y + b.height));
            const x0 = Math.min(tl.x, br.x);
            const y0 = Math.min(tl.y, br.y);
            const x1 = Math.max(tl.x, br.x);
            const y1 = Math.max(tl.y, br.y);
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
