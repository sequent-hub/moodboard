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

describe('InlineEditorController baseline: positioning contracts', () => {
    let eventBus;
    let dom;
    let ctx;
    let cssSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createMockEventBus();
        dom = createDomApp({
            toGlobal: (point) => ({ x: point.x + 50, y: point.y + 70 }),
            toLocal: (point) => ({ x: point.x - 10, y: point.y - 20 }),
        });
        dom.setRects({ containerLeft: 10, containerTop: 15, viewLeft: 30, viewTop: 45 });
        ctx = createInlineEditorContext({ eventBus, app: dom.app });
        ctx._closeTextEditor = (commit) => closeTextEditor.call(ctx, commit);
        cssSpy = installDeterministicComputedStyle();
    });

    afterEach(() => {
        cssSpy.mockRestore();
        dom.cleanup();
    });

    it('uses HtmlTextLayer CSS coordinates for existing object positioning when layer is present', () => {
        const htmlText = document.createElement('div');
        htmlText.style.left = '500px';
        htmlText.style.top = '600px';
        window.moodboardHtmlTextLayer = { idToEl: new Map([['text-css-1', htmlText]]) };

        openTextEditor.call(
            ctx,
            {
                id: 'text-css-1',
                type: 'text',
                position: { x: 100, y: 100 },
                properties: { content: 'css position', fontSize: 20 },
            },
            false
        );

        expect(ctx.textEditor.wrapper.style.left).toBe('500px');
        expect(ctx.textEditor.wrapper.style.top).toBe('600px');
    });

    it('falls back to world->screen transform when HtmlTextLayer is absent', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-world-1',
                type: 'text',
                position: { x: 100, y: 100 },
                properties: { content: 'world position', fontSize: 20 },
            },
            false
        );

        expect(ctx.textEditor.wrapper.style.left).toBe('170px');
        expect(ctx.textEditor.wrapper.style.top).toBe('200px');
    });

    it('syncs screen->world position for create flow via StateChanged payload', () => {
        openTextEditor.call(
            ctx,
            {
                object: {
                    id: 'text-new-1',
                    type: 'text',
                    position: { x: 40, y: 40 },
                    properties: { content: '', fontSize: 20 },
                },
            },
            true
        );

        const syncPayload = collectEventPayloads(eventBus, Events.Object.StateChanged).find(
            (payload) => payload?.objectId === 'text-new-1' && payload?.updates?.position
        );

        expect(syncPayload).toBeDefined();
        expect(syncPayload).toEqual(
            expect.objectContaining({
                objectId: 'text-new-1',
                updates: {
                    position: expect.objectContaining({
                        x: expect.any(Number),
                        y: expect.any(Number),
                    }),
                },
            })
        );
    });
});
