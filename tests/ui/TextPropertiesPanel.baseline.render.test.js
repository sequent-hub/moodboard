import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { TextPropertiesPanel } from '../../src/ui/TextPropertiesPanel.js';
import { createTextPropertiesPanelContext } from './TextPropertiesPanel.baseline.helpers.js';

describe('TextPropertiesPanel baseline: render and visibility contracts', () => {
    let ctx;
    let panel;

    beforeEach(() => {
        ctx = createTextPropertiesPanelContext();
        panel = new TextPropertiesPanel(ctx.container, ctx.eventBus, ctx.core);
        panel.attach();
    });

    afterEach(() => {
        panel?.destroy();
        ctx?.cleanup();
    });

    it('creates one root layer on attach and keeps panel hidden before selection', () => {
        const layer = ctx.container.querySelector('.text-properties-layer');

        expect(layer).toBeInTheDocument();
        expect(Number(layer.style.zIndex)).toBeGreaterThan(10000);
        expect(layer.style.pointerEvents).toBe('none');
        expect(layer.querySelector('.text-properties-panel')).toBeNull();
        expect(panel.panel).toBeNull();
        expect(panel.currentId).toBeNull();
    });

    it('renders key controls when shown for a text object', () => {
        ctx.setObject('text-1', {
            properties: {
                fontFamily: 'Roboto, Arial, sans-serif',
                fontSize: 24,
                color: '#6155F5',
                backgroundColor: '#ffff99',
            },
        });
        ctx.setSelected(['text-1']);

        panel.updateFromSelection();

        expect(panel.panel).toBeInTheDocument();
        expect(panel.panel).toBeVisible();
        expect(panel.panel.style.display).toBe('flex');
        expect(panel.panel.querySelector('.font-select')).toBe(panel.fontSelect);
        expect(panel.panel.querySelector('.font-size-select')).toBe(panel.fontSizeSelect);
        expect(panel.panel.querySelector('.current-color-button')).toBe(panel.currentColorButton);
        expect(panel.panel.querySelector('.current-bgcolor-button')).toBe(panel.currentBgColorButton);
        expect(panel.fontSelect.options).toHaveLength(12);
        expect(panel.fontSizeSelect.options).toHaveLength(14);
    });

    it('hydrates controls from selected text object properties', () => {
        ctx.setObject('text-1', {
            properties: {
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 32,
                color: '#34C759',
                backgroundColor: '#ff9999',
            },
        });
        ctx.setSelected(['text-1']);

        panel.updateFromSelection();

        expect(panel.currentId).toBe('text-1');
        expect(panel.fontSelect.value).toBe('"Playfair Display", Georgia, serif');
        expect(panel.fontSizeSelect.value).toBe('32');
        expect(panel.currentColorButton.title).toBe('Текущий цвет: #34C759');
        expect(panel.colorInput.value).toBe('#34c759');
        expect(panel.currentBgColorButton.title).toBe('Цвет выделения: #ff9999');
        expect(panel.bgColorInput.value).toBe('#ff9999');
    });

    it('applies default control values when text object has no properties payload', () => {
        ctx.setObject('text-1', { properties: {} });
        ctx.setSelected(['text-1']);

        panel.updateFromSelection();

        expect(panel.fontSelect.value).toBe('Roboto, Arial, sans-serif');
        expect(panel.fontSizeSelect.value).toBe('18');
        expect(panel.currentColorButton.title).toBe('Текущий цвет: #000000');
        expect(panel.currentBgColorButton.title).toBe('Без выделения');
        expect(panel.bgColorInput.value).toBe('#ffff99');
    });

    it('stays hidden for unsupported selection states', () => {
        ctx.setObject('note-1', { type: 'note' });
        ctx.setObject('text-1', { type: 'text' });

        ctx.setSelected([]);
        panel.updateFromSelection();
        expect(panel.currentId).toBeNull();
        expect(panel.panel).toBeNull();

        ctx.setSelected(['note-1']);
        panel.updateFromSelection();
        expect(panel.currentId).toBeNull();
        expect(panel.panel).toBeNull();

        ctx.setSelected(['text-1', 'note-1']);
        panel.updateFromSelection();
        expect(panel.currentId).toBeNull();
        expect(panel.panel).toBeNull();
    });

    it('hides visible panel on outside click and on selection clear', () => {
        ctx.setObject('text-1');
        ctx.setSelected(['text-1']);
        panel.updateFromSelection();

        expect(panel.panel.style.display).toBe('flex');

        document.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            clientX: 10,
            clientY: 10,
        }));

        expect(panel.currentId).toBeNull();
        expect(panel.panel.style.display).toBe('none');

        ctx.setSelected(['text-1']);
        panel.updateFromSelection();

        ctx.eventBus.emit('tool:selection:clear');
        expect(panel.currentId).toBeNull();
        expect(panel.panel.style.display).toBe('none');
    });
});

describe('TextPropertiesPanel _addHighlight: content sync with live editor', () => {
    let ctx;
    let panel;

    beforeEach(() => {
        ctx = createTextPropertiesPanelContext();
        panel = new TextPropertiesPanel(ctx.container, ctx.eventBus, ctx.core);
        panel.attach();
    });

    afterEach(() => {
        panel?.destroy();
        ctx?.cleanup();
        document.querySelector('.moodboard-text-input')?.remove();
    });

    it('includes content in StateChanged when a live editor is open', () => {
        // Объект с initialContent = "Hello"
        ctx.setObject('t1', { properties: { content: 'Hello', highlights: [] } });
        panel.currentId = 't1';

        // Симулируем открытый редактор с уже изменённым текстом "Hello World"
        const textarea = document.createElement('textarea');
        textarea.className = 'moodboard-text-input';
        textarea.value = 'Hello World';
        document.body.appendChild(textarea);

        // Снимаем снэпшот выделения (символы 6..11 = "World")
        panel._savedTextSelection = { start: 6, end: 11 };

        const emittedStateChanges = [];
        const origEmit = ctx.eventBus.emit;
        ctx.eventBus.emit = vi.fn((event, payload) => {
            emittedStateChanges.push({ event, payload });
            origEmit.call(ctx.eventBus, event, payload);
        });

        panel._addHighlight('#ffff00', 6, 11, 't1');

        const stateEvt = emittedStateChanges.find(
            (e) => e.event === 'object:state:changed' || (e.payload?.updates?.properties?.highlights)
        );
        expect(stateEvt).toBeTruthy();
        // content должен быть синхронизирован из живого редактора
        expect(stateEvt.payload.updates.properties.content).toBe('Hello World');
        // диапазон подсветки корректный
        expect(stateEvt.payload.updates.properties.highlights).toEqual([
            { start: 6, end: 11, color: '#ffff00' },
        ]);
    });

    it('omits content in StateChanged when no live editor is open', () => {
        ctx.setObject('t1', { properties: { content: 'Hello', highlights: [] } });
        panel.currentId = 't1';

        const emittedStateChanges = [];
        const origEmit = ctx.eventBus.emit;
        ctx.eventBus.emit = vi.fn((event, payload) => {
            emittedStateChanges.push({ event, payload });
            origEmit.call(ctx.eventBus, event, payload);
        });

        panel._addHighlight('#ffff00', 0, 5, 't1');

        const stateEvt = emittedStateChanges.find(
            (e) => e.payload?.updates?.properties?.highlights
        );
        expect(stateEvt).toBeTruthy();
        expect(stateEvt.payload.updates.properties.content).toBeUndefined();
    });
});
