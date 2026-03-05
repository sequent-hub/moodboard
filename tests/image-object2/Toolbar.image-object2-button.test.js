import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../src/utils/iconLoader.js', () => {
    return {
        IconLoader: class {
            async init() {}
            async loadAllIcons() {
                return {
                    image: '<svg viewBox="0 0 24 24"></svg>'
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

function createMockEventBus() {
    return {
        on: vi.fn(),
        emit: vi.fn(),
        off: vi.fn(),
        removeAllListeners: vi.fn()
    };
}

async function flushToolbarInit() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('Toolbar ImageObject2 button', () => {
    let container;
    let toolbar;
    let eventBus;
    let clickSpy;

    beforeEach(async () => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        eventBus = createMockEventBus();

        vi.spyOn(Toolbar.prototype, 'createShapesPopup').mockImplementation(() => {});
        vi.spyOn(Toolbar.prototype, 'createDrawPopup').mockImplementation(() => {});
        vi.spyOn(Toolbar.prototype, 'createEmojiPopup').mockImplementation(() => {});
        vi.spyOn(Toolbar.prototype, 'createFramePopup').mockImplementation(() => {});

        clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

        toolbar = new Toolbar(container, eventBus);
        await flushToolbarInit();
    });

    afterEach(() => {
        try {
            toolbar?.destroy?.();
        } catch (_) {}
        container?.remove();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('button exists and is visible on toolbar', () => {
        const button = container.querySelector('.moodboard-toolbar__button--image2');
        expect(button).toBeInTheDocument();
        expect(button).toBeVisible();
    });

    it('button has hover style rule in toolbar css', () => {
        const cssPath = path.resolve(process.cwd(), 'src/ui/styles/toolbar.css');
        const css = fs.readFileSync(cssPath, 'utf8');

        expect(css).toContain('.moodboard-toolbar__button--image2:hover');
    });

    it('shows tooltip text "Добавить картинку" on hover', async () => {
        const button = container.querySelector('.moodboard-toolbar__button--image2');
        expect(button).toBeInTheDocument();

        button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(350);
        await Promise.resolve();

        const tooltip = button._tooltip;
        expect(tooltip).toBeInTheDocument();
        expect(tooltip).toHaveTextContent('Добавить картинку');
    });

    it('opens file picker dialog on button click', () => {
        const button = container.querySelector('.moodboard-toolbar__button--image2');
        expect(button).toBeInTheDocument();

        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
        expect(fileInput).toBeInTheDocument();
        expect(clickSpy).toHaveBeenCalled();
    });
});
