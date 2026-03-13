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
                    undo: '<svg viewBox="0 0 24 24"></svg>',
                    redo: '<svg viewBox="0 0 24 24"></svg>',
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
        _handlers: handlers,
    };
}

async function flushToolbarInit() {
    await Promise.resolve();
    await Promise.resolve();
}

function eventNamesFromOnCalls(onMock) {
    return onMock.mock.calls.map(([eventName]) => eventName);
}

describe('Toolbar baseline: lifecycle, events and tooltip contracts', () => {
    let container;
    let toolbar;
    let eventBus;

    beforeEach(async () => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        eventBus = createEventBus();
        toolbar = new Toolbar(container, eventBus);
        await flushToolbarInit();
    });

    afterEach(() => {
        toolbar?.destroy?.();
        container?.remove();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('event name constants remain stable for toolbar contracts', () => {
        expect(Events.UI.UpdateHistoryButtons).toBe('ui:update-history-buttons');
        expect(Events.Keyboard.ToolSelect).toBe('keyboard:tool-select');
        expect(Events.UI.RevitShowInModel).toBe('ui:revit:show-in-model');
        expect(Events.Place.ImageObject2Selected).toBe('place:image-object2:selected');
        expect(Events.Place.ImageObject2Canceled).toBe('place:image-object2:canceled');
    });

    it('subscribes to expected EventBus channels during init', () => {
        const names = eventNamesFromOnCalls(eventBus.on);
        expect(names).toContain(Events.Tool.Activated);
        expect(names).toContain(Events.UI.UpdateHistoryButtons);
    });

    it.skip('destroy removes history listeners and tooltips', () => {
        const image2Button = container.querySelector('.moodboard-toolbar__button--image2');
        expect(image2Button._tooltip).toBeInTheDocument();

        toolbar.destroy();

        expect(eventBus.removeAllListeners).toHaveBeenCalledWith(Events.UI.UpdateHistoryButtons);
        expect(image2Button._tooltip).toBeNull();
    });

    it.skip('tooltip text for key buttons stays stable', () => {
        const checks = [
            { selector: '.moodboard-toolbar__button--select', text: 'Инструмент выделения (V)' },
            { selector: '.moodboard-toolbar__button--image', text: 'Добавить картинку' },
            { selector: '.moodboard-toolbar__button--image2', text: 'Добавить картинку' },
            { selector: '.moodboard-toolbar__button--pencil', text: 'Рисование' },
        ];

        for (const item of checks) {
            const button = container.querySelector(item.selector);
            button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            vi.advanceTimersByTime(320);
            expect(button._tooltip).toHaveTextContent(item.text);
            expect(button._tooltip).toHaveClass('moodboard-tooltip--show');
            button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
            vi.advanceTimersByTime(120);
        }
    });

    it('recreating toolbar instance does not duplicate note-add place emits', async () => {
        const firstButton = container.querySelector('.moodboard-toolbar__button--note');
        eventBus.emit.mockClear();
        firstButton.click();
        const firstCount = eventBus.emit.mock.calls.filter(([event]) => event === Events.Place.Set).length;
        expect(firstCount).toBe(1);

        toolbar.destroy();
        container.innerHTML = '';
        const nextBus = createEventBus();
        const nextToolbar = new Toolbar(container, nextBus);
        await flushToolbarInit();
        nextBus.emit.mockClear();

        const secondButton = container.querySelector('.moodboard-toolbar__button--note');
        secondButton.click();
        const secondCount = nextBus.emit.mock.calls.filter(([event]) => event === Events.Place.Set).length;
        expect(secondCount).toBe(1);

        nextToolbar.destroy();
    });
});
