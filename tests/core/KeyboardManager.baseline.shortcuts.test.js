import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventCalls,
    collectEventPayloads,
    createKeyboardManagerContext,
    dispatchKeyboardEvent,
} from './KeyboardManager.baseline.helpers.js';

describe('KeyboardManager baseline: shortcuts', () => {
    let ctx;

    beforeEach(() => {
        ctx = createKeyboardManagerContext();
        ctx.manager.startListening();
        ctx.eventBus.emit.mockClear();
    });

    afterEach(() => {
        ctx?.cleanup();
    });

    it('dispatches selection and clipboard events for ctrl shortcuts including Russian layout aliases', () => {
        const ctrlA = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'a', { ctrlKey: true });
        const ctrlRussianA = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'ф', { ctrlKey: true });
        const ctrlC = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'c', { ctrlKey: true });
        const ctrlRussianC = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'с', { ctrlKey: true });
        const ctrlV = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'v', { ctrlKey: true });
        const ctrlRussianV = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'м', { ctrlKey: true });

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.SelectAll)).toHaveLength(2);
        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Copy)).toHaveLength(2);
        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Paste)).toHaveLength(2);

        expect(ctrlA.dispatchResult).toBe(false);
        expect(ctrlRussianA.dispatchResult).toBe(false);
        expect(ctrlC.dispatchResult).toBe(false);
        expect(ctrlRussianC.dispatchResult).toBe(false);

        // Paste keeps the current baseline contract: shortcut is handled,
        // but default browser paste is not prevented.
        expect(ctrlV.dispatchResult).toBe(true);
        expect(ctrlRussianV.dispatchResult).toBe(true);
    });

    it('dispatches undo and redo events for ctrl and ctrl+shift shortcuts including Russian layout aliases', () => {
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'z', { ctrlKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'я', { ctrlKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'y', { ctrlKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'н', { ctrlKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'z', { ctrlKey: true, shiftKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'я', { ctrlKey: true, shiftKey: true });

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Undo)).toHaveLength(2);
        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Redo)).toHaveLength(4);
    });

    it('does not match unsupported modifier combinations such as meta or alt variants', () => {
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'a', { metaKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'v', { altKey: true });

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.SelectAll)).toHaveLength(0);
        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.ToolSelect)).toHaveLength(0);
    });

    it('emits KeyUp with stable payload fields and normalized combination', () => {
        const { event } = dispatchKeyboardEvent(ctx.targetElement, 'keyup', 'Z', {
            ctrlKey: true,
            shiftKey: true,
            code: 'KeyZ',
        });

        const payload = collectEventPayloads(ctx.eventBus, Events.Keyboard.KeyUp)[0];

        expect(payload).toEqual({
            key: 'Z',
            code: 'KeyZ',
            combination: 'ctrl+shift+z',
            originalEvent: event,
        });
    });
});
