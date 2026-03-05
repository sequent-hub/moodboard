import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../src/core/events/Events.js';

vi.mock('../../src/utils/iconLoader.js', () => {
    return {
        IconLoader: class {
            async init() {}
            async loadAllIcons() {
                return {
                    image: '<svg viewBox="0 0 24 24"></svg>',
                    select: '<svg viewBox="0 0 24 24"></svg>',
                    pan: '<svg viewBox="0 0 24 24"></svg>',
                };
            }
        }
    };
});

vi.mock('../../src/utils/inlinePngEmojis.js', () => ({
    getInlinePngEmojiUrl: () => null,
    hasInlinePngEmoji: () => false
}));

import { Toolbar } from '../../src/ui/Toolbar.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            list.forEach((handler) => handler(payload));
        }),
        off: vi.fn(),
        removeAllListeners: vi.fn(),
    };
}

async function flushToolbarInit() {
    await Promise.resolve();
    await Promise.resolve();
}

function getEmits(mock, eventName) {
    return mock.mock.calls
        .filter(([name]) => name === eventName)
        .map(([, payload]) => payload);
}

describe('Toolbar baseline: action routing contracts', () => {
    let container;
    let toolbar;
    let eventBus;

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        eventBus = createEventBus();
        toolbar = new Toolbar(container, eventBus);
        await flushToolbarInit();
        eventBus.emit.mockClear();
    });

    afterEach(() => {
        toolbar?.destroy?.();
        container?.remove();
        vi.restoreAllMocks();
    });

    it('activate-select click emits place reset and select activation', () => {
        const button = container.querySelector('.moodboard-toolbar__button--select');
        button.click();

        expect(eventBus.emit).toHaveBeenCalledWith(Events.Place.Set, null);
        expect(eventBus.emit).toHaveBeenCalledWith(Events.Keyboard.ToolSelect, { tool: 'select' });
    });

    it('activate-pan click emits keyboard tool select: pan', () => {
        const button = container.querySelector('.moodboard-toolbar__button--pan');
        button.click();

        expect(eventBus.emit).toHaveBeenCalledWith(Events.Keyboard.ToolSelect, { tool: 'pan' });
    });

    it('note-add click emits place setup payload contract', () => {
        const button = container.querySelector('.moodboard-toolbar__button--note');
        button.click();

        const placeCalls = getEmits(eventBus.emit, Events.Place.Set);
        expect(placeCalls).toHaveLength(1);
        expect(placeCalls[0]).toEqual(
            expect.objectContaining({
                type: 'note',
                properties: expect.objectContaining({
                    content: expect.any(String),
                    width: expect.any(Number),
                    height: expect.any(Number),
                }),
            })
        );
        expect(eventBus.emit).toHaveBeenCalledWith(Events.Keyboard.ToolSelect, { tool: 'place' });
    });

    it('text-add click emits place setup payload contract', () => {
        const button = container.querySelector('.moodboard-toolbar__button--text-add');
        button.click();

        const placeCalls = getEmits(eventBus.emit, Events.Place.Set);
        expect(placeCalls).toHaveLength(1);
        expect(placeCalls[0]).toEqual(
            expect.objectContaining({
                type: 'text',
                properties: expect.objectContaining({
                    editOnCreate: true,
                    fontSize: expect.any(Number),
                }),
            })
        );
        expect(eventBus.emit).toHaveBeenCalledWith(Events.Keyboard.ToolSelect, { tool: 'place' });
    });

    it('undo/redo do not emit when disabled and emit when enabled', () => {
        const undo = container.querySelector('.moodboard-toolbar__button--undo');
        const redo = container.querySelector('.moodboard-toolbar__button--redo');

        undo.click();
        redo.click();
        expect(getEmits(eventBus.emit, Events.Keyboard.Undo)).toHaveLength(0);
        expect(getEmits(eventBus.emit, Events.Keyboard.Redo)).toHaveLength(0);

        eventBus.emit(Events.UI.UpdateHistoryButtons, { canUndo: true, canRedo: true });
        eventBus.emit.mockClear();

        undo.click();
        redo.click();
        expect(getEmits(eventBus.emit, Events.Keyboard.Undo)).toHaveLength(1);
        expect(getEmits(eventBus.emit, Events.Keyboard.Redo)).toHaveLength(1);
    });

    it('image2-add click routes to image-object2 select chain via file input', () => {
        const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
        const button = container.querySelector('.moodboard-toolbar__button--image2');
        button.click();

        const picker = document.querySelector('input[type="file"][accept="image/*"]');
        expect(picker).toBeInTheDocument();
        expect(clickSpy).toHaveBeenCalled();

        const file = new File(['img'], 'baseline-image2.png', { type: 'image/png' });
        Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
        picker.dispatchEvent(new Event('change'));

        const selectedPayloads = getEmits(eventBus.emit, Events.Place.ImageObject2Selected);
        expect(selectedPayloads).toHaveLength(1);
        expect(selectedPayloads[0]).toEqual(
            expect.objectContaining({
                fileName: 'baseline-image2.png',
                mimeType: 'image/png',
                source: 'toolbar:image2',
                defaults: expect.objectContaining({
                    width: expect.any(Number),
                    height: expect.any(Number),
                }),
            })
        );
    });
});
