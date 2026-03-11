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

describe('Toolbar baseline: render contracts', () => {
    let container;
    let toolbar;
    let eventBus;

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        eventBus = createEventBus();
        toolbar = new Toolbar(container, eventBus);
        await flushToolbarInit();
    });

    afterEach(() => {
        toolbar?.destroy?.();
        container?.remove();
        vi.restoreAllMocks();
    });

    it.skip('renders key toolbar buttons with expected data attributes and classes', () => {
        const expectedButtons = [
            { id: 'select', tool: 'activate-select' },
            { id: 'pan', tool: 'activate-pan' },
            { id: 'text-add', tool: 'text-add' },
            { id: 'note', tool: 'note-add' },
            { id: 'image', tool: 'image-add' },
            { id: 'image2', tool: 'image2-add' },
            { id: 'shapes', tool: 'custom-shapes' },
            { id: 'pencil', tool: 'custom-draw' },
            { id: 'attachments', tool: 'custom-attachments' },
            { id: 'emoji', tool: 'custom-emoji' },
            { id: 'frame', tool: 'frame' },
            { id: 'undo', tool: 'undo' },
            { id: 'redo', tool: 'redo' },
        ];

        for (const item of expectedButtons) {
            const button = container.querySelector(`.moodboard-toolbar__button--${item.id}`);
            expect(button).toBeInTheDocument();
            expect(button).toBeVisible();
            expect(button).toHaveAttribute('data-tool-id', item.id);
            expect(button).toHaveAttribute('data-tool', item.tool);
        }
    });

    it('keeps initial undo/redo disabled contract', () => {
        const undo = container.querySelector('.moodboard-toolbar__button--undo');
        const redo = container.querySelector('.moodboard-toolbar__button--redo');

        expect(undo).toBeDisabled();
        expect(redo).toBeDisabled();
        expect(undo).toHaveClass('moodboard-toolbar__button--disabled');
        expect(redo).toHaveClass('moodboard-toolbar__button--disabled');
    });

    it('updates undo/redo state from history event contract', () => {
        eventBus.emit(Events.UI.UpdateHistoryButtons, { canUndo: true, canRedo: false });

        const undo = container.querySelector('.moodboard-toolbar__button--undo');
        const redo = container.querySelector('.moodboard-toolbar__button--redo');

        expect(undo).not.toBeDisabled();
        expect(redo).toBeDisabled();
        expect(undo.title).toBe('Отменить последнее действие (Ctrl+Z)');
        expect(redo.title).toBe('Нет действий для повтора');
    });
});
