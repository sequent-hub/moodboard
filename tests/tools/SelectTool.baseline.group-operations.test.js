import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMouseEvent,
    createSelectToolContext,
} from './SelectTool.baseline.helpers.js';

function makePixiBounds(bounds) {
    return {
        _mb: { type: 'note' },
        getBounds: () => ({ ...bounds }),
    };
}

describe('SelectTool baseline: group operations contracts', () => {
    let eventBus;
    let tool;
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ eventBus, tool, app } = createSelectToolContext());
        tool.activate(app);
        tool.setSelection(['obj-1', 'obj-2']);
        eventBus.emit.mockClear();

        eventBus.emit.mockImplementation((eventName, payload) => {
            if (eventName === Events.Tool.GetAllObjects && payload) {
                payload.objects = [
                    {
                        id: 'obj-1',
                        bounds: { x: 10, y: 20, width: 100, height: 60 },
                        pixi: makePixiBounds({ x: 10, y: 20, width: 100, height: 60 }),
                    },
                    {
                        id: 'obj-2',
                        bounds: { x: 160, y: 40, width: 80, height: 50 },
                        pixi: makePixiBounds({ x: 160, y: 40, width: 80, height: 50 }),
                    },
                ];
            }
        });
    });

    it('group drag emits start/update/end with objects and delta', () => {
        tool.startGroupDrag(createMouseEvent(20, 30));
        tool.updateDrag(createMouseEvent(70, 90));
        tool.endDrag();

        const starts = collectEventPayloads(eventBus, Events.Tool.GroupDragStart);
        const updates = collectEventPayloads(eventBus, Events.Tool.GroupDragUpdate);
        const ends = collectEventPayloads(eventBus, Events.Tool.GroupDragEnd);

        expect(starts[0]).toEqual(
            expect.objectContaining({ tool: 'select', objects: ['obj-1', 'obj-2'] })
        );
        expect(updates[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                objects: ['obj-1', 'obj-2'],
                delta: expect.objectContaining({ dx: expect.any(Number), dy: expect.any(Number) }),
            })
        );
        expect(ends[0]).toEqual(
            expect.objectContaining({ tool: 'select', objects: ['obj-1', 'obj-2'] })
        );
    });

    it('group resize emits start/update/end with bounds and scale payload', () => {
        tool.currentX = 120;
        tool.currentY = 100;

        tool.startResize('se', tool.groupId);
        tool.updateResize(createMouseEvent(180, 170));
        tool.endResize();

        const starts = collectEventPayloads(eventBus, Events.Tool.GroupResizeStart);
        const updates = collectEventPayloads(eventBus, Events.Tool.GroupResizeUpdate);
        const ends = collectEventPayloads(eventBus, Events.Tool.GroupResizeEnd);

        expect(starts[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                objects: ['obj-1', 'obj-2'],
                handle: 'se',
                startBounds: expect.objectContaining({ x: 10, y: 20, width: 230, height: 70 }),
            })
        );
        expect(updates[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                objects: ['obj-1', 'obj-2'],
                startBounds: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
                newBounds: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
                scale: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            })
        );
        expect(ends[0]).toEqual(
            expect.objectContaining({ tool: 'select', objects: ['obj-1', 'obj-2'] })
        );
    });

    it('group rotate emits start/update/end with center and angle', () => {
        tool.currentX = 260;
        tool.currentY = 40;

        tool.startRotate(tool.groupId);
        // Фиксируем текущее поведение: для полного цикла update/end
        // активируем контроллер группы явно.
        tool._groupRotateCtrl.start({ x: tool.currentX, y: tool.currentY });
        tool.updateRotate(createMouseEvent(260, 200));
        tool.endRotate();

        const starts = collectEventPayloads(eventBus, Events.Tool.GroupRotateStart);
        const updates = collectEventPayloads(eventBus, Events.Tool.GroupRotateUpdate);
        const ends = collectEventPayloads(eventBus, Events.Tool.GroupRotateEnd);

        expect(starts[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                objects: ['obj-1', 'obj-2'],
                center: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            })
        );
        expect(updates[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                objects: ['obj-1', 'obj-2'],
                center: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
                angle: expect.any(Number),
            })
        );
        expect(ends[0]).toEqual(
            expect.objectContaining({
                tool: 'select',
                objects: ['obj-1', 'obj-2'],
                angle: expect.any(Number),
            })
        );
    });
});
