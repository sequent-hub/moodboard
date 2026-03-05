import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../../src/core/events/Events.js';
import { openTextEditor, closeTextEditor } from '../../../src/tools/object-tools/selection/InlineEditorController.js';
import {
    createDomApp,
    createInlineEditorContext,
    createMockEventBus,
    installDefaultGlobals,
    installDeterministicComputedStyle,
    setupNoteResponders,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('InlineEditorController diagnostics: lifecycle logging', () => {
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

    it('logs listener and DOM metrics across repeated note open/close cycles', () => {
        setupNoteResponders(eventBus, {
            objectId: 'note-diagnose-1',
            position: { x: 100, y: 100 },
            size: { width: 180, height: 140 },
            pixiInstance: {
                hideText: vi.fn(),
                showText: vi.fn(),
                textField: { worldTransform: { c: 0, d: 1 }, style: { fontSize: 16, lineHeight: 20 } },
            },
        });

        const metrics = [];
        for (let i = 0; i < 4; i++) {
            openTextEditor.call(
                ctx,
                {
                    id: 'note-diagnose-1',
                    type: 'note',
                    position: { x: 100, y: 100 },
                    properties: { content: `cycle-${i}`, fontSize: 16 },
                },
                false
            );

            metrics.push({
                cycle: i + 1,
                handlersTotalAfterOpen: eventBus.debugHandlersTotal(),
                handlersAfterOpen: eventBus.debugHandlersSnapshot(),
                domWrappersAfterOpen: document.querySelectorAll('.moodboard-text-editor').length,
            });

            ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

            metrics.push({
                cycle: i + 1,
                handlersTotalAfterClose: eventBus.debugHandlersTotal(),
                handlersAfterClose: eventBus.debugHandlersSnapshot(),
                domWrappersAfterClose: document.querySelectorAll('.moodboard-text-editor').length,
            });
        }

        // Диагностический вывод для анализа тренда lifecycle.
        console.info('InlineEditor diagnostics metrics:', JSON.stringify(metrics, null, 2));

        expect(metrics.length).toBe(8);
    });

    it('logs text-editor DOM cleanup metrics across repeated open/close cycles', () => {
        const metrics = [];
        for (let i = 0; i < 4; i++) {
            openTextEditor.call(
                ctx,
                {
                    id: 'text-diagnose-1',
                    type: 'text',
                    position: { x: 20, y: 30 },
                    properties: { content: `t-${i}`, fontSize: 18 },
                },
                false
            );

            metrics.push({
                cycle: i + 1,
                handlersTotalAfterOpen: eventBus.debugHandlersTotal(),
                domWrappersAfterOpen: document.querySelectorAll('.moodboard-text-editor').length,
            });

            ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

            metrics.push({
                cycle: i + 1,
                handlersTotalAfterClose: eventBus.debugHandlersTotal(),
                domWrappersAfterClose: document.querySelectorAll('.moodboard-text-editor').length,
            });
        }

        // Диагностический вывод для анализа тренда lifecycle.
        console.info('InlineEditor text diagnostics metrics:', JSON.stringify(metrics, null, 2));

        expect(metrics.length).toBe(8);
    });
});
