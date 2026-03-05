import { Events } from '../events/Events.js';
import {
    GroupResizeCommand,
    ResizeObjectCommand,
    GroupRotateCommand
} from '../commands/index.js';

export function setupTransformFlow(core) {
    core.eventBus.on(Events.Tool.ResizeStart, (data) => {
        const objects = core.state.getObjects();
        const object = objects.find(obj => obj.id === data.object);
        if (object) {
            core.resizeStartSize = { width: object.width, height: object.height };
            core._activeResize = {
                objectId: data.object,
                handle: data.handle,
                startSize: { width: object.width, height: object.height },
                startPosition: { x: object.position.x, y: object.position.y }
            };
        }
    });

    core.eventBus.on(Events.Tool.GroupResizeStart, (data) => {
        core._groupResizeStart = data.startBounds || null;
        core._groupResizeSnapshot = new Map();
        for (const id of data.objects) {
            const obj = core.state.state.objects.find(o => o.id === id);
            const pixiObj = core.pixi.objects.get(id);
            if (!obj || !pixiObj) continue;
            core._groupResizeSnapshot.set(id, {
                size: { width: obj.width, height: obj.height },
                position: { x: obj.position.x, y: obj.position.y },
                type: obj.type || null
            });
        }
    });

    core.eventBus.on(Events.Tool.GroupResizeUpdate, (data) => {
        const { startBounds, newBounds, scale } = data;
        const sx = scale?.x ?? (newBounds.width / startBounds.width);
        const sy = scale?.y ?? (newBounds.height / startBounds.height);
        const startLeft = startBounds.x;
        const startTop = startBounds.y;
        for (const id of data.objects) {
            const snap = core._groupResizeSnapshot?.get(id);
            if (!snap) continue;
            const pixiAtStart = snap.position;
            const relCenterX = pixiAtStart.x - (startLeft + startBounds.width / 2);
            const relCenterY = pixiAtStart.y - (startTop + startBounds.height / 2);
            const newCenter = {
                x: newBounds.x + newBounds.width / 2 + relCenterX * sx,
                y: newBounds.y + newBounds.height / 2 + relCenterY * sy
            };
            const newSize = {
                width: Math.max(10, snap.size.width * sx),
                height: Math.max(10, snap.size.height * sy)
            };
            const newPos = { x: newCenter.x - newSize.width / 2, y: newCenter.y - newSize.height / 2 };
            core.updateObjectSizeAndPositionDirect(id, newSize, newPos, snap.type || null);
        }
    });

    core.eventBus.on(Events.Tool.GroupResizeEnd, (data) => {
        const changes = [];
        for (const id of data.objects) {
            const before = core._groupResizeSnapshot?.get(id);
            const obj = core.state.state.objects.find(o => o.id === id);
            if (!before || !obj) continue;
            const afterSize = { width: obj.width, height: obj.height };
            const afterPos = { x: obj.position.x, y: obj.position.y };
            if (before.size.width !== afterSize.width || before.size.height !== afterSize.height || before.position.x !== afterPos.x || before.position.y !== afterPos.y) {
                changes.push({ id, fromSize: before.size, toSize: afterSize, fromPos: before.position, toPos: afterPos, type: before.type });
            }
        }
        if (changes.length > 0) {
            const cmd = new GroupResizeCommand(core, changes);
            cmd.setEventBus(core.eventBus);
            core.history.executeCommand(cmd);
        }
        core._groupResizeStart = null;
        core._groupResizeSnapshot = null;
        if (core.selectTool && core.selectTool.selectedObjects.size > 1) {
            core.selectTool.updateResizeHandles();
        }
    });

    core.eventBus.on(Events.Tool.ResizeUpdate, (data) => {
        const objects = core.state.getObjects();
        const object = objects.find(obj => obj.id === data.object);
        const objectType = object ? object.type : null;

        if (data.size && (objectType === 'image' || objectType === 'frame')) {
            const isEmoji = (objectType === 'image' && object?.properties?.isEmojiIcon);
            const isImage = (objectType === 'image');
            const lockedAspect = objectType === 'frame'
                ? !!(object?.properties && object.properties.lockedAspect === true)
                : true;

            if (lockedAspect || isImage || isEmoji) {
                const start = core._activeResize?.startSize || { width: object.width, height: object.height };
                const startW = Math.max(1, start.width);
                const startH = Math.max(1, start.height);
                const aspect = isEmoji ? 1 : (startW / startH);

                let w = Math.max(1, data.size.width);
                let h = Math.max(1, data.size.height);
                const hndl = (core._activeResize?.handle || '').toLowerCase();

                if (isEmoji) {
                    const s = Math.max(w, h);
                    if (!data.position && core._activeResize && core._activeResize.objectId === data.object) {
                        const startPos = core._activeResize.startPosition;
                        const sw = core._activeResize.startSize.width;
                        const sh = core._activeResize.startSize.height;
                        let x = startPos.x;
                        let y = startPos.y;
                        if (hndl.includes('w')) { x = startPos.x + (sw - s); }
                        if (hndl.includes('n')) { y = startPos.y + (sh - s); }
                        const isEdge = ['n', 's', 'e', 'w'].includes(hndl);
                        if (isEdge) {
                            if (hndl === 'n' || hndl === 's') x = startPos.x + Math.round((sw - s) / 2);
                            if (hndl === 'e' || hndl === 'w') y = startPos.y + Math.round((sh - s) / 2);
                        }
                        data.position = { x: Math.round(x), y: Math.round(y) };
                    }
                    w = s;
                    h = s;
                } else {
                    const dw = Math.abs(w - startW);
                    const dh = Math.abs(h - startH);
                    if (dw >= dh) { h = Math.round(w / aspect); } else { w = Math.round(h * aspect); }
                }

                if (objectType === 'frame') {
                    const minArea = 1800;
                    const area = Math.max(1, w * h);
                    if (area < minArea) {
                        const scale = Math.sqrt(minArea / area);
                        w = Math.round(w * scale);
                        h = Math.round(h * scale);
                    }
                }

                data.size = { width: w, height: h };

                if (!data.position && core._activeResize && core._activeResize.objectId === data.object) {
                    const startPos = core._activeResize.startPosition;
                    const sw = core._activeResize.startSize.width;
                    const sh = core._activeResize.startSize.height;
                    let x = startPos.x;
                    let y = startPos.y;
                    if (hndl.includes('w')) { x = startPos.x + (sw - data.size.width); }
                    if (hndl.includes('n')) { y = startPos.y + (sh - data.size.height); }
                    const isEdge = ['n', 's', 'e', 'w'].includes(hndl);
                    if (isEdge) {
                        if (hndl === 'n' || hndl === 's') {
                            x = startPos.x + Math.round((sw - data.size.width) / 2);
                        } else if (hndl === 'e' || hndl === 'w') {
                            y = startPos.y + Math.round((sh - data.size.height) / 2);
                        }
                    }
                    data.position = { x: Math.round(x), y: Math.round(y) };
                }
            }
        }

        let position = data.position;
        if (!position && core._activeResize && core._activeResize.objectId === data.object) {
            const h = (core._activeResize.handle || '').toLowerCase();
            const start = core._activeResize.startPosition;
            const startSize = core._activeResize.startSize;
            const dw = (data.size?.width || startSize.width) - startSize.width;
            const dh = (data.size?.height || startSize.height) - startSize.height;
            let nx = start.x;
            let ny = start.y;
            if (h.includes('w')) nx = start.x + dw;
            if (h.includes('n')) ny = start.y + dh;
            position = { x: nx, y: ny };
        }

        if (objectType === 'frame' && data.size) {
            const minArea = 1800;
            const w0 = Math.max(1, data.size.width);
            const h0 = Math.max(1, data.size.height);
            const area0 = w0 * h0;
            if (area0 < minArea) {
                const scale = Math.sqrt(minArea / Math.max(1, area0));
                const w = Math.round(w0 * scale);
                const h = Math.round(h0 * scale);
                data.size = { width: w, height: h };
            }
        }

        core.updateObjectSizeAndPositionDirect(data.object, data.size, position, objectType);
    });

    core.eventBus.on(Events.Tool.ResizeEnd, (data) => {
        if (core.resizeStartSize && data.oldSize && data.newSize) {
            const objects = core.state.getObjects();
            const object = objects.find(obj => obj.id === data.object);
            if (object && object.type === 'frame' && object.properties && object.properties.lockedAspect === true) {
                const start = core._activeResize?.startSize || { width: object.width, height: object.height };
                const aspect = (start.width > 0 && start.height > 0) ? (start.width / start.height) : (object.width / Math.max(1, object.height));
                let w = Math.max(1, data.newSize.width);
                let h = Math.max(1, data.newSize.height);
                const dw = Math.abs(w - start.width);
                const dh = Math.abs(h - start.height);
                if (dw >= dh) { h = Math.round(w / aspect); } else { w = Math.round(h * aspect); }
                const minArea = 1800;
                const area = Math.max(1, w * h);
                if (area < minArea) {
                    const scale = Math.sqrt(minArea / area);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                }
                data.newSize = { width: w, height: h };
                if (!data.newPosition && core._activeResize && core._activeResize.objectId === data.object) {
                    const hndl = (core._activeResize?.full || core._activeResize?.handle || '').toLowerCase();
                    const startPos = core._activeResize.startPosition;
                    const sw = core._activeResize.startSize.width;
                    const sh = core._activeResize.startSize.height;
                    let x = startPos.x;
                    let y = startPos.y;
                    if (hndl.includes('w')) { x = startPos.x + (sw - w); }
                    if (hndl.includes('n')) { y = startPos.y + (sh - h); }
                    const isEdge = ['n', 's', 'e', 'w'].includes(hndl);
                    if (isEdge) {
                        if (hndl === 'n' || hndl === 's') x = Math.round(startPos.x + (sw - w) / 2);
                        if (hndl === 'e' || hndl === 'w') y = Math.round(startPos.y + (sh - h) / 2);
                    }
                    data.newPosition = { x: Math.round(x), y: Math.round(y) };
                }
            } else if (object && object.type === 'image') {
                const start = core._activeResize?.startSize || { width: object.width, height: object.height };
                const startW = Math.max(1, start.width);
                const startH = Math.max(1, start.height);
                const aspect = startW / startH;
                let w = Math.max(1, data.newSize.width);
                let h = Math.max(1, data.newSize.height);
                const dw = Math.abs(w - startW);
                const dh = Math.abs(h - startH);
                if (dw >= dh) { h = Math.round(w / aspect); } else { w = Math.round(h * aspect); }
                data.newSize = { width: w, height: h };
                if (!data.newPosition && core._activeResize && core._activeResize.objectId === data.object) {
                    const handle = (core._activeResize?.handle || '').toString().toLowerCase();
                    const startPos = core._activeResize.startPosition || { x: 0, y: 0 };
                    const sw = core._activeResize.startSize?.width || startW;
                    const sh = core._activeResize.startSize?.height || startH;
                    let x = startPos.x;
                    let y = startPos.y;
                    if (handle.includes('w')) { x = startPos.x + (sw - w); }
                    if (handle.includes('n')) { y = startPos.y + (sh - h); }
                    const edge = ['n', 's', 'e', 'w'].includes(handle);
                    if (edge) {
                        if (handle === 'n' || handle === 's') x = Math.round(startPos.x + (sw - w) / 2);
                        if (handle === 'e' || handle === 'w') y = Math.round(startPos.y + (sh - h) / 2);
                    }
                    data.newPosition = { x: Math.floor(x), y: Math.floor(y) };
                }
            }

            if (object && object.type === 'frame' && data.newSize && !(object.properties && object.properties === true)) {
                const minArea = 1800;
                const w0 = Math.max(1, data.newSize.width);
                const h0 = Math.max(1, data.newSize.height);
                const area0 = w0 * h0;
                if (area0 < minArea) {
                    const scale = Math.sqrt(minArea / Math.max(1, area0));
                    const w = Math.round(w0 * scale);
                    const h = Math.round(h0 * scale);
                    data.newSize = { width: w, height: h };
                    if (!data.newPosition && core._activeResize && core._activeResize.objectId === data.object) {
                        const h2 = (core._activeResize?.handle || '').toLowerCase();
                        const sPos2 = core._activeResize.startPosition;
                        const sw2 = core._activeResize.startSize.width;
                        const sh2 = core._activeResize.startSize.height;
                        let x2 = sPos2.x;
                        let y2 = sPos2.y;
                        if (h2.includes('w')) { x2 = sPos2.x + (sw2 - w); }
                        if (h2.includes('n')) { y2 = sPos2.y + (sh2 - h); }
                        data.newPosition = { x: Math.round(x2), y: Math.round(y2) };
                    }
                }
            }

            if (data.oldSize.width !== data.newSize.width || data.oldSize.height !== data.newSize.height) {
                let oldPos = data.oldPosition;
                let newPos = data.newPosition;
                if ((!oldPos || !newPos) && core._activeResize && core._activeResize.objectId === data.object) {
                    const h = (core._activeResize?.handle || '').toLowerCase();
                    const start = core._activeResize.startPosition;
                    const startSize = core.optimization?.startSize || core._activeResize.startSize;
                    const dw = (data.newSize?.width || startSize.width) - startSize.width;
                    const dh = (data.newSize?.height || startSize.height) - startSize.height;
                    const calcNew = { x: start.x + (h.includes('w') ? dw : 0), y: start.y + (h.includes('n') ? dh : 0) };
                    if (!oldPos) oldPos = { x: start.x, y: start.y };
                    if (!newPos) newPos = calcNew;
                }
                const command = new ResizeObjectCommand(
                    core,
                    data.object,
                    data.oldSize,
                    data.newSize,
                    oldPos,
                    newPos
                );
                command.setEventBus(core.eventBus);
                core.history.executeCommand(command);
            }
        }
        core.resizeStartSize = null;
        core._activeResize = null;
    });

    core.eventBus.on(Events.Tool.RotateUpdate, (data) => {
        core.pixi.updateObjectRotation(data.object, data.angle);
    });

    core.eventBus.on(Events.Tool.RotateEnd, (data) => {
        if (data.oldAngle !== undefined && data.newAngle !== undefined) {
            if (Math.abs(data.oldAngle - data.newAngle) > 0.1) {
                import('../commands/RotateObjectCommand.js').then(({ RotateObjectCommand }) => {
                    const command = new RotateObjectCommand(
                        core,
                        data.object,
                        data.oldAngle,
                        data.newAngle
                    );
                    command.setEventBus(core.eventBus);
                    core.history.executeCommand(command);
                });
            }
        }
    });

    core.eventBus.on(Events.Tool.GroupRotateStart, (data) => {
        core._groupRotateStart = new Map();
        for (const id of data.objects) {
            const pixiObject = core.pixi.objects.get(id);
            const deg = pixiObject ? (pixiObject.rotation * 180 / Math.PI) : 0;
            const pos = pixiObject ? { x: pixiObject.x, y: pixiObject.y } : { x: 0, y: 0 };
            core._groupRotateStart.set(id, { angle: deg, position: pos });
        }
        core._groupRotateCenter = data.center;
    });

    core.eventBus.on(Events.Tool.GroupRotateUpdate, (data) => {
        const center = core._groupRotateCenter;
        if (!center) return;
        const rad = (data.angle || 0) * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        for (const id of data.objects) {
            const start = core._groupRotateStart?.get(id);
            if (!start) continue;
            const startAngle = start.angle;
            const newAngle = startAngle + data.angle;
            const relX = start.position.x - center.x;
            const relY = start.position.y - center.y;
            const newX = center.x + relX * cos - relY * sin;
            const newY = center.y + relX * sin + relY * cos;
            const pObj = core.pixi.objects.get(id);
            const halfW = (pObj?.width || 0) / 2;
            const halfH = (pObj?.height || 0) / 2;
            core.updateObjectPositionDirect(id, { x: newX - halfW, y: newY - halfH });
            core.pixi.updateObjectRotation(id, newAngle);
            core.updateObjectRotationDirect(id, newAngle);
        }
        core.eventBus.emit(Events.Object.TransformUpdated, { objectId: '__group__', type: 'rotation' });
    });

    core.eventBus.on(Events.Tool.GroupRotateEnd, (data) => {
        const center = core._groupRotateCenter;
        if (!center) return;
        const changes = [];
        for (const id of data.objects) {
            const start = core._groupRotateStart?.get(id);
            const pixiObject = core.pixi.objects.get(id);
            if (!start || !pixiObject) continue;
            const toAngle = pixiObject.rotation * 180 / Math.PI;
            const objState = core.state.state.objects.find(o => o.id === id);
            const toPos = objState?.position
                ? { x: objState.position.x, y: objState.position.y }
                : (() => {
                    const halfW = (pixiObject.width || 0) / 2;
                    const halfH = (pixiObject.height || 0) / 2;
                    return { x: pixiObject.x - halfW, y: pixiObject.y - halfH };
                })();
            if (Math.abs(start.angle - toAngle) > 0.1 || Math.abs(start.position.x - toPos.x) > 0.1 || Math.abs(start.position.y - toPos.y) > 0.1) {
                changes.push({ id, fromAngle: start.angle, toAngle, fromPos: start.position, toPos });
            }
        }
        if (changes.length > 0) {
            const cmd = new GroupRotateCommand(core, changes);
            cmd.setEventBus(core.eventBus);
            core.history.executeCommand(cmd);
        }
        core._groupRotateStart = null;
        core._groupRotateCenter = null;
    });

    core.eventBus.on(Events.Object.Rotate, (data) => {
        core.pixi.updateObjectRotation(data.objectId, data.angle);
        core.updateObjectRotationDirect(data.objectId, data.angle);
        core.eventBus.emit(Events.Object.TransformUpdated, {
            objectId: data.objectId,
            type: 'rotation',
            angle: data.angle
        });
    });

    core.eventBus.on(Events.Object.TransformUpdated, (data) => {
        if (core.selectTool && core.selectTool.selection && core.selectTool.selection.has(data.objectId)) {
            core.selectTool.updateResizeHandles();
        }
    });
}
