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
    setupNoteResponders,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('TextInlineEditorController baseline: commit/cancel', () => {
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

    it('Enter commits existing text and preserves event contracts', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-enter-commit',
                type: 'text',
                position: { x: 20, y: 40 },
                properties: { content: 'old', fontSize: 18 },
            },
            false
        );

        ctx.textEditor.textarea.value = 'Committed by Enter';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Tool.ShowObjectText)).toContainEqual({
            objectId: 'text-enter-commit',
        });
        expect(collectEventPayloads(eventBus, Events.UI.TextEditEnd)).toContainEqual({
            objectId: 'text-enter-commit',
        });
        expect(collectEventPayloads(eventBus, Events.Object.ContentChange)).toContainEqual({
            objectId: 'text-enter-commit',
            oldContent: 'old',
            newContent: 'Committed by Enter',
        });
    });

    it('blur commits existing text and preserves payload contracts', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-blur-commit',
                type: 'text',
                position: { x: 20, y: 40 },
                properties: { content: 'old', fontSize: 18 },
            },
            false
        );

        ctx.textEditor.textarea.value = 'Blur committed';
        ctx.textEditor.textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Object.ContentChange)).toContainEqual({
            objectId: 'text-blur-commit',
            oldContent: 'old',
            newContent: 'Blur committed',
        });
    });

    it('Escape cancels new empty text and emits ObjectsDelete', () => {
        openTextEditor.call(
            ctx,
            {
                object: {
                    id: 'text-cancel-new',
                    type: 'text',
                    position: { x: 55, y: 66 },
                    properties: { content: '', fontSize: 20 },
                },
            },
            true
        );

        ctx.textEditor.textarea.value = '   ';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Tool.ObjectsDelete)).toContainEqual({
            objects: ['text-cancel-new'],
        });
        expect(collectEventPayloads(eventBus, Events.Tool.UpdateObjectContent)).toHaveLength(0);
    });

    it('Escape cancels existing text without content update', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-cancel-existing',
                type: 'text',
                position: { x: 10, y: 10 },
                properties: { content: 'original', fontSize: 18 },
            },
            false
        );

        ctx.textEditor.textarea.value = 'modified but cancelled';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Tool.ObjectsDelete)).toHaveLength(0);
        expect(collectEventPayloads(eventBus, Events.Tool.UpdateObjectContent)).toHaveLength(0);
        expect(collectEventPayloads(eventBus, Events.UI.TextEditEnd)).toContainEqual({
            objectId: 'text-cancel-existing',
        });
        expect(collectEventPayloads(eventBus, Events.Tool.ShowObjectText)).toContainEqual({
            objectId: 'text-cancel-existing',
        });
    });

    it('commit existing note emits ContentChange (undo/redo)', () => {
        setupNoteResponders(eventBus, {
            objectId: 'note-commit-1',
            position: { x: 20, y: 40 },
            size: { width: 200, height: 150 },
        });

        openTextEditor.call(
            ctx,
            {
                id: 'note-commit-1',
                type: 'note',
                position: { x: 20, y: 40 },
                properties: { content: 'Note before', fontSize: 18 },
            },
            false
        );

        ctx.textEditor.textarea.value = 'Note after edit';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.UI.NoteEditEnd)).toContainEqual({
            objectId: 'note-commit-1',
        });
        expect(collectEventPayloads(eventBus, Events.Object.ContentChange)).toContainEqual({
            objectId: 'note-commit-1',
            oldContent: 'Note before',
            newContent: 'Note after edit',
        });
    });

    it('blur with empty value on new creation cancels and deletes object', () => {
        openTextEditor.call(
            ctx,
            {
                object: {
                    id: 'text-blur-empty',
                    type: 'text',
                    position: { x: 1, y: 1 },
                    properties: { content: '', fontSize: 20 },
                },
            },
            true
        );

        ctx.textEditor.textarea.value = '';
        ctx.textEditor.textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

        expect(collectEventPayloads(eventBus, Events.Tool.ObjectsDelete)).toContainEqual({
            objects: ['text-blur-empty'],
        });
        expect(collectEventPayloads(eventBus, Events.Tool.UpdateObjectContent)).toHaveLength(0);
    });
});
