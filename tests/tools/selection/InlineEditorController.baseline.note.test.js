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
    setupNoteResponders,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('InlineEditorController baseline: note flow contracts', () => {
    let eventBus;
    let dom;
    let ctx;
    let cssSpy;
    let noteInstance;
    let refs;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createMockEventBus();
        dom = createDomApp();
        ctx = createInlineEditorContext({ eventBus, app: dom.app });
        ctx._closeTextEditor = (commit) => closeTextEditor.call(ctx, commit);
        cssSpy = installDeterministicComputedStyle();

        noteInstance = {
            hideText: vi.fn(),
            showText: vi.fn(),
            textField: {
                worldTransform: { c: 0, d: 1 },
                style: { fontSize: 18, lineHeight: 22, fontFamily: 'Arial' },
            },
        };
        refs = setupNoteResponders(eventBus, {
            objectId: 'note-1',
            position: { x: 100, y: 100 },
            size: { width: 180, height: 120 },
            pixiInstance: noteInstance,
        });
    });

    afterEach(() => {
        cssSpy.mockRestore();
        dom.cleanup();
    });

    it('open note editor sets note-specific edit lifecycle and initial autosize styles', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'note-1',
                type: 'note',
                position: { x: 100, y: 100 },
                properties: { content: 'Note body', fontSize: 18 },
            },
            false
        );

        expect(collectEventPayloads(eventBus, Events.UI.NoteEditStart)).toContainEqual({ objectId: 'note-1' });
        expect(noteInstance.hideText).toHaveBeenCalledTimes(1);
        expect(ctx.textEditor.wrapper.style.left).not.toBe('');
        expect(ctx.textEditor.wrapper.style.top).not.toBe('');
        expect(ctx.textEditor.textarea.style.width).not.toBe('');
        expect(ctx.textEditor.textarea.style.height).not.toBe('');
        expect(ctx.textEditor.textarea.style.textAlign).toBe('center');
    });

    it('recomputes note wrapper position and size on zoom/pan/drag/resize/rotate updates', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'note-1',
                type: 'note',
                position: { x: 100, y: 100 },
                properties: { content: 'A', fontSize: 18 },
            },
            false
        );

        const textarea = ctx.textEditor.textarea;
        Object.defineProperty(textarea, 'scrollWidth', { configurable: true, get: () => 140 });
        Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 62 });

        const before = {
            left: ctx.textEditor.wrapper.style.left,
            top: ctx.textEditor.wrapper.style.top,
            width: ctx.textEditor.wrapper.style.width,
            height: ctx.textEditor.wrapper.style.height,
        };

        refs.setPosition({ x: 160, y: 170 });
        refs.setSize({ width: 220, height: 170 });
        dom.worldLayer.scale.x = 1.5;

        eventBus.emit(Events.UI.ZoomPercent, { zoom: 150 });
        eventBus.emit(Events.Tool.PanUpdate, {});
        eventBus.emit(Events.Tool.DragUpdate, { object: 'note-1' });
        eventBus.emit(Events.Tool.ResizeUpdate, { object: 'note-1' });
        eventBus.emit(Events.Tool.RotateUpdate, { object: 'note-1' });

        const after = {
            left: ctx.textEditor.wrapper.style.left,
            top: ctx.textEditor.wrapper.style.top,
            width: ctx.textEditor.wrapper.style.width,
            height: ctx.textEditor.wrapper.style.height,
        };

        expect(after).not.toEqual(before);
    });
});
