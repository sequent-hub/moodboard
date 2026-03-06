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

describe('TextInlineEditorController baseline: positioning', () => {
    let eventBus;
    let dom;
    let ctx;
    let cssSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createMockEventBus();
        dom = createDomApp({
            toGlobal: (point) => ({ x: point.x + 50, y: point.y + 70 }),
            toLocal: (point) => ({ x: point.x - 50, y: point.y - 70 }),
        });
        dom.setRects({ containerLeft: 10, containerTop: 15, viewLeft: 30, viewTop: 45 });
        ctx = createInlineEditorContext({ eventBus, app: dom.app });
        ctx._closeTextEditor = (commit) => closeTextEditor.call(ctx, commit);
        cssSpy = installDeterministicComputedStyle();
    });

    afterEach(() => {
        delete window.moodboardHtmlTextLayer;
        cssSpy.mockRestore();
        dom.cleanup();
    });

    it('uses HtmlTextLayer CSS coordinates when layer is present for edit mode', () => {
        const htmlText = document.createElement('div');
        htmlText.style.left = '500px';
        htmlText.style.top = '600px';
        window.moodboardHtmlTextLayer = { idToEl: new Map([['text-css-pos', htmlText]]) };

        openTextEditor.call(
            ctx,
            {
                id: 'text-css-pos',
                type: 'text',
                position: { x: 100, y: 100 },
                properties: { content: 'css position', fontSize: 20 },
            },
            false
        );

        expect(ctx.textEditor.wrapper.style.left).toBe('500px');
        expect(ctx.textEditor.wrapper.style.top).toBe('600px');
    });

    it('falls back to world-to-screen transform when HtmlTextLayer is absent', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-world-fallback',
                type: 'text',
                position: { x: 100, y: 100 },
                properties: { content: 'world position', fontSize: 20 },
            },
            false
        );

        expect(ctx.textEditor.wrapper.style.left).toBe('170px');
        expect(ctx.textEditor.wrapper.style.top).toBe('200px');
    });

    it('create flow emits StateChanged with synced position payload', () => {
        openTextEditor.call(
            ctx,
            {
                object: {
                    id: 'text-new-position',
                    type: 'text',
                    position: { x: 40, y: 40 },
                    properties: { content: '', fontSize: 20 },
                },
            },
            true
        );

        const syncPayload = collectEventPayloads(eventBus, Events.Object.StateChanged).find(
            (payload) => payload?.objectId === 'text-new-position' && payload?.updates?.position
        );

        expect(syncPayload).toBeDefined();
        expect(syncPayload).toEqual(
            expect.objectContaining({
                objectId: 'text-new-position',
                updates: {
                    position: expect.objectContaining({
                        x: expect.any(Number),
                        y: expect.any(Number),
                    }),
                },
            })
        );
    });

    it('uses HtmlTextLayer coordinates for wrapper positioning in edit mode', () => {
        const htmlText = document.createElement('div');
        htmlText.style.left = '111px';
        htmlText.style.top = '222px';
        window.moodboardHtmlTextLayer = { idToEl: new Map([['text-css-stored', htmlText]]) };

        openTextEditor.call(
            ctx,
            {
                id: 'text-css-stored',
                type: 'text',
                position: { x: 0, y: 0 },
                properties: { content: 'x', fontSize: 20 },
            },
            false
        );

        expect(ctx.textEditor.wrapper.style.left).toBe('111px');
        expect(ctx.textEditor.wrapper.style.top).toBe('222px');
    });

    it('positioning reacts to world transform changes as smoke contract', () => {
        dom.worldLayer.scale.x = 2;
        dom.worldLayer.scale.y = 2;
        dom.worldLayer.toGlobal.mockImplementation((point) => ({ x: point.x * 2, y: point.y * 2 }));

        openTextEditor.call(
            ctx,
            {
                id: 'text-scale',
                type: 'text',
                position: { x: 50, y: 50 },
                properties: { content: 'x', fontSize: 20 },
            },
            false
        );

        expect(ctx.textEditor.wrapper.style.left).toBe('120px');
        expect(ctx.textEditor.wrapper.style.top).toBe('130px');
        expect(dom.worldLayer.toGlobal).toHaveBeenCalled();
    });
});
