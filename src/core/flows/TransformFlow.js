import { Events } from '../events/Events.js';
import {
    GroupResizeCommand,
    ResizeObjectCommand,
    GroupRotateCommand
} from '../commands/index.js';
import {
    getActiveResize,
    normalizeResizeEndPayload,
    normalizeResizeUpdatePayload,
    resolveResizePositionFallback,
} from './TransformFlowResizeHelpers.js';

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
                startPosition: { x: object.position.x, y: object.position.y },
                dominantAxis: null,
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
        const activeResize = normalizeResizeUpdatePayload(core, object, data);

        let position = data.position;
        if (!position && activeResize) {
            position = resolveResizePositionFallback(core, data.object, data.size);
        }

        core.updateObjectSizeAndPositionDirect(data.object, data.size, position, objectType);
    });

    core.eventBus.on(Events.Tool.ResizeEnd, (data) => {
        if (core.resizeStartSize && data.oldSize && data.newSize) {
            const objects = core.state.getObjects();
            const object = objects.find(obj => obj.id === data.object);
            const activeResize = normalizeResizeEndPayload(core, object, data);

            if (data.oldSize.width !== data.newSize.width || data.oldSize.height !== data.newSize.height) {
                let oldPos = data.oldPosition;
                let newPos = data.newPosition;
                const activeResize = getActiveResize(core, data.object);
                if ((!oldPos || !newPos) && activeResize) {
                    if (!oldPos) oldPos = { x: activeResize.startPosition.x, y: activeResize.startPosition.y };
                    if (!newPos) {
                        newPos = resolveResizePositionFallback(core, data.object, data.newSize);
                    }
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
