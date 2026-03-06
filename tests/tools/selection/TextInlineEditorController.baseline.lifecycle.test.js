import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../../src/core/events/Events.js';
import {
    openTextEditor,
    closeTextEditor,
} from '../../../src/tools/object-tools/selection/TextInlineEditorController.js';
import {
    createDomApp,
    createInlineEditorContext,
    createMockEventBus,
    installDefaultGlobals,
    installDeterministicComputedStyle,
    setupNoteResponders,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('TextInlineEditorController baseline: lifecycle', () => {
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

    it('explicit close removes wrapper from DOM and resets textEditor state', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-lifecycle-close',
                type: 'text',
                position: { x: 20, y: 20 },
                properties: { content: 'x', fontSize: 18 },
            },
            false
        );

        const wrapper = ctx.textEditor.wrapper;
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(ctx.textEditor.active).toBe(false);
        expect(ctx.textEditor.objectId).toBeNull();
        expect(ctx.textEditor.textarea).toBeNull();
        expect(ctx.textEditor.wrapper).toBeNull();
        expect(document.body.contains(wrapper)).toBe(false);
    });

    it('close then reopen keeps a single active wrapper in DOM', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-lifecycle-reopen',
                type: 'text',
                position: { x: 20, y: 20 },
                properties: { content: 'x', fontSize: 18 },
            },
            false
        );

        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        openTextEditor.call(
            ctx,
            {
                id: 'text-lifecycle-reopen',
                type: 'text',
                position: { x: 20, y: 20 },
                properties: { content: 'x', fontSize: 18 },
            },
            false
        );

        expect(document.querySelectorAll('.moodboard-text-editor')).toHaveLength(1);
    });

    it('opening repeatedly without explicit close duplicates wrappers in DOM (current baseline)', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-repeat-0',
                type: 'text',
                position: { x: 10, y: 10 },
                properties: { content: 'first', fontSize: 18 },
            },
            false
        );

        openTextEditor.call(
            ctx,
            {
                id: 'text-repeat-1',
                type: 'text',
                position: { x: 11, y: 11 },
                properties: { content: 'second', fontSize: 18 },
            },
            false
        );

        openTextEditor.call(
            ctx,
            {
                id: 'text-repeat-2',
                type: 'text',
                position: { x: 12, y: 12 },
                properties: { content: 'third', fontSize: 18 },
            },
            false
        );

        expect(document.querySelectorAll('.moodboard-text-editor')).toHaveLength(3);
        expect(ctx.textEditor.objectId).toBe('text-repeat-2');
    });

    it('note close does not call eventBus.off for reactive listeners (current baseline)', () => {
        setupNoteResponders(eventBus, {
            objectId: 'note-lifecycle-1',
            position: { x: 50, y: 50 },
            size: { width: 150, height: 120 },
            pixiInstance: {
                hideText: vi.fn(),
                showText: vi.fn(),
                textField: { worldTransform: { c: 0, d: 1 }, style: { fontSize: 16, lineHeight: 20 } },
            },
        });

        openTextEditor.call(
            ctx,
            {
                id: 'note-lifecycle-1',
                type: 'note',
                position: { x: 50, y: 50 },
                properties: { content: 'A', fontSize: 16 },
            },
            false
        );

        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(eventBus.off).not.toHaveBeenCalled();
    });

    it('close then reopen note duplicates reactive update handler calls (current baseline)', () => {
        const refs = setupNoteResponders(eventBus, {
            objectId: 'note-lifecycle-2',
            position: { x: 100, y: 100 },
            size: { width: 180, height: 140 },
            pixiInstance: {
                hideText: vi.fn(),
                showText: vi.fn(),
                textField: { worldTransform: { c: 0, d: 1 }, style: { fontSize: 16, lineHeight: 20 } },
            },
        });

        openTextEditor.call(
            ctx,
            {
                id: 'note-lifecycle-2',
                type: 'note',
                position: { x: 100, y: 100 },
                properties: { content: 'initial', fontSize: 16 },
            },
            false
        );
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        openTextEditor.call(
            ctx,
            {
                id: 'note-lifecycle-2',
                type: 'note',
                position: { x: 100, y: 100 },
                properties: { content: 'next', fontSize: 16 },
            },
            false
        );

        const textarea = ctx.textEditor.textarea;
        Object.defineProperty(textarea, 'scrollWidth', { configurable: true, get: () => 100 });
        Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 30 });
        refs.setPosition({ x: 130, y: 130 });

        eventBus.emit.mockClear();
        eventBus.emit(Events.UI.ZoomPercent, { zoom: 120 });

        const getPositionCalls = eventBus.emit.mock.calls.filter(
            ([eventName]) => eventName === Events.Tool.GetObjectPosition
        );
        expect(getPositionCalls).toHaveLength(2);
    });
});
