import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMouseEvent,
    createSelectToolContext,
} from './SelectTool.baseline.helpers.js';

function objectItem(id, bounds, type = 'note') {
    return {
        id,
        bounds,
        pixi: {
            _mb: { type },
            getBounds: () => ({ ...bounds }),
        },
    };
}

describe('SelectTool baseline: box select + events + editor hooks', () => {
    let eventBus;
    let tool;
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ eventBus, tool, app } = createSelectToolContext({ dispatch: true }));
        tool.activate(app);
    });

    it('box select start/update/end produces expected final selection', () => {
        tool.hitTest = vi.fn(() => ({ type: 'empty' }));
        eventBus.emit.mockImplementation((eventName, payload) => {
            if (eventName === Events.Tool.GetAllObjects && payload) {
                payload.objects = [
                    objectItem('obj-a', { x: 20, y: 20, width: 80, height: 50 }),
                    objectItem('obj-b', { x: 140, y: 20, width: 90, height: 50 }),
                    objectItem('frame-x', { x: 260, y: 20, width: 120, height: 80 }, 'frame'),
                ];
            }
            const handlers = eventBus.handlers.get(eventName);
            if (!handlers) return;
            for (const h of handlers) h(payload);
        });

        tool.onMouseDown(createMouseEvent(10, 10));
        tool.onMouseMove(createMouseEvent(400, 120));
        tool.onMouseUp(createMouseEvent(400, 120));

        expect(new Set(tool.getSelection())).toEqual(new Set(['obj-a', 'obj-b', 'frame-x']));
        // В текущем контракте add-события приходят и на update, и на end box-select.
        const addPayloads = collectEventPayloads(eventBus, Events.Tool.SelectionAdd);
        expect(addPayloads.length).toBeGreaterThanOrEqual(2);
        expect(addPayloads).toContainEqual({ tool: 'select', object: 'obj-a' });
        expect(addPayloads).toContainEqual({ tool: 'select', object: 'obj-b' });
        expect(addPayloads).toContainEqual({ tool: 'select', object: 'frame-x' });
    });

    it('critical selection payload format stays stable', () => {
        tool.addToSelection('obj-1');
        tool.clearSelection();

        const clearPayload = collectEventPayloads(eventBus, Events.Tool.SelectionClear)[0];
        expect(clearPayload).toEqual({
            tool: 'select',
            objects: ['obj-1'],
        });
    });

    it('double click emits ObjectEdit contract for text object', () => {
        tool.hitTest = vi.fn(() => ({ type: 'object', object: 'text-1' }));
        eventBus.emit.mockImplementation((eventName, payload) => {
            if (eventName === Events.Tool.GetObjectPixi && payload?.objectId === 'text-1') {
                payload.pixiObject = { _mb: { type: 'text', properties: { content: 'hello' } } };
            }
            if (eventName === Events.Tool.GetObjectPosition && payload?.objectId === 'text-1') {
                payload.position = { x: 100, y: 200 };
            }
        });

        tool.onDoubleClick(createMouseEvent(111, 222));

        const payload = collectEventPayloads(eventBus, Events.Tool.ObjectEdit)[0];
        expect(payload).toEqual(
            expect.objectContaining({
                tool: 'select',
                id: 'text-1',
                type: 'text',
                position: { x: 100, y: 200 },
                properties: { content: 'hello' },
                create: false,
                caretClick: { clientX: 111, clientY: 222 },
            })
        );
    });

    it('ObjectEdit event handler triggers text editor opening (smoke)', () => {
        const spy = vi.spyOn(tool, '_openTextEditor').mockImplementation(() => {});

        eventBus.emit(Events.Tool.ObjectEdit, {
            id: 'obj-edit-1',
            type: 'text',
            position: { x: 10, y: 10 },
            properties: { content: 'abc' },
            create: false,
        });

        expect(spy).toHaveBeenCalledTimes(1);
    });
});
