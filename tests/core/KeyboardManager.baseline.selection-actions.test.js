import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventCalls,
    collectEventPayloads,
    createKeyboardManagerContext,
    dispatchKeyboardEvent,
} from './KeyboardManager.baseline.helpers.js';

describe('KeyboardManager baseline: selection and object actions', () => {
    let ctx;

    beforeEach(() => {
        ctx = createKeyboardManagerContext();
        ctx.manager.startListening();
        ctx.eventBus.emit.mockClear();
    });

    afterEach(() => {
        ctx?.cleanup();
    });

    it('dispatches delete, backspace and escape keyboard events with current contracts', () => {
        const deleteResult = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'Delete');
        const backspaceResult = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'Backspace');
        const escapeResult = dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'Escape');

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Delete)).toHaveLength(2);
        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Escape)).toHaveLength(1);

        expect(deleteResult.dispatchResult).toBe(false);
        expect(backspaceResult.dispatchResult).toBe(false);
        expect(escapeResult.dispatchResult).toBe(false);
    });

    it('does not dispatch delete when a text editor marker is active in the document', () => {
        const editor = document.createElement('div');
        editor.className = 'moodboard-text-editor';
        editor.style.display = 'block';
        document.body.appendChild(editor);

        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'Delete');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'Backspace');

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Delete)).toHaveLength(0);
    });

    it('dispatches move events for plain arrow keys with step 1 payloads', () => {
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'ArrowUp');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'ArrowLeft');

        expect(collectEventPayloads(ctx.eventBus, Events.Keyboard.Move)).toEqual([
            { direction: 'up', step: 1 },
            { direction: 'left', step: 1 },
        ]);
    });

    it('shift+arrow shortcuts currently do not emit move events', () => {
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'ArrowDown', { shiftKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'ArrowRight', { shiftKey: true });

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Move)).toHaveLength(0);
    });

    it('dispatches layer reorder events after requesting current selection', () => {
        ctx.eventBus.on(Events.Tool.GetSelection, (request) => {
            request.selection = ['obj-layer-1'];
        });
        ctx.eventBus.emit.mockClear();

        dispatchKeyboardEvent(ctx.targetElement, 'keydown', ']');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', ']', { ctrlKey: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', '[');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', '[', { ctrlKey: true });

        const getSelectionCalls = collectEventPayloads(ctx.eventBus, Events.Tool.GetSelection);
        expect(getSelectionCalls).toHaveLength(4);
        expect(getSelectionCalls[0]).toEqual({ selection: ['obj-layer-1'] });

        expect(collectEventPayloads(ctx.eventBus, Events.UI.LayerBringToFront)).toEqual([
            { objectId: 'obj-layer-1' },
        ]);
        expect(collectEventPayloads(ctx.eventBus, Events.UI.LayerBringForward)).toEqual([
            { objectId: 'obj-layer-1' },
        ]);
        expect(collectEventPayloads(ctx.eventBus, Events.UI.LayerSendToBack)).toEqual([
            { objectId: 'obj-layer-1' },
        ]);
        expect(collectEventPayloads(ctx.eventBus, Events.UI.LayerSendBackward)).toEqual([
            { objectId: 'obj-layer-1' },
        ]);
    });

    it('does not dispatch layer reorder UI events when selection request returns empty selection', () => {
        ctx.eventBus.on(Events.Tool.GetSelection, (request) => {
            request.selection = [];
        });
        ctx.eventBus.emit.mockClear();

        dispatchKeyboardEvent(ctx.targetElement, 'keydown', ']');
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', '[');

        expect(collectEventCalls(ctx.eventBus, Events.Tool.GetSelection)).toHaveLength(2);
        expect(collectEventCalls(ctx.eventBus, Events.UI.LayerBringToFront)).toHaveLength(0);
        expect(collectEventCalls(ctx.eventBus, Events.UI.LayerSendToBack)).toHaveLength(0);
    });

    it('repeated keydown currently emits duplicate delete events because repeat is not guarded', () => {
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'Delete', { repeat: true });
        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'Delete', { repeat: true });

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.Delete)).toHaveLength(2);
    });
});
