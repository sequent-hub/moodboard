import { BaseCommand } from './BaseCommand.js';
import { Events } from '../events/Events.js';

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function asEntryMap(entries) {
    const map = new Map();
    const src = entries && typeof entries === 'object' ? entries : {};
    Object.keys(src).forEach((id) => {
        const entry = src[id];
        if (!entry || typeof entry !== 'object') return;
        map.set(id, entry);
    });
    return map;
}

export class MindmapStatePatchCommand extends BaseCommand {
    constructor(core, beforeEntries, afterEntries, description = 'Снимок состояния mindmap') {
        super('mindmap-state-patch', description);
        this.core = core;
        this.beforeEntries = deepClone(beforeEntries || {});
        this.afterEntries = deepClone(afterEntries || {});
    }

    execute() {
        this._applyEntries(this.afterEntries);
    }

    undo() {
        this._applyEntries(this.beforeEntries);
    }

    _applyEntries(entries) {
        if (!this.core) return;
        const objects = this.core?.state?.state?.objects || [];
        const byId = new Map((Array.isArray(objects) ? objects : []).map((obj) => [obj?.id, obj]));
        const entryMap = asEntryMap(entries);
        entryMap.forEach((entry, id) => {
            const node = byId.get(id);
            if (!node || node.type !== 'mindmap') return;

            const position = entry?.position || {};
            const size = entry?.size || {};
            const properties = entry?.properties || {};

            const nextPos = {
                x: Math.round(Number(position?.x || 0)),
                y: Math.round(Number(position?.y || 0)),
            };
            const nextSize = {
                width: Math.max(1, Math.round(Number(size?.width || node.width || node?.properties?.width || 1))),
                height: Math.max(1, Math.round(Number(size?.height || node.height || node?.properties?.height || 1))),
            };

            this.core.updateObjectSizeAndPositionDirect(id, nextSize, nextPos, 'mindmap', { snap: false });

            node.properties = deepClone(properties);
            node.width = nextSize.width;
            node.height = nextSize.height;

            const pixiObject = this.core?.pixi?.objects?.get?.(id);
            const instance = pixiObject?._mb?.instance;
            if (pixiObject?._mb) pixiObject._mb.properties = node.properties;
            if (instance) {
                const props = node.properties || {};
                if (Number.isFinite(props.strokeColor)) instance.strokeColor = Math.floor(Number(props.strokeColor));
                if (Number.isFinite(props.fillColor)) instance.fillColor = Math.floor(Number(props.fillColor));
                if (Number.isFinite(props.fillAlpha)) instance.fillAlpha = Number(props.fillAlpha);
                if (Number.isFinite(props.strokeWidth)) instance.strokeWidth = Math.max(1, Math.round(Number(props.strokeWidth)));
                if (typeof instance._redrawPreserveTransform === 'function') {
                    instance._redrawPreserveTransform();
                } else if (typeof instance._draw === 'function') {
                    instance._draw();
                }
            }

            this.emit(Events.Object.TransformUpdated, { objectId: id });
            this.emit(Events.Object.Updated, { objectId: id });
        });
        this.core?.state?.markDirty?.();
    }
}

