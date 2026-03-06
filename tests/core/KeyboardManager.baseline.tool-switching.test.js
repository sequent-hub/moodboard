import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventCalls,
    collectEventPayloads,
    createKeyboardManagerContext,
    dispatchKeyboardEvent,
} from './KeyboardManager.baseline.helpers.js';

describe('KeyboardManager baseline: tool switching and input guards', () => {
    let ctx;

    beforeEach(() => {
        ctx = createKeyboardManagerContext();
        ctx.manager.startListening();
        ctx.eventBus.emit.mockClear();
    });

    afterEach(() => {
        ctx?.cleanup();
    });

    it('dispatches tool-select events for Latin and Russian shortcuts with stable payloads', () => {
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'v');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'м');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 't');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'е');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'r');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'к');

        expect(collectEventPayloads(ctx.eventBus, Events.Keyboard.ToolSelect)).toEqual([
            { tool: 'select' },
            { tool: 'select' },
            { tool: 'text' },
            { tool: 'text' },
            { tool: 'frame' },
            { tool: 'frame' },
        ]);
    });

    it('does not dispatch tool shortcuts from input, textarea or contenteditable targets', () => {
        const input = document.createElement('input');
        const textarea = document.createElement('textarea');
        const editable = document.createElement('div');
        editable.contentEditable = 'true';

        ctx.targetElement.append(input, textarea, editable);

        dispatchKeyboardEvent(input, 'keydown', 'v');
        dispatchKeyboardEvent(textarea, 'keydown', 't');
        dispatchKeyboardEvent(editable, 'keydown', 'r');

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.ToolSelect)).toHaveLength(0);
    });

    it('does not dispatch ctrl selection shortcuts from input-like targets', () => {
        const input = document.createElement('input');
        const textarea = document.createElement('textarea');
        const editable = document.createElement('div');
        editable.contentEditable = 'true';

        ctx.targetElement.append(input, textarea, editable);

        dispatchKeyboardEvent(input, 'keydown', 'a', { ctrlKey: true });
        dispatchKeyboardEvent(textarea, 'keydown', 'c', { ctrlKey: true });
        dispatchKeyboardEvent(editable, 'keydown', 'v', { ctrlKey: true });

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.SelectAll)).toHaveLength(0);
        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Copy)).toHaveLength(0);
        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Paste)).toHaveLength(0);
    });
});
