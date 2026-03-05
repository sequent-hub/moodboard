import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../../src/core/events/Events.js';
import {
    openFileNameEditor,
    closeFileNameEditor,
} from '../../../src/tools/object-tools/selection/InlineEditorController.js';
import {
    collectEventPayloads,
    createDomApp,
    createInlineEditorContext,
    createMockEventBus,
    installDefaultGlobals,
} from './InlineEditorController.baseline.helpers.js';

installDefaultGlobals();

describe('InlineEditorController baseline: file name flow contracts', () => {
    let eventBus;
    let dom;
    let ctx;
    let fileInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createMockEventBus();
        dom = createDomApp();
        ctx = createInlineEditorContext({ eventBus, app: dom.app });
        ctx._closeFileNameEditor = (commit) => closeFileNameEditor.call(ctx, commit);

        fileInstance = {
            hideText: vi.fn(),
            showText: vi.fn(),
        };

        eventBus.setResponder(Events.Tool.GetObjectPosition, (payload) => {
            if (payload?.objectId === 'file-1') payload.position = { x: 220, y: 140 };
        });
        eventBus.setResponder(Events.Tool.GetObjectSize, (payload) => {
            if (payload?.objectId === 'file-1') payload.size = { width: 140, height: 150 };
        });
        eventBus.setResponder(Events.Tool.GetObjectPixi, (payload) => {
            if (payload?.objectId === 'file-1') {
                payload.pixiObject = {
                    _mb: { instance: fileInstance },
                };
            }
        });
    });

    afterEach(() => {
        dom.cleanup();
    });

    it('open and commit emits FileNameChange payload contract', () => {
        openFileNameEditor.call(
            ctx,
            {
                id: 'file-1',
                type: 'file',
                position: { x: 220, y: 140 },
                properties: { fileName: 'Old name' },
            },
            false
        );

        expect(ctx.textEditor.active).toBe(true);
        expect(fileInstance.hideText).toHaveBeenCalledTimes(1);

        ctx.textEditor.textarea.value = 'New name';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(fileInstance.showText).toHaveBeenCalledTimes(1);
        expect(collectEventPayloads(eventBus, Events.Object.FileNameChange)).toContainEqual({
            objectId: 'file-1',
            oldName: 'Old name',
            newName: 'New name',
        });
    });

    it('cancel by Escape closes editor and does not emit FileNameChange', () => {
        openFileNameEditor.call(
            ctx,
            {
                id: 'file-1',
                type: 'file',
                position: { x: 220, y: 140 },
                properties: { fileName: 'Original' },
            },
            false
        );

        ctx.textEditor.textarea.value = 'Canceled rename';
        ctx.textEditor.textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(fileInstance.showText).toHaveBeenCalledTimes(1);
        expect(collectEventPayloads(eventBus, Events.Object.FileNameChange)).toHaveLength(0);
    });
});
