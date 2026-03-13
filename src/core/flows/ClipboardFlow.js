import { Events } from '../events/Events.js';
import { PasteObjectCommand } from '../commands/index.js';
import { RevitScreenshotMetadataService } from '../../services/RevitScreenshotMetadataService.js';

export function setupClipboardFlow(core) {
    const revitMetadataService = new RevitScreenshotMetadataService(console);

    const resolveRevitImagePayload = async (src, context = {}) => {
        const meta = await revitMetadataService.extractFromImageSource(src, context);
        if (meta.hasMetadata && meta.payload) {
            return {
                type: 'revit-screenshot-img',
                properties: { view: meta.payload }
            };
        }
        return {
            type: 'image',
            properties: {}
        };
    };

    core.eventBus.on(Events.UI.CopyObject, ({ objectId }) => {
        if (!objectId) return;
        core.copyObject(objectId);
    });

    core.eventBus.on(Events.UI.CopyGroup, () => {
        if (core.toolManager.getActiveTool()?.name !== 'select') return;
        const selected = Array.from(core.toolManager.getActiveTool().selectedObjects || []);
        if (selected.length <= 1) return;
        const objects = core.state.state.objects || [];
        const groupData = selected
            .map(id => objects.find(o => o.id === id))
            .filter(Boolean)
            .map(o => JSON.parse(JSON.stringify(o)));
        if (groupData.length === 0) return;
        core.clipboard = {
            type: 'group',
            data: groupData,
            meta: { pasteCount: 0 }
        };
    });

    core.eventBus.on(Events.UI.PasteAt, ({ x, y }) => {
        if (!core.clipboard) return;
        if (core.clipboard.type === 'object') {
            core.pasteObject({ x, y });
        } else if (core.clipboard.type === 'group') {
            const group = core.clipboard;
            const data = Array.isArray(group.data) ? group.data : [];
            if (data.length === 0) return;

            if (group.meta && group.meta.frameBundle) {
                let minX = Infinity;
                let minY = Infinity;
                data.forEach(o => {
                    if (!o || !o.position) return;
                    minX = Math.min(minX, o.position.x);
                    minY = Math.min(minY, o.position.y);
                });
                if (!isFinite(minX) || !isFinite(minY)) return;
                const baseX = minX;
                const baseY = minY;

                const frames = data.filter(o => o && o.type === 'frame');
                if (frames.length !== 1) {
                    const newIds = [];
                    let pending = data.length;
                    const onPasted = (payload) => {
                        if (!payload || !payload.newId) return;
                        newIds.push(payload.newId);
                        pending -= 1;
                        if (pending === 0) {
                            core.eventBus.off(Events.Object.Pasted, onPasted);
                            requestAnimationFrame(() => {
                                if (core.selectTool && newIds.length > 0) {
                                    core.selectTool.setSelection(newIds);
                                    core.selectTool.updateResizeHandles();
                                }
                            });
                        }
                    };
                    core.eventBus.on(Events.Object.Pasted, onPasted);
                    data.forEach(orig => {
                        const cloned = JSON.parse(JSON.stringify(orig));
                        const targetPos = {
                            x: x + (cloned.position.x - baseX),
                            y: y + (cloned.position.y - baseY)
                        };
                        core.clipboard = { type: 'object', data: cloned };
                        const cmd = new PasteObjectCommand(core, targetPos);
                        cmd.setEventBus(core.eventBus);
                        core.history.executeCommand(cmd);
                    });
                    core.clipboard = group;
                    return;
                }

                const frameOriginal = frames[0];
                const children = data.filter(o => o && o.id !== frameOriginal.id);
                const totalToPaste = 1 + children.length;
                const newIds = [];
                let pastedCount = 0;
                let newFrameId = null;

                const onPasted = (payload) => {
                    if (!payload || !payload.newId) return;
                    newIds.push(payload.newId);
                    pastedCount += 1;
                    if (!newFrameId && payload.originalId === frameOriginal.id) {
                        newFrameId = payload.newId;
                        for (const child of children) {
                            const clonedChild = JSON.parse(JSON.stringify(child));
                            clonedChild.properties = clonedChild.properties || {};
                            clonedChild.properties.frameId = newFrameId;
                            const targetPos = {
                                x: x + (clonedChild.position.x - baseX),
                                y: y + (clonedChild.position.y - baseY)
                            };
                            core.clipboard = { type: 'object', data: clonedChild };
                            const cmdChild = new PasteObjectCommand(core, targetPos);
                            cmdChild.setEventBus(core.eventBus);
                            core.history.executeCommand(cmdChild);
                        }
                    }
                    if (pastedCount === totalToPaste) {
                        core.eventBus.off(Events.Object.Pasted, onPasted);
                        requestAnimationFrame(() => {
                            if (core.selectTool && newIds.length > 0) {
                                core.selectTool.setSelection(newIds);
                                core.selectTool.updateResizeHandles();
                            }
                        });
                    }
                };
                core.eventBus.on(Events.Object.Pasted, onPasted);

                const frameClone = JSON.parse(JSON.stringify(frameOriginal));
                core.clipboard = { type: 'object', data: frameClone };
                const targetPosFrame = {
                    x: x + (frameClone.position.x - baseX),
                    y: y + (frameClone.position.y - baseY)
                };
                const cmdFrame = new PasteObjectCommand(core, targetPosFrame);
                cmdFrame.setEventBus(core.eventBus);
                core.history.executeCommand(cmdFrame);
                core.clipboard = group;
                return;
            }

            const newIds = [];
            let pending = data.length;
            const onPasted = (payload) => {
                if (!payload || !payload.newId) return;
                newIds.push(payload.newId);
                pending -= 1;
                if (pending === 0) {
                    core.eventBus.off(Events.Object.Pasted, onPasted);
                    requestAnimationFrame(() => {
                        if (core.selectTool && newIds.length > 0) {
                            core.selectTool.setSelection(newIds);
                            core.selectTool.updateResizeHandles();
                        }
                    });
                }
            };
            core.eventBus.on(Events.Object.Pasted, onPasted);
            data.forEach(orig => {
                const cloned = JSON.parse(JSON.stringify(orig));
                const targetPos = {
                    x: x + (cloned.position.x - minX),
                    y: y + (cloned.position.y - minY)
                };
                core.clipboard = { type: 'object', data: cloned };
                const cmd = new PasteObjectCommand(core, targetPos);
                cmd.setEventBus(core.eventBus);
                core.history.executeCommand(cmd);
            });
            core.clipboard = group;
        }
    });

    core._cursor = { x: null, y: null };
    core.eventBus.on(Events.UI.CursorMove, ({ x, y }) => {
        core._cursor.x = x;
        core._cursor.y = y;
    });

    core.eventBus.on(Events.UI.PasteImage, ({ src, name, imageId }) => {
        if (!src) return;
        const view = core.pixi.app.view;
        const world = core.pixi.worldLayer || core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const hasCursor = Number.isFinite(core._cursor.x) && Number.isFinite(core._cursor.y);

        let screenX;
        let screenY;
        if (hasCursor) {
            screenX = core._cursor.x;
            screenY = core._cursor.y;
        } else {
            screenX = view.clientWidth / 2;
            screenY = view.clientHeight / 2;
        }

        const worldX = (screenX - (world?.x || 0)) / s;
        const worldY = (screenY - (world?.y || 0)) / s;

        const placeWithAspect = async (natW, natH) => {
            let w = 300;
            let h = 200;
            if (natW > 0 && natH > 0) {
                const ar = natW / natH;
                w = 300;
                h = Math.max(1, Math.round(w / ar));
            }
            const revitPayload = await resolveRevitImagePayload(src, {
                source: 'clipboard:paste-image',
                name
            });
            const properties = {
                src,
                name,
                width: w,
                height: h,
                ...revitPayload.properties
            };
            const extraData = imageId ? { imageId } : {};
            core.createObject(
                revitPayload.type,
                { x: Math.round(worldX - Math.round(w / 2)), y: Math.round(worldY - Math.round(h / 2)) },
                properties,
                extraData
            );
        };

        try {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => { void placeWithAspect(img.naturalWidth || 0, img.naturalHeight || 0); };
            img.onerror = () => { void placeWithAspect(0, 0); };
            img.src = src;
        } catch (_) {
            void placeWithAspect(0, 0);
        }
    });

    core.eventBus.on(Events.UI.PasteImageAt, ({ x, y, src, name, imageId }) => {
        if (!src) return;
        const world = core.pixi.worldLayer || core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const worldX = (x - (world?.x || 0)) / s;
        const worldY = (y - (world?.y || 0)) / s;

        const placeWithAspect = async (natW, natH) => {
            let w = 300;
            let h = 200;
            if (natW > 0 && natH > 0) {
                const ar = natW / natH;
                w = 300;
                h = Math.max(1, Math.round(w / ar));
            }
            const revitPayload = await resolveRevitImagePayload(src, {
                source: 'clipboard:paste-image-at',
                name
            });
            const properties = {
                src,
                name,
                width: w,
                height: h,
                ...revitPayload.properties
            };
            const extraData = imageId ? { imageId } : {};
            core.createObject(
                revitPayload.type,
                { x: Math.round(worldX - Math.round(w / 2)), y: Math.round(worldY - Math.round(h / 2)) },
                properties,
                extraData
            );
        };

        try {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => { void placeWithAspect(img.naturalWidth || 0, img.naturalHeight || 0); };
            img.onerror = () => { void placeWithAspect(0, 0); };
            img.src = src;
        } catch (_) {
            void placeWithAspect(0, 0);
        }
    });

    core.eventBus.on(Events.Tool.DuplicateRequest, (data) => {
        const { originalId, position } = data || {};
        if (!originalId) return;
        const objects = core.state.state.objects;
        const original = objects.find(obj => obj.id === originalId);
        if (!original) return;

        if (original.type === 'frame') {
            const frame = JSON.parse(JSON.stringify(original));
            const dx = (position?.x ?? frame.position.x) - frame.position.x;
            const dy = (position?.y ?? frame.position.y) - frame.position.y;
            const children = (core.state.state.objects || []).filter(o => o && o.properties && o.properties.frameId === originalId);

            const onFramePasted = (payload) => {
                if (!payload || payload.originalId !== originalId) return;
                const newFrameId = payload.newId;
                core.eventBus.off(Events.Object.Pasted, onFramePasted);
                for (const child of children) {
                    const clonedChild = JSON.parse(JSON.stringify(child));
                    clonedChild.properties = clonedChild.properties || {};
                    clonedChild.properties.frameId = newFrameId;
                    const targetPos = {
                        x: (child.position?.x || 0) + dx,
                        y: (child.position?.y || 0) + dy
                    };
                    core.clipboard = { type: 'object', data: clonedChild };
                    const cmdChild = new PasteObjectCommand(core, targetPos);
                    cmdChild.setEventBus(core.eventBus);
                    core.history.executeCommand(cmdChild);
                }
            };
            core.eventBus.on(Events.Object.Pasted, onFramePasted);

            const frameClone = JSON.parse(JSON.stringify(frame));
            try {
                const arr = core.state.state.objects || [];
                let maxNum = 0;
                for (const o of arr) {
                    if (!o || o.type !== 'frame') continue;
                    const t = o?.properties?.title || '';
                    const m = t.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                    if (m) {
                        const n = parseInt(m[1], 10);
                        if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
                    }
                }
                const next = maxNum + 1;
                frameClone.properties = frameClone.properties || {};
                frameClone.properties.title = `Фрейм ${next}`;
            } catch (_) {}
            core.clipboard = { type: 'object', data: frameClone };
            const cmdFrame = new PasteObjectCommand(core, { x: frame.position.x + dx, y: frame.position.y + dy });
            cmdFrame.setEventBus(core.eventBus);
            core.history.executeCommand(cmdFrame);
            return;
        }

        core.clipboard = {
            type: 'object',
            data: JSON.parse(JSON.stringify(original))
        };
        try {
            if (original.type === 'frame') {
                core._dupTitleMap = core._dupTitleMap || new Map();
                const prevTitle = (original.properties && typeof original.properties.title !== 'undefined') ? original.properties.title : undefined;
                core._dupTitleMap.set(originalId, prevTitle);
            }
        } catch (_) {}
        try {
            if (core.clipboard.data && core.clipboard.data.type === 'frame') {
                const arr = core.state.state.objects || [];
                let maxNum = 0;
                for (const o of arr) {
                    if (!o || o.type !== 'frame') continue;
                    const t = o?.properties?.title || '';
                    const m = t.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                    if (m) {
                        const n = parseInt(m[1], 10);
                        if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
                    }
                }
                const next = maxNum + 1;
                core.clipboard.data.properties = core.clipboard.data.properties || {};
                core.clipboard.data.properties.title = `Фрейм ${next}`;
            }
        } catch (_) {}

        core.pasteObject(position);
    });

    core.eventBus.on(Events.Tool.GroupDuplicateRequest, (data) => {
        const originals = (data.objects || []).filter((id) => core.state.state.objects.some(o => o.id === id));
        const total = originals.length;
        if (total === 0) {
            core.eventBus.emit(Events.Tool.GroupDuplicateReady, { map: {} });
            return;
        }
        const idMap = {};
        let remaining = total;
        const tempHandlers = new Map();
        const onPasted = (originalId) => (payload) => {
            if (payload.originalId !== originalId) return;
            idMap[originalId] = payload.newId;
            const h = tempHandlers.get(originalId);
            if (h) core.eventBus.off(Events.Object.Pasted, h);
            remaining -= 1;
            if (remaining === 0) {
                core.eventBus.emit(Events.Tool.GroupDuplicateReady, { map: idMap });
            }
        };
        for (const originalId of originals) {
            const obj = core.state.state.objects.find(o => o.id === originalId);
            if (!obj) continue;
            const handler = onPasted(originalId);
            tempHandlers.set(originalId, handler);
            core.eventBus.on(Events.Object.Pasted, handler);
            core.clipboard = { type: 'object', data: JSON.parse(JSON.stringify(obj)) };
            try {
                if (obj.type === 'frame') {
                    core._dupTitleMap = core._dupTitleMap || new Map();
                    const prevTitle = (obj.properties && typeof obj.properties.title !== 'undefined') ? obj.properties.title : undefined;
                    core._dupTitleMap.set(obj.id, prevTitle);
                }
            } catch (_) {}
            try {
                if (core.clipboard.data && core.clipboard.data.type === 'frame') {
                    const arr = core.state.state.objects || [];
                    let maxNum = 0;
                    for (const o2 of arr) {
                        if (!o2 || o2.type !== 'frame') continue;
                        const t2 = o2?.properties?.title || '';
                        const m2 = t2.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                        if (m2) {
                            const n2 = parseInt(m2[1], 10);
                            if (Number.isFinite(n2)) maxNum = Math.max(maxNum, n2);
                        }
                    }
                    const next2 = maxNum + 1;
                    core.clipboard.data.properties = core.clipboard.data.properties || {};
                    core.clipboard.data.properties.title = `Фрейм ${next2}`;
                }
            } catch (_) {}
            const cmd = new PasteObjectCommand(core, { x: obj.position.x, y: obj.position.y });
            cmd.setEventBus(core.eventBus);
            core.history.executeCommand(cmd);
        }
    });

    core.eventBus.on(Events.Object.Pasted, ({ originalId, newId }) => {
        try {
            const arr = core.state.state.objects || [];
            const newObj = arr.find(o => o.id === newId);
            const origObj = arr.find(o => o.id === originalId);
            if (newObj && newObj.type === 'frame') {
                let maxNum = 0;
                for (const o of arr) {
                    if (!o || o.id === newId || o.type !== 'frame') continue;
                    const t = o?.properties?.title || '';
                    const m = t.match(/^\s*Фрейм\s+(\d+)\s*$/i);
                    if (m) {
                        const n = parseInt(m[1], 10);
                        if (Number.isFinite(n)) maxNum = Math.max(maxNum, n);
                    }
                }
                const next = maxNum + 1;
                newObj.properties = newObj.properties || {};
                newObj.properties.title = `Фрейм ${next}`;
                const pixNew = core.pixi.objects.get(newId);
                if (pixNew && pixNew._mb?.instance?.setTitle) pixNew._mb.instance.setTitle(newObj.properties.title);
                if (core._dupTitleMap && core._dupTitleMap.has(originalId) && origObj && origObj.type === 'frame') {
                    const prev = core._dupTitleMap.get(originalId);
                    origObj.properties = origObj.properties || {};
                    origObj.properties.title = prev;
                    const pixOrig = core.pixi.objects.get(originalId);
                    if (pixOrig && pixOrig._mb?.instance?.setTitle) pixOrig._mb.instance.setTitle(prev);
                    core._dupTitleMap.delete(originalId);
                }
                core.state.markDirty();
            }
        } catch (_) {}
        core.eventBus.emit(Events.Tool.DuplicateReady, { originalId, newId });
    });
}

