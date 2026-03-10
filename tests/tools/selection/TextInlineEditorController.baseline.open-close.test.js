import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../../src/core/events/Events.js';
import {
    openTextEditor,
    closeTextEditor,
} from '../../../src/tools/object-tools/selection/TextInlineEditorController.js';
import {
    collectEventPayloads,
    createDomApp,
    createInlineEditorContext,
    createMockEventBus,
    installDefaultGlobals,
    installDeterministicComputedStyle,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('TextInlineEditorController baseline: open/close flow', () => {
    let eventBus;
    let dom;
    let ctx;
    let cssSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createMockEventBus();
        dom = createDomApp();
        ctx = createInlineEditorContext({ eventBus, app: dom.app });
        ctx._closeTextEditor = (commit) => closeTextEditor.call(ctx, commit);
        cssSpy = installDeterministicComputedStyle();
    });

    afterEach(() => {
        cssSpy.mockRestore();
        dom.cleanup();
    });

    it('opens editor in create mode and emits TextEditStart', () => {
        openTextEditor.call(
            ctx,
            {
                object: {
                    id: 'text-create-open',
                    type: 'text',
                    position: { x: 100, y: 50 },
                    properties: { content: '', fontSize: 24 },
                },
            },
            true
        );

        expect(ctx.textEditor.active).toBe(true);
        expect(ctx.textEditor.objectId).toBe('text-create-open');
        expect(ctx.textEditor.textarea).toBeInstanceOf(HTMLTextAreaElement);
        expect(ctx.textEditor.wrapper).toBeInstanceOf(HTMLDivElement);
        expect(ctx.textEditor.wrapper.className).toContain('moodboard-text-editor');
        expect(collectEventPayloads(eventBus, Events.UI.TextEditStart)).toContainEqual({
            objectId: 'text-create-open',
        });
    });

    it('opens editor in edit mode and emits TextEditStart', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-edit-open',
                type: 'text',
                position: { x: 20, y: 40 },
                properties: { content: 'existing', fontSize: 18 },
            },
            false
        );

        expect(ctx.textEditor.active).toBe(true);
        expect(ctx.textEditor.objectId).toBe('text-edit-open');
        expect(ctx.textEditor.textarea.value).toBe('existing');
        expect(collectEventPayloads(eventBus, Events.UI.TextEditStart)).toContainEqual({
            objectId: 'text-edit-open',
        });
    });

    it('re-opening switches active editor to new object and commits previous editor through closeTextEditor baseline', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-first',
                type: 'text',
                position: { x: 10, y: 10 },
                properties: { content: 'first', fontSize: 18 },
            },
            false
        );

        const wrappersBefore = document.querySelectorAll('.moodboard-text-editor').length;

        openTextEditor.call(
            ctx,
            {
                id: 'text-second',
                type: 'text',
                position: { x: 20, y: 20 },
                properties: { content: 'second', fontSize: 18 },
            },
            false
        );

        expect(ctx.textEditor.objectId).toBe('text-second');
        expect(ctx.textEditor.textarea.value).toBe('second');
        expect(document.querySelectorAll('.moodboard-text-editor').length).toBeGreaterThan(wrappersBefore);
        expect(collectEventPayloads(eventBus, Events.Object.ContentChange)).toContainEqual({
            objectId: 'text-first',
            oldContent: 'first',
            newContent: 'first',
        });
    });

    it('closing by Escape removes DOM elements and resets controller state', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-close-dom',
                type: 'text',
                position: { x: 5, y: 5 },
                properties: { content: 'x', fontSize: 18 },
            },
            false
        );

        const wrapper = ctx.textEditor.wrapper;
        expect(document.body.contains(wrapper)).toBe(true);

        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(ctx.textEditor.active).toBe(false);
        expect(ctx.textEditor.wrapper).toBeNull();
        expect(ctx.textEditor.textarea).toBeNull();
        expect(document.body.contains(wrapper)).toBe(false);
        expect(document.querySelectorAll('.moodboard-text-editor')).toHaveLength(0);
    });

    it('does not open when position is undefined', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        openTextEditor.call(
            ctx,
            {
                id: 'text-no-pos',
                type: 'text',
                position: undefined,
                properties: { content: 'x', fontSize: 18 },
            },
            false
        );

        expect(ctx.textEditor.active).toBe(false);
        expect(document.querySelectorAll('.moodboard-text-editor')).toHaveLength(0);
        consoleSpy.mockRestore();
    });
});
