import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventCalls,
    createKeyboardManagerContext,
    dispatchKeyboardEvent,
} from './KeyboardManager.baseline.helpers.js';

function getListenerCalls(spy, eventName) {
    return spy.mock.calls.filter(([name]) => name === eventName);
}

describe('KeyboardManager baseline: lifecycle', () => {
    let ctx;
    let addSpy;
    let removeSpy;

    beforeEach(() => {
        ctx = createKeyboardManagerContext();
        addSpy = vi.spyOn(ctx.targetElement, 'addEventListener');
        removeSpy = vi.spyOn(ctx.targetElement, 'removeEventListener');
    });

    afterEach(() => {
        addSpy?.mockRestore();
        removeSpy?.mockRestore();
        ctx?.cleanup();
    });

    it('startListening subscribes keydown, keyup and paste listeners once', () => {
        ctx.manager.startListening();

        expect(getListenerCalls(addSpy, 'keydown')).toHaveLength(1);
        expect(getListenerCalls(addSpy, 'keyup')).toHaveLength(1);
        expect(getListenerCalls(addSpy, 'paste')).toHaveLength(1);

        const pasteCall = getListenerCalls(addSpy, 'paste')[0];
        expect(typeof pasteCall[1]).toBe('function');
        expect(pasteCall[2]).toEqual({ capture: true });
        expect(ctx.manager.isListening).toBe(true);
    });

    it('repeated startListening does not add duplicate listeners while already active', () => {
        ctx.manager.startListening();
        ctx.manager.startListening();

        expect(getListenerCalls(addSpy, 'keydown')).toHaveLength(1);
        expect(getListenerCalls(addSpy, 'keyup')).toHaveLength(1);
        expect(getListenerCalls(addSpy, 'paste')).toHaveLength(1);
    });

    it('startListening creates paste handler once per active session', () => {
        const createPasteHandlerSpy = vi.spyOn(ctx.manager.clipboardImagePaste, 'createPasteHandler');

        ctx.manager.startListening();
        ctx.manager.startListening();

        expect(createPasteHandlerSpy).toHaveBeenCalledTimes(1);
        expect(getListenerCalls(addSpy, 'paste')).toHaveLength(1);
    });

    it('destroy removes key listeners, clears shortcuts and is safe to repeat', () => {
        ctx.manager.startListening();
        const keydownHandler = getListenerCalls(addSpy, 'keydown')[0][1];
        const keyupHandler = getListenerCalls(addSpy, 'keyup')[0][1];
        const pasteHandler = getListenerCalls(addSpy, 'paste')[0][1];

        expect(ctx.manager.getShortcuts().length).toBeGreaterThan(0);

        expect(() => ctx.manager.destroy()).not.toThrow();
        expect(removeSpy).toHaveBeenCalledWith('keydown', keydownHandler);
        expect(removeSpy).toHaveBeenCalledWith('keyup', keyupHandler);
        expect(removeSpy).toHaveBeenCalledWith('paste', pasteHandler, { capture: true });
        expect(ctx.manager.getShortcuts()).toEqual([]);
        expect(ctx.manager.isListening).toBe(false);

        expect(() => ctx.manager.destroy()).not.toThrow();
    });

    it('start-destroy-start cycle keeps keyboard dispatch single-shot for active listeners', () => {
        ctx.manager.startListening();
        ctx.manager.destroy();
        ctx.manager.startListening();
        ctx.eventBus.emit.mockClear();

        dispatchKeyboardEvent(ctx.targetElement, 'keydown', 'a', { ctrlKey: true });

        expect(collectEventCalls(ctx.eventBus, Events.Keyboard.SelectAll)).toHaveLength(1);
        expect(getListenerCalls(addSpy, 'keydown')).toHaveLength(2);
        expect(getListenerCalls(removeSpy, 'keydown')).toHaveLength(1);
    });

    it('start-destroy-start cycle keeps paste handling single-shot after restart', async () => {
        ctx.manager.startListening();
        const handleImageUploadSpy = vi
            .spyOn(ctx.manager.clipboardImagePaste, 'handleImageUpload')
            .mockResolvedValue(undefined);

        ctx.manager.destroy();
        ctx.manager.startListening();

        const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
        Object.defineProperty(pasteEvent, 'clipboardData', {
            value: {
                items: [],
                files: [],
                getData: (type) => type === 'text/plain' ? 'data:image/png;base64,PASTE' : '',
            },
        });

        ctx.targetElement.dispatchEvent(pasteEvent);
        await Promise.resolve();

        expect(handleImageUploadSpy).toHaveBeenCalledTimes(1);
    });
});
