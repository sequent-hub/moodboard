import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMouseEvent,
    createSelectToolContext,
} from './SelectTool.baseline.helpers.js';

describe('SelectTool baseline: selection contracts', () => {
    let eventBus;
    let tool;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ eventBus, tool } = createSelectToolContext());
    });

    it('add/remove/clear selection keeps event contracts', () => {
        tool.addToSelection('obj-a');
        tool.addToSelection('obj-b');
        tool.removeFromSelection('obj-a');
        tool.clearSelection();

        expect(collectEventPayloads(eventBus, Events.Tool.SelectionAdd)).toEqual([
            { tool: 'select', object: 'obj-a' },
            { tool: 'select', object: 'obj-b' },
        ]);
        expect(collectEventPayloads(eventBus, Events.Tool.SelectionRemove)).toEqual([
            { tool: 'select', object: 'obj-a' },
        ]);
        expect(collectEventPayloads(eventBus, Events.Tool.SelectionClear)).toEqual([
            { tool: 'select', objects: ['obj-b'] },
        ]);
    });

    it('multi-select ctrl-click toggles selected object off', () => {
        tool.addToSelection('obj-1');
        eventBus.emit.mockClear();
        tool.hitTest = vi.fn(() => ({ type: 'object', object: 'obj-1' }));

        tool.onMouseDown(createMouseEvent(100, 120, { originalEvent: { ctrlKey: true } }));

        expect(tool.getSelection()).toEqual([]);
        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Tool.SelectionRemove,
            expect.objectContaining({ tool: 'select', object: 'obj-1' })
        );
    });

    it('multi-select ctrl-click adds object to existing selection', () => {
        tool.addToSelection('obj-1');
        eventBus.emit.mockClear();
        tool.hitTest = vi.fn(() => ({ type: 'object', object: 'obj-2' }));

        tool.onMouseDown(createMouseEvent(20, 30, { originalEvent: { ctrlKey: true } }));

        expect(new Set(tool.getSelection())).toEqual(new Set(['obj-1', 'obj-2']));
        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Tool.SelectionAdd,
            expect.objectContaining({ tool: 'select', object: 'obj-2' })
        );
    });

    it('setSelection replaces previous selection and emits clear + adds', () => {
        tool.addToSelection('obj-old');
        eventBus.emit.mockClear();

        tool.setSelection(['obj-new-1', 'obj-new-2']);

        expect(new Set(tool.getSelection())).toEqual(new Set(['obj-new-1', 'obj-new-2']));
        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Tool.SelectionClear,
            expect.objectContaining({ tool: 'select', objects: ['obj-old'] })
        );
        expect(collectEventPayloads(eventBus, Events.Tool.SelectionAdd)).toEqual([
            { tool: 'select', object: 'obj-new-1' },
            { tool: 'select', object: 'obj-new-2' },
        ]);
    });

    it('selectAll emits stable event without mutating selection directly', () => {
        tool.addToSelection('obj-x');
        eventBus.emit.mockClear();

        tool.selectAll();

        expect(tool.getSelection()).toEqual(['obj-x']);
        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Tool.SelectionAll,
            expect.objectContaining({ tool: 'select' })
        );
    });
});
