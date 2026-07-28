import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../../src/core/events/Events.js';
import {
    openTextEditor,
    closeTextEditor,
} from '../../../src/tools/object-tools/selection/InlineEditorController.js';
import {
    createDomApp,
    createInlineEditorContext,
    createMockEventBus,
    installDefaultGlobals,
    installDeterministicComputedStyle,
    setupNoteResponders,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('InlineEditorController baseline: lifecycle and cleanup contracts', () => {
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

    // Раньше baseline фиксировал утечку: закрытие записки не снимало подписки, потому что
    // openTextEditor пересобирал состояние редактора и терял ссылку на них. Теперь ссылка
    // переносится, и закрытие обязано снять ровно свои обработчики.
    it('note close unsubscribes reactive listeners', () => {
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

        const offEvents = eventBus.off.mock.calls.map(([eventName]) => eventName);
        expect(offEvents).toContain(Events.Tool.PanUpdate);
        expect(offEvents).toContain(Events.Viewport.Changed);
        expect(offEvents).toContain(Events.UI.ZoomPercent);
    });

    it('close then reopen keeps a single active editor wrapper in DOM', () => {
        openTextEditor.call(
            ctx,
            {
                id: 'text-lifecycle-1',
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
                id: 'text-lifecycle-1',
                type: 'text',
                position: { x: 20, y: 20 },
                properties: { content: 'x', fontSize: 18 },
            },
            false
        );

        expect(document.querySelectorAll('.moodboard-text-editor')).toHaveLength(1);
    });

    // Раньше baseline фиксировал удвоение: после переоткрытия записки на ZoomPercent отвечали
    // два набора обработчиков. Именно это накопление роняло pan при работе в одном сеансе.
    it('close then reopen note keeps a single reactive update handler', () => {
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
        expect(getPositionCalls).toHaveLength(1);
    });
});
