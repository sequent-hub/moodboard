import { Events } from '../events/Events.js';
import {
    ReorderZCommand,
    GroupReorderZCommand,
    GroupMoveCommand,
    MoveObjectCommand
} from '../commands/index.js';

export function setupLayerAndViewportFlow(core) {
    const applyZOrderFromState = () => {
        const arr = core.state.state.objects || [];
        core.pixi.app.stage.sortableChildren = true;
        for (let i = 0; i < arr.length; i++) {
            const id = arr[i]?.id;
            const pixi = id ? core.pixi.objects.get(id) : null;
            if (pixi) pixi.zIndex = i;
        }
    };

    core.eventBus.on(Events.UI.LayerBringToFront, ({ objectId }) => {
        const arr = core.state.state.objects || [];
        const from = arr.findIndex(o => o.id === objectId);
        if (from === -1) return;
        const to = arr.length - 1;
        if (from === to) return;
        const cmd = new ReorderZCommand(core, objectId, from, to);
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });
    core.eventBus.on(Events.UI.LayerBringForward, ({ objectId }) => {
        const arr = core.state.state.objects || [];
        const from = arr.findIndex(o => o.id === objectId);
        if (from === -1) return;
        const to = Math.min(from + 1, arr.length - 1);
        if (from === to) return;
        const cmd = new ReorderZCommand(core, objectId, from, to);
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });
    core.eventBus.on(Events.UI.LayerSendBackward, ({ objectId }) => {
        const arr = core.state.state.objects || [];
        const from = arr.findIndex(o => o.id === objectId);
        if (from === -1) return;
        const to = Math.max(from - 1, 0);
        if (from === to) return;
        const cmd = new ReorderZCommand(core, objectId, from, to);
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });
    core.eventBus.on(Events.UI.LayerSendToBack, ({ objectId }) => {
        const arr = core.state.state.objects || [];
        const from = arr.findIndex(o => o.id === objectId);
        if (from === -1) return;
        const to = 0;
        if (from === to) return;
        const cmd = new ReorderZCommand(core, objectId, from, to);
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });

    const getSelection = () => {
        const ids = core.toolManager.getActiveTool()?.name === 'select'
            ? Array.from(core.toolManager.getActiveTool().selectedObjects || [])
            : [];
        return ids;
    };

    core.eventBus.on(Events.UI.LayerGroupBringToFront, () => {
        const ids = getSelection();
        if (ids.length === 0) return;
        const cmd = new GroupReorderZCommand(core, ids, 'front');
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });
    core.eventBus.on(Events.UI.LayerGroupBringForward, () => {
        const ids = getSelection();
        if (ids.length === 0) return;
        const cmd = new GroupReorderZCommand(core, ids, 'forward');
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });
    core.eventBus.on(Events.UI.LayerGroupSendBackward, () => {
        const ids = getSelection();
        if (ids.length === 0) return;
        const cmd = new GroupReorderZCommand(core, ids, 'backward');
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });
    core.eventBus.on(Events.UI.LayerGroupSendToBack, () => {
        const ids = getSelection();
        if (ids.length === 0) return;
        const cmd = new GroupReorderZCommand(core, ids, 'back');
        cmd.setEventBus(core.eventBus);
        core.history.executeCommand(cmd);
    });

    core.eventBus.on(Events.Tool.DragStart, (data) => {
        const pixiObject = core.pixi.objects.get(data.object);
        if (pixiObject) {
            const halfW = (pixiObject.width || 0) / 2;
            const halfH = (pixiObject.height || 0) / 2;
            core.dragStartPosition = { x: pixiObject.x - halfW, y: pixiObject.y - halfH };
        }
    });

    core.eventBus.on(Events.Tool.PanUpdate, ({ delta }) => {
        if (core.pixi.worldLayer) {
            core.pixi.worldLayer.x += delta.x;
            core.pixi.worldLayer.y += delta.y;
        }
        if (core.pixi.gridLayer) {
            core.pixi.gridLayer.x += delta.x;
            core.pixi.gridLayer.y += delta.y;
        }
        if (!core.pixi.worldLayer) {
            const stage = core.pixi.app.stage;
            stage.x += delta.x;
            stage.y += delta.y;
        }
        try {
            const world = core.pixi.worldLayer || core.pixi.app.stage;
            core.eventBus.emit(Events.Grid.BoardDataChanged, {
                settings: { pan: { x: world.x || 0, y: world.y || 0 } }
            });
        } catch (_) {}
        core.boardService?.refreshGridViewport?.();
    });

    core.eventBus.on(Events.UI.ZoomSelection, () => {
        const selected = core.selectTool ? Array.from(core.selectTool.selectedObjects || []) : [];
        if (!selected || selected.length === 0) return;
        const objs = core.state.state.objects || [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const o of objs) {
            if (!selected.includes(o.id)) continue;
            minX = Math.min(minX, o.position.x);
            minY = Math.min(minY, o.position.y);
            maxX = Math.max(maxX, o.position.x + (o.width || 0));
            maxY = Math.max(maxY, o.position.y + (o.height || 0));
        }
        if (!isFinite(minX)) return;
        const bboxW = Math.max(1, maxX - minX);
        const bboxH = Math.max(1, maxY - minY);
        const viewW = core.pixi.app.view.clientWidth;
        const viewH = core.pixi.app.view.clientHeight;
        const padding = 40;
        const scaleX = (viewW - padding) / bboxW;
        const scaleY = (viewH - padding) / bboxH;
        const newScale = Math.max(0.1, Math.min(5, Math.min(scaleX, scaleY)));
        const world = core.pixi.worldLayer || core.pixi.app.stage;
        const worldCenterX = minX + bboxW / 2;
        const worldCenterY = minY + bboxH / 2;
        world.scale.set(newScale);
        world.x = viewW / 2 - worldCenterX * newScale;
        world.y = viewH / 2 - worldCenterY * newScale;
        core.eventBus.emit(Events.UI.ZoomPercent, { percentage: Math.round(newScale * 100) });
        core.eventBus.emit(Events.Viewport.Changed);
    });

    core.eventBus.on(Events.UI.MinimapGetData, (data) => {
        const world = core.pixi.worldLayer || core.pixi.app.stage;
        const view = core.pixi.app.view;
        const scale = world?.scale?.x || 1;

        const objects = (core.state.state.objects || []).map((o) => ({
            id: o.id,
            x: o.position?.x ?? 0,
            y: o.position?.y ?? 0,
            width: o.width ?? 0,
            height: o.height ?? 0,
            rotation: o.rotation ?? (o.transform?.rotation ?? 0)
        }));

        data.world = { x: world.x || 0, y: world.y || 0, scale };
        data.view = { width: view.clientWidth, height: view.clientHeight };
        data.objects = objects;
    });

    core.eventBus.on(Events.UI.MinimapCenterOn, ({ worldX, worldY }) => {
        const world = core.pixi.worldLayer || core.pixi.app.stage;
        const view = core.pixi.app.view;
        const s = world?.scale?.x || 1;
        world.x = view.clientWidth / 2 - worldX * s;
        world.y = view.clientHeight / 2 - worldY * s;
    });

    core.eventBus.on(Events.Tool.GroupDragStart, (data) => {
        core._groupDragStart = new Map();
        for (const id of data.objects) {
            const pixiObject = core.pixi.objects.get(id);
            if (pixiObject) core._groupDragStart.set(id, { x: pixiObject.x, y: pixiObject.y });
        }
    });

    core.eventBus.on(Events.Tool.GroupDragUpdate, (data) => {
        const { dx, dy } = data.delta;
        for (const id of data.objects) {
            const pixiObject = core.pixi.objects.get(id);
            if (!pixiObject) continue;
            const startCenter = core._groupDragStart.get(id) || { x: pixiObject.x, y: pixiObject.y };
            const newCenter = { x: startCenter.x + dx, y: startCenter.y + dy };
            pixiObject.x = newCenter.x;
            pixiObject.y = newCenter.y;
            const obj = core.state.state.objects.find(o => o.id === id);
            if (obj) {
                const halfW = (pixiObject.width || 0) / 2;
                const halfH = (pixiObject.height || 0) / 2;
                obj.position.x = newCenter.x - halfW;
                obj.position.y = newCenter.y - halfH;
            }
        }
        core.state.markDirty();
    });

    core.eventBus.on(Events.Tool.GroupDragEnd, (data) => {
        const moves = [];
        for (const id of data.objects) {
            const start = core._groupDragStart?.get(id);
            const pixiObject = core.pixi.objects.get(id);
            if (!start || !pixiObject) continue;
            const finalPosition = { x: pixiObject.x, y: pixiObject.y };
            if (start.x !== finalPosition.x || start.y !== finalPosition.y) {
                moves.push({ id, from: start, to: finalPosition });
            }
        }
        if (moves.length > 0) {
            const cmd = new GroupMoveCommand(core, moves, false);
            cmd.setEventBus(core.eventBus);
            core.history.executeCommand(cmd);
        }
        core._groupDragStart = null;
    });

    core.eventBus.on(Events.Tool.DragUpdate, (data) => {
        core.updateObjectPositionDirect(data.object, data.position);
    });

    core.eventBus.on(Events.Tool.DragEnd, (data) => {
        if (core.dragStartPosition) {
            const pixiObject = core.pixi.objects.get(data.object);
            if (pixiObject) {
                const objState = core.state.state.objects.find(o => o.id === data.object);
                const finalPosition = objState && objState.position ? { x: objState.position.x, y: objState.position.y } : { x: 0, y: 0 };

                if (core.dragStartPosition.x !== finalPosition.x ||
                    core.dragStartPosition.y !== finalPosition.y) {
                    const moved = core.state.state.objects.find(o => o.id === data.object);
                    if (moved && moved.type === 'frame') {
                        const attachments = core._getFrameChildren(moved.id);
                        const moves = [];
                        moves.push({ id: moved.id, from: core.dragStartPosition, to: finalPosition });
                        const dx = finalPosition.x - core.dragStartPosition.x;
                        const dy = finalPosition.y - core.dragStartPosition.y;
                        for (const childId of attachments) {
                            const child = core.state.state.objects.find(o => o.id === childId);
                            if (!child) continue;
                            const start = core._frameDragChildStart?.get(childId);
                            const from = start ? { x: start.x, y: start.y } : { x: (child.position.x - dx), y: (child.position.y - dy) };
                            const to = { x: child.position.x, y: child.position.y };
                            moves.push({ id: childId, from, to });
                        }
                        const cmd = new GroupMoveCommand(core, moves, true);
                        cmd.setEventBus(core.eventBus);
                        core.history.executeCommand(cmd);
                    } else {
                        const command = new MoveObjectCommand(
                            core,
                            data.object,
                            core.dragStartPosition,
                            finalPosition
                        );
                        command.setEventBus(core.eventBus);
                        core.history.executeCommand(command);
                    }
                }
            }
            core.dragStartPosition = null;
        }
    });
}
