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
                    shapes: '<svg viewBox="0 0 24 24"></svg>',
                    pencil: '<svg viewBox="0 0 24 24"></svg>',
                    emoji: '<svg viewBox="0 0 24 24"></svg>',
                    frame: '<svg viewBox="0 0 24 24"></svg>',
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

describe('Toolbar baseline: popup contracts', () => {
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

    it('shapes popup toggles on repeated button clicks', () => {
        const button = container.querySelector('.moodboard-toolbar__button--shapes');
        expect(toolbar.shapesPopupEl.style.display).toBe('none');

        button.click();
        expect(toolbar.shapesPopupEl.style.display).toBe('block');

        button.click();
        expect(toolbar.shapesPopupEl.style.display).toBe('none');
    });

    it('draw popup toggles on repeated button clicks', () => {
        const button = container.querySelector('.moodboard-toolbar__button--pencil');
        expect(toolbar.drawPopupEl.style.display).toBe('none');

        button.click();
        expect(toolbar.drawPopupEl.style.display).toBe('block');

        button.click();
        expect(toolbar.drawPopupEl.style.display).toBe('none');
    });

    it('emoji popup toggles on repeated button clicks', () => {
        const button = container.querySelector('.moodboard-toolbar__button--emoji');
        expect(toolbar.emojiPopupEl.style.display).toBe('none');

        button.click();
        expect(toolbar.emojiPopupEl.style.display).toBe('block');

        button.click();
        expect(toolbar.emojiPopupEl.style.display).toBe('none');
    });

    it('frame popup toggles on repeated button clicks', () => {
        const button = container.querySelector('.moodboard-toolbar__button--frame');
        expect(toolbar.framePopupEl.style.display).toBe('none');

        button.click();
        expect(toolbar.framePopupEl.style.display).toBe('grid');

        button.click();
        expect(toolbar.framePopupEl.style.display).toBe('none');
    });

    it('opening a popup closes other popups', () => {
        const shapes = container.querySelector('.moodboard-toolbar__button--shapes');
        const draw = container.querySelector('.moodboard-toolbar__button--pencil');
        const emoji = container.querySelector('.moodboard-toolbar__button--emoji');
        const frame = container.querySelector('.moodboard-toolbar__button--frame');

        shapes.click();
        expect(toolbar.shapesPopupEl.style.display).toBe('block');

        draw.click();
        expect(toolbar.drawPopupEl.style.display).toBe('block');
        expect(toolbar.shapesPopupEl.style.display).toBe('none');

        emoji.click();
        expect(toolbar.emojiPopupEl.style.display).toBe('block');
        expect(toolbar.drawPopupEl.style.display).toBe('none');

        frame.click();
        expect(toolbar.framePopupEl.style.display).toBe('grid');
        expect(toolbar.emojiPopupEl.style.display).toBe('none');
    });

    it('outside click closes all open popups', () => {
        container.querySelector('.moodboard-toolbar__button--shapes').click();
        container.querySelector('.moodboard-toolbar__button--pencil').click();
        container.querySelector('.moodboard-toolbar__button--emoji').click();
        container.querySelector('.moodboard-toolbar__button--frame').click();

        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(toolbar.shapesPopupEl.style.display).toBe('none');
        expect(toolbar.drawPopupEl.style.display).toBe('none');
        expect(toolbar.emojiPopupEl.style.display).toBe('none');
        expect(toolbar.framePopupEl.style.display).toBe('none');
    });

    it('clicking shapes popup action emits Place.Set for shape', () => {
        container.querySelector('.moodboard-toolbar__button--shapes').click();
        const shapeBtn = toolbar.shapesPopupEl.querySelector('.moodboard-shapes__btn--shape');
        shapeBtn.click();

        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Place.Set,
            expect.objectContaining({
                type: 'shape',
                properties: expect.objectContaining({ kind: 'square' }),
            })
        );
    });
});
