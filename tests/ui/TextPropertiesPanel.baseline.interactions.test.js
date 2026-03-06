import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../src/core/events/Events.js';
import { TextPropertiesPanel } from '../../src/ui/TextPropertiesPanel.js';
import { createTextPropertiesPanelContext } from './TextPropertiesPanel.baseline.helpers.js';

function getLastStateChangedCall(eventBus) {
    const calls = eventBus.emit.mock.calls.filter(([eventName]) => eventName === Events.Object.StateChanged);
    return calls.at(-1);
}

describe('TextPropertiesPanel baseline: interactions contracts', () => {
    let ctx;
    let panel;
    let htmlText;
    let pixiObject;

    beforeEach(() => {
        ctx = createTextPropertiesPanelContext();
        pixiObject = ctx.setObject('text-1', {
            properties: {
                fontFamily: 'Roboto, Arial, sans-serif',
                fontSize: 18,
                color: '#000000',
                backgroundColor: 'transparent',
            },
        });
        htmlText = ctx.setHtmlTextElement('text-1');
        ctx.setSelected(['text-1']);
        panel = new TextPropertiesPanel(ctx.container, ctx.eventBus, ctx.core);
        panel.attach();
        panel.updateFromSelection();
        ctx.eventBus.emit.mockClear();
        ctx.core.state.markDirty.mockClear();
    });

    afterEach(() => {
        panel?.destroy();
        ctx?.cleanup();
    });

    it('emits stable payload for font family change and syncs UI/model state', () => {
        panel.fontSelect.value = '"Playfair Display", Georgia, serif';
        panel.fontSelect.dispatchEvent(new Event('change', { bubbles: true }));

        expect(getLastStateChangedCall(ctx.eventBus)).toEqual([
            Events.Object.StateChanged,
            {
                objectId: 'text-1',
                updates: {
                    properties: {
                        fontFamily: '"Playfair Display", Georgia, serif',
                    },
                },
            },
        ]);
        expect(htmlText.style.fontFamily).toBe('"Playfair Display", Georgia, serif');
        expect(pixiObject._mb.properties.fontFamily).toBe('"Playfair Display", Georgia, serif');
        expect(ctx.core.state.markDirty).toHaveBeenCalledTimes(1);
    });

    it('emits stable payload for font size change and syncs html preview', () => {
        panel.fontSizeSelect.value = '32';
        panel.fontSizeSelect.dispatchEvent(new Event('change', { bubbles: true }));

        expect(getLastStateChangedCall(ctx.eventBus)).toEqual([
            Events.Object.StateChanged,
            {
                objectId: 'text-1',
                updates: {
                    fontSize: 32,
                },
            },
        ]);
        expect(htmlText.style.fontSize).toBe('32px');
        expect(pixiObject._mb.properties.fontSize).toBe(32);
        expect(ctx.core.state.markDirty).toHaveBeenCalledTimes(1);
    });

    it('selecting text color emits expected payload and closes dropdown', () => {
        panel.currentColorButton.click();
        expect(panel.colorDropdown.style.display).toBe('block');

        const purplePreset = Array.from(panel.colorDropdown.querySelectorAll('button'))
            .find((button) => button.title === '#6155F5');
        purplePreset.click();

        expect(getLastStateChangedCall(ctx.eventBus)).toEqual([
            Events.Object.StateChanged,
            {
                objectId: 'text-1',
                updates: {
                    color: '#6155F5',
                },
            },
        ]);
        expect(panel.colorDropdown.style.display).toBe('none');
        expect(panel.currentColorButton.title).toBe('Текущий цвет: #6155F5');
        expect(panel.colorInput.value).toBe('#6155f5');
        expect(htmlText.style.color).toBe('rgb(97, 85, 245)');
        expect(pixiObject._mb.properties.color).toBe('#6155F5');
        expect(ctx.core.state.markDirty).toHaveBeenCalledTimes(1);
    });

    it('custom text color input emits expected payload and updates current swatch', () => {
        panel.colorInput.value = '#123456';
        panel.colorInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(getLastStateChangedCall(ctx.eventBus)).toEqual([
            Events.Object.StateChanged,
            {
                objectId: 'text-1',
                updates: {
                    color: '#123456',
                },
            },
        ]);
        expect(panel.currentColorButton.title).toBe('Текущий цвет: #123456');
        expect(htmlText.style.color).toBe('rgb(18, 52, 86)');
        expect(pixiObject._mb.properties.color).toBe('#123456');
    });

    it('background preset emits expected payload and keeps transparent contract distinct', () => {
        panel.currentBgColorButton.click();
        expect(panel.bgColorDropdown.style.display).toBe('block');

        const transparentButton = Array.from(panel.bgColorDropdown.querySelectorAll('button'))
            .find((button) => button.title === 'Без выделения');
        transparentButton.click();

        expect(getLastStateChangedCall(ctx.eventBus)).toEqual([
            Events.Object.StateChanged,
            {
                objectId: 'text-1',
                updates: {
                    backgroundColor: 'transparent',
                },
            },
        ]);
        expect(panel.bgColorDropdown.style.display).toBe('none');
        expect(panel.currentBgColorButton.title).toBe('Без выделения');
        expect(panel.bgColorInput.value).toBe('#ffff99');
        expect(htmlText.style.backgroundColor).toBe('');
        expect(pixiObject._mb.properties.backgroundColor).toBe('transparent');
        expect(ctx.core.state.markDirty).toHaveBeenCalledTimes(1);
    });

    it('custom background color emits expected payload and updates html preview', () => {
        panel.bgColorInput.value = '#abcdef';
        panel.bgColorInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(getLastStateChangedCall(ctx.eventBus)).toEqual([
            Events.Object.StateChanged,
            {
                objectId: 'text-1',
                updates: {
                    backgroundColor: '#abcdef',
                },
            },
        ]);
        expect(panel.currentBgColorButton.title).toBe('Цвет выделения: #abcdef');
        expect(htmlText.style.backgroundColor).toBe('rgb(171, 205, 239)');
        expect(pixiObject._mb.properties.backgroundColor).toBe('#abcdef');
    });
});
