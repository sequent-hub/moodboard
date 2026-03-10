import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../../src/core/events/Events.js';
import {
    openTextEditor,
    closeTextEditor,
} from '../../../src/tools/object-tools/selection/InlineEditorController.js';
import {
    collectEventPayloads,
    createDomApp,
    createInlineEditorContext,
    createMockEventBus,
    installDefaultGlobals,
    installDeterministicComputedStyle,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('InlineEditorController baseline: text flow contracts', () => {
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

    it('open in create mode and commit by Enter keeps event contracts stable', () => {
        openTextEditor.call(
            ctx,
            {
                object: {
                    id: 'text-create-1',
                    type: 'text',
                    position: { x: 120, y: 80 },
                    properties: { content: '', fontSize: 24 },
                },
            },
            true
        );

        expect(ctx.textEditor.active).toBe(true);
        expect(ctx.textEditor.objectId).toBe('text-create-1');
        expect(ctx.textEditor.textarea).toBeInstanceOf(HTMLTextAreaElement);
        expect(collectEventPayloads(eventBus, Events.UI.TextEditStart)).toContainEqual({ objectId: 'text-create-1' });
        expect(collectEventPayloads(eventBus, Events.Tool.HideObjectText)).toContainEqual({ objectId: 'text-create-1' });

        ctx.textEditor.textarea.value = 'Committed text';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Tool.ShowObjectText)).toContainEqual({ objectId: 'text-create-1' });
        expect(collectEventPayloads(eventBus, Events.UI.TextEditEnd)).toContainEqual({ objectId: 'text-create-1' });
        expect(collectEventPayloads(eventBus, Events.Tool.UpdateObjectContent)).toContainEqual({
            objectId: 'text-create-1',
            content: 'Committed text',
        });
        expect(collectEventPayloads(eventBus, Events.Object.StateChanged)).toContainEqual({
            objectId: 'text-create-1',
            updates: { properties: { content: 'Committed text' } },
        });
    });

    it('commit on blur for existing text emits ContentChange (undo/redo)', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-edit-1',
                type: 'text',
                position: { x: 20, y: 40 },
                properties: { content: 'old', fontSize: 18 },
            },
            false
        );

        ctx.textEditor.textarea.value = 'Blur committed text';
        ctx.textEditor.textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Object.ContentChange)).toContainEqual({
            objectId: 'text-edit-1',
            oldContent: 'old',
            newContent: 'Blur committed text',
        });
    });

    it('cancel by Escape for new empty text emits ObjectsDelete and no content update', () => {
        openTextEditor.call(
            ctx,
            {
                object: {
                    id: 'text-create-2',
                    type: 'text',
                    position: { x: 55, y: 66 },
                    properties: { content: '', fontSize: 20 },
                },
            },
            true
        );

        ctx.textEditor.textarea.value = '   ';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Tool.ObjectsDelete)).toContainEqual({ objects: ['text-create-2'] });
        expect(collectEventPayloads(eventBus, Events.Tool.UpdateObjectContent)).toHaveLength(0);
    });
});