export function setupClipboardKeyboardFlow(core) {
    core.eventBus.on(Events.Keyboard.Copy, () => {
        if (core.toolManager.getActiveTool()?.name !== 'select') return;
        const selected = Array.from(core.toolManager.getActiveTool().selectedObjects || []);
        if (selected.length === 0) return;
        if (selected.length === 1) {
            core.copyObject(selected[0]);
            return;
        }
        const objects = core.state.state.objects || [];
        const groupData = selected
            .map(id => objects.find(o => o.id === id))
            .filter(Boolean)
            .map(o => JSON.parse(JSON.stringify(o)));
        if (groupData.length === 0) return;
        core.clipboard = {
            type: 'group',
            data: groupData,
            meta: { pasteCount: 0 }
        };
    });

    core.eventBus.on(Events.Keyboard.Paste, () => {
        if (!core.clipboard) return;
        if (core.clipboard.type === 'object') {
            core.pasteObject();
            return;
        }
        if (core.clipboard.type === 'group') {
            const group = core.clipboard;
            const data = Array.isArray(group.data) ? group.data : [];
            if (data.length === 0) return;
            const offsetStep = 25;
            group.meta = group.meta || { pasteCount: 0 };
            group.meta.pasteCount = (group.meta.pasteCount || 0) + 1;
            const dx = offsetStep * group.meta.pasteCount;
            const dy = offsetStep * group.meta.pasteCount;

            if (group.meta && group.meta.frameBundle) {
                const frames = data.filter(o => o && o.type === 'frame');
                if (frames.length === 1) {
                    const frameOriginal = frames[0];
                    const children = data.filter(o => o && o.id !== frameOriginal.id);
                    const totalToPaste = 1 + children.length;
                    let pastedCount = 0;
                    const newIds = [];
                    let newFrameId = null;

                    const onPasted = (payload) => {
                        if (!payload || !payload.newId) return;
                        newIds.push(payload.newId);
                        pastedCount += 1;
                        if (!newFrameId && payload.originalId === frameOriginal.id) {
                            newFrameId = payload.newId;
                            for (const child of children) {
                                const clonedChild = JSON.parse(JSON.stringify(child));
                                clonedChild.properties = clonedChild.properties || {};
                                clonedChild.properties.frameId = newFrameId;
                                const targetPos = {
                                    x: (clonedChild.position?.x || 0) + dx,
                                    y: (clonedChild.position?.y || 0) + dy
                                };
                                core.clipboard = { type: 'object', data: clonedChild };
                                const cmdChild = new PasteObjectCommand(core, targetPos);
                                cmdChild.setEventBus(core.eventBus);
                                core.history.executeCommand(cmdChild);
                            }
                        }
                        if (pastedCount === totalToPaste) {
                            core.eventBus.off(Events.Object.Pasted, onPasted);
                            if (core.selectTool && newIds.length > 0) {
                                requestAnimationFrame(() => {
                                    core.selectTool.setSelection(newIds);
                                    core.selectTool.updateResizeHandles();
                                });
                            }
                        }
                    };
                    core.eventBus.on(Events.Object.Pasted, onPasted);

                    const frameClone = JSON.parse(JSON.stringify(frameOriginal));
                    core.clipboard = { type: 'object', data: frameClone };
                    const cmdFrame = new PasteObjectCommand(core, { x: (frameClone.position?.x || 0) + dx, y: (frameClone.position?.y || 0) + dy });
                    cmdFrame.setEventBus(core.eventBus);
                    core.history.executeCommand(cmdFrame);
                    core.clipboard = group;
                    return;
                }
            }

            let pending = data.length;
            const newIds = [];
            const onPasted = (payload) => {
                if (!payload || !payload.newId) return;
                newIds.push(payload.newId);
                pending -= 1;
                if (pending === 0) {
                    core.eventBus.off(Events.Object.Pasted, onPasted);
                    if (core.selectTool && newIds.length > 0) {
                        requestAnimationFrame(() => {
                            core.selectTool.setSelection(newIds);
                            core.selectTool.updateResizeHandles();
                        });
                    }
                }
            };
            core.eventBus.on(Events.Object.Pasted, onPasted);

            for (const original of data) {
                const cloned = JSON.parse(JSON.stringify(original));
                const targetPos = {
                    x: (cloned.position?.x || 0) + dx,
                    y: (cloned.position?.y || 0) + dy
                };
                core.clipboard = { type: 'object', data: cloned };
                const cmd = new PasteObjectCommand(core, targetPos);
                cmd.setEventBus(core.eventBus);
                core.history.executeCommand(cmd);
            }
            core.clipboard = group;
        }
    });
}
