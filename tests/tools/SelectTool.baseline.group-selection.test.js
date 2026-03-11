/**
 * Страховочные unit-тесты для группового выделения.
 * Фиксируют текущие контракты. Не должны ломаться при доработках.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMouseEvent,
    createSelectToolContext,
} from './SelectTool.baseline.helpers.js';

describe('SelectTool baseline: group selection contracts', () => {
    let eventBus;
    let tool;

    beforeEach(() => {
        vi.clearAllMocks();
        ({ eventBus, tool } = createSelectToolContext());
    });

    it('multi-select uses ctrlKey, metaKey or shiftKey', () => {
        tool.addToSelection('obj-1');
        tool.hitTest = vi.fn(() => ({ type: 'object', object: 'obj-2' }));

        // Ctrl — добавляет
        tool.onMouseDown(createMouseEvent(20, 30, { originalEvent: { ctrlKey: true, metaKey: false, shiftKey: false } }));
        expect(new Set(tool.getSelection())).toEqual(new Set(['obj-1', 'obj-2']));

        tool.setSelection(['obj-1']);
        tool.hitTest = vi.fn(() => ({ type: 'object', object: 'obj-2' }));

        // Shift — тоже добавляет (multi-select)
        tool.onMouseDown(createMouseEvent(20, 30, { originalEvent: { ctrlKey: false, metaKey: false, shiftKey: true } }));
        expect(new Set(tool.getSelection())).toEqual(new Set(['obj-1', 'obj-2']));
    });

    it('selectAll emits SelectionAll and does not mutate selection (current behavior)', () => {
        tool.addToSelection('obj-a');
        eventBus.emit.mockClear();

        tool.selectAll();

        expect(tool.getSelection()).toEqual(['obj-a']);
        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Tool.SelectionAll,
            expect.objectContaining({ tool: 'select' })
        );
    });

    it('setSelection clears previous and sets new ids', () => {
        tool.addToSelection('old-1');
        tool.addToSelection('old-2');
        eventBus.emit.mockClear();

        tool.setSelection(['new-1', 'new-2']);

        expect(new Set(tool.getSelection())).toEqual(new Set(['new-1', 'new-2']));
        expect(collectEventPayloads(eventBus, Events.Tool.SelectionClear)).toHaveLength(1);
    });
});
