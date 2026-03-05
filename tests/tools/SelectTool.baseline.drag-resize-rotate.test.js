import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMouseEvent,
    createSelectToolContext,
} from './SelectTool.baseline.helpers.js';

describe('SelectTool baseline: single drag/resize/rotate', () => {
    let eventBus;
    let tool;
    let app;
    let objectPosition;
    let objectSize;
    let objectRotation;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ eventBus, tool, app } = createSelectToolContext());
        tool.activate(app);

        objectPosition = { x: 90, y: 100 };
        objectSize = { width: 100, height: 80 };
        objectRotation = 10;

        eventBus.emit.mockImplementation((eventName, payload) => {
            if (eventName === Events.Tool.GetObjectPosition && payload?.objectId) {
                payload.position = { ...objectPosition };
            }
            if (eventName === Events.Tool.GetObjectSize && payload?.objectId) {
                payload.size = { ...objectSize };
            }
            if (eventName === Events.Tool.GetObjectRotation && payload?.objectId) {
                payload.rotation = objectRotation;
            }
        });
    });

    it('drag start/update/end emits critical events and payload fields', () => {
        tool.startDrag('obj-1', createMouseEvent(100, 120));
        tool.updateDrag(createMouseEvent(130, 150));
        tool.endDrag();

        const starts = collectEventPayloads(eventBus, Events.Tool.DragStart);
        const updates = collectEventPayloads(eventBus, Events.Tool.DragUpdate);
        const ends = collectEventPayloads(eventBus, Events.Tool.DragEnd);

        expect(starts.length).toBeGreaterThan(0);
        expect(starts[0]).toEqual(expect.objectContaining({ tool: 'select', object: 'obj-1' }));
        expect(updates.length).toBeGreaterThan(0);
        expect(updates[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                object: 'obj-1',
                position: { x: 120, y: 130 },
            })
        );
        expect(ends.length).toBeGreaterThan(0);
        expect(ends[0]).toEqual(expect.objectContaining({ tool: 'select', object: 'obj-1' }));
    });

    it('resize start/update/end keeps object and size-position payload shape', () => {
        tool.currentX = 200;
        tool.currentY = 200;

        tool.startResize('se', 'obj-1');
        tool.updateResize(createMouseEvent(230, 240));
        objectSize = { width: 130, height: 120 };
        objectPosition = { x: 90, y: 100 };
        tool.endResize();

        const starts = collectEventPayloads(eventBus, Events.Tool.ResizeStart);
        const updates = collectEventPayloads(eventBus, Events.Tool.ResizeUpdate);
        const ends = collectEventPayloads(eventBus, Events.Tool.ResizeEnd);

        expect(starts[0]).toEqual(
            expect.objectContaining({ tool: 'select', object: 'obj-1', handle: 'se' })
        );
        expect(updates[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                object: 'obj-1',
                handle: 'se',
                size: expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }),
                position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            })
        );
        expect(ends[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                object: 'obj-1',
                oldSize: { width: 100, height: 80 },
                newSize: { width: 130, height: 120 },
                oldPosition: { x: 90, y: 100 },
                newPosition: { x: 90, y: 100 },
            })
        );
    });

    it('rotate start/update/end keeps angle contract', () => {
        tool.currentX = 200;
        tool.currentY = 100;

        tool.startRotate('obj-1');
        tool.updateRotate(createMouseEvent(150, 50));
        tool.endRotate();

        const starts = collectEventPayloads(eventBus, Events.Tool.RotateStart);
        const updates = collectEventPayloads(eventBus, Events.Tool.RotateUpdate);
        const ends = collectEventPayloads(eventBus, Events.Tool.RotateEnd);

        expect(starts[0]).toEqual(expect.objectContaining({ tool: 'select', object: 'obj-1' }));
        expect(updates[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                object: 'obj-1',
                angle: expect.any(Number),
            })
        );
        expect(ends[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                object: 'obj-1',
                oldAngle: 10,
                newAngle: expect.any(Number),
            })
        );
    });
});
