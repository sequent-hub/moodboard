import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../src/core/events/Events.js';

vi.mock('../../src/utils/iconLoader.js', () => {
    return {
        IconLoader: class {
            async init() {}
            async loadAllIcons() {
                return { image: '<svg viewBox="0 0 24 24"></svg>' };
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

function lastEventPayload(emitMock, eventName) {
    const found = emitMock.mock.calls.filter(([name]) => name === eventName);
    return found.length ? found[found.length - 1][1] : undefined;
}

describe('Toolbar baseline: dialog contracts', () => {
    let container;
    let toolbar;
    let eventBus;
    let clickSpy;

    beforeEach(async () => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        eventBus = createEventBus();
        clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
        toolbar = new Toolbar(container, eventBus);
        await flushToolbarInit();
    });

    afterEach(() => {
        toolbar?.destroy?.();
        container?.remove();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('openImageDialog opens image file picker and emits selected payload + place activation', async () => {
        await toolbar.openImageDialog();
        const input = document.querySelector('input[type="file"][accept="image/*"]');
        expect(input).toBeInTheDocument();
        expect(clickSpy).toHaveBeenCalled();

        const file = new File(['img'], 'photo.png', { type: 'image/png' });
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        input.dispatchEvent(new Event('change'));

        const payload = lastEventPayload(eventBus.emit, Events.Place.ImageSelected);
        expect(payload).toEqual(
            expect.objectContaining({
                fileName: 'photo.png',
                mimeType: 'image/png',
                properties: expect.objectContaining({
                    width: expect.any(Number),
                    height: expect.any(Number),
                }),
            })
        );
        expect(eventBus.emit).toHaveBeenCalledWith(Events.Keyboard.ToolSelect, { tool: 'place' });
    });

    it('openImageDialog emits canceled on picker cancel', async () => {
        await toolbar.openImageDialog();
        const input = document.querySelector('input[type="file"][accept="image/*"]');
        Object.defineProperty(input, 'files', { configurable: true, value: [] });

        window.dispatchEvent(new Event('focus'));
        vi.advanceTimersByTime(150);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.Place.ImageCanceled);
    });

    it('openImageObject2Dialog opens picker and emits selected payload contract', async () => {
        await toolbar.openImageObject2Dialog();
        const picker = document.querySelector('input[type="file"][accept="image/*"]');
        expect(picker).toBeInTheDocument();
        expect(clickSpy).toHaveBeenCalled();

        const file = new File(['img2'], 'next.png', { type: 'image/png' });
        Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
        picker.dispatchEvent(new Event('change'));

        const payload = lastEventPayload(eventBus.emit, Events.Place.ImageObject2Selected);
        expect(payload).toEqual(
            expect.objectContaining({
                fileName: 'next.png',
                mimeType: 'image/png',
                source: 'toolbar:image2',
                defaults: expect.objectContaining({
                    width: expect.any(Number),
                    height: expect.any(Number),
                }),
            })
        );
    });

    it('openImageObject2Dialog emits canceled payload contract on cancel', async () => {
        await toolbar.openImageObject2Dialog();
        const picker = document.querySelector('input[type="file"][accept="image/*"]');
        Object.defineProperty(picker, 'files', { configurable: true, value: [] });

        window.dispatchEvent(new Event('focus'));
        vi.advanceTimersByTime(150);

        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Place.ImageObject2Canceled,
            expect.objectContaining({ source: 'toolbar:image2' })
        );
    });

    it('openFileDialog opens generic picker and emits selected payload + place activation', async () => {
        await toolbar.openFileDialog();
        const input = document.querySelector('input[type="file"][accept="*/*"]');
        expect(input).toBeInTheDocument();
        expect(clickSpy).toHaveBeenCalled();

        const file = new File(['doc'], 'contract.pdf', { type: 'application/pdf' });
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        input.dispatchEvent(new Event('change'));

        const payload = lastEventPayload(eventBus.emit, Events.Place.FileSelected);
        expect(payload).toEqual(
            expect.objectContaining({
                fileName: 'contract.pdf',
                mimeType: 'application/pdf',
                properties: expect.objectContaining({
                    width: expect.any(Number),
                    height: expect.any(Number),
                }),
            })
        );
        expect(eventBus.emit).toHaveBeenCalledWith(Events.Keyboard.ToolSelect, { tool: 'place' });
    });

    it('openFileDialog emits canceled on picker cancel', async () => {
        await toolbar.openFileDialog();
        const input = document.querySelector('input[type="file"][accept="*/*"]');
        Object.defineProperty(input, 'files', { configurable: true, value: [] });

        window.dispatchEvent(new Event('focus'));
        vi.advanceTimersByTime(150);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.Place.FileCanceled);
    });
});
