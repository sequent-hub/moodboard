import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../src/core/events/Events.js';
import { TextPropertiesPanel } from '../../src/ui/TextPropertiesPanel.js';
import { createTextPropertiesPanelContext } from './TextPropertiesPanel.baseline.helpers.js';

describe('TextPropertiesPanel baseline: event contracts', () => {
    let ctx;
    let panel;

    beforeEach(() => {
        vi.useFakeTimers();
        ctx = createTextPropertiesPanelContext();
        panel = new TextPropertiesPanel(ctx.container, ctx.eventBus, ctx.core);
        panel.attach();
    });

    afterEach(() => {
        panel?.destroy();
        ctx?.cleanup();
        vi.useRealTimers();
    });

    it('event name constants used by the panel remain stable', () => {
        expect(Events.Tool.SelectionAdd).toBe('tool:selection:add');
        expect(Events.Tool.SelectionRemove).toBe('tool:selection:remove');
        expect(Events.Tool.SelectionClear).toBe('tool:selection:clear');
        expect(Events.Tool.GetObjectPosition).toBe('tool:get:object:position');
        expect(Events.Tool.GetObjectSize).toBe('tool:get:object:size');
        expect(Events.Tool.GetObjectPixi).toBe('tool:get:object:pixi');
        expect(Events.UI.TextEditStart).toBe('ui:text:edit:start');
        expect(Events.UI.TextEditEnd).toBe('ui:text:edit:end');
        expect(Events.Object.Deleted).toBe('object:deleted');
        expect(Events.Object.StateChanged).toBe('state:changed');
    });

    it('reacts to selection add/remove by re-evaluating selected text object', () => {
        const updateSpy = vi.spyOn(panel, 'updateFromSelection');
        ctx.setObject('text-1');
        ctx.setSelected(['text-1']);

        ctx.eventBus.emit(Events.Tool.SelectionAdd);
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(panel.currentId).toBe('text-1');
        expect(panel.panel.style.display).toBe('flex');

        ctx.setSelected([]);
        ctx.eventBus.emit(Events.Tool.SelectionRemove);
        expect(updateSpy).toHaveBeenCalledTimes(2);
        expect(panel.currentId).toBeNull();
        expect(panel.panel.style.display).toBe('none');
    });

    it('re-hydrates controls when selection switches between different text objects', () => {
        ctx.setObject('text-1', {
            properties: {
                fontFamily: 'Roboto, Arial, sans-serif',
                fontSize: 18,
                color: '#000000',
                backgroundColor: 'transparent',
            },
        });
        ctx.setObject('text-2', {
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
        expect(panel.fontSelect.value).toBe('Roboto, Arial, sans-serif');
        expect(panel.fontSizeSelect.value).toBe('18');

        ctx.setSelected(['text-2']);
        ctx.eventBus.emit(Events.Tool.SelectionAdd);

        expect(panel.currentId).toBe('text-2');
        expect(panel.panel.style.display).toBe('flex');
        expect(panel.fontSelect.value).toBe('"Playfair Display", Georgia, serif');
        expect(panel.fontSizeSelect.value).toBe('32');
        expect(panel.currentColorButton.title).toBe('Текущий цвет: #34C759');
        expect(panel.currentBgColorButton.title).toBe('Цвет выделения: #ff9999');
    });

    it('hides on selection clear and on deletion of the currently shown object only', () => {
        ctx.setObject('text-1');
        ctx.setObject('text-2');
        ctx.setSelected(['text-1']);
        panel.updateFromSelection();

        ctx.eventBus.emit(Events.Object.Deleted, { objectId: 'text-2' });
        expect(panel.currentId).toBe('text-1');
        expect(panel.panel.style.display).toBe('flex');

        ctx.eventBus.emit(Events.Object.Deleted, { objectId: 'text-1' });
        expect(panel.currentId).toBeNull();
        expect(panel.panel.style.display).toBe('none');

        ctx.setSelected(['text-1']);
        panel.updateFromSelection();
        ctx.eventBus.emit(Events.Tool.SelectionClear);
        expect(panel.currentId).toBeNull();
        expect(panel.panel.style.display).toBe('none');
    });

    it('repositions on transform and viewport events while visible', () => {
        const repositionSpy = vi.spyOn(panel, 'reposition');
        ctx.setObject('text-1');
        ctx.setSelected(['text-1']);
        panel.updateFromSelection();
        repositionSpy.mockClear();

        const responsiveEvents = [
            Events.Tool.DragUpdate,
            Events.Tool.GroupDragUpdate,
            Events.Tool.ResizeUpdate,
            Events.Tool.RotateUpdate,
            Events.UI.ZoomPercent,
            Events.Tool.PanUpdate,
        ];

        for (const eventName of responsiveEvents) {
            ctx.eventBus.emit(eventName);
        }

        expect(repositionSpy).toHaveBeenCalledTimes(responsiveEvents.length);
    });

    it('hides during text edit and restores selection-driven visibility after TextEditEnd timeout', () => {
        ctx.setObject('text-1');
        ctx.setSelected(['text-1']);
        panel.updateFromSelection();
        const updateSpy = vi.spyOn(panel, 'updateFromSelection');
        updateSpy.mockClear();

        ctx.eventBus.emit(Events.UI.TextEditStart);
        expect(panel.isTextEditing).toBe(true);
        expect(panel.currentId).toBeNull();
        expect(panel.panel.style.display).toBe('none');

        ctx.eventBus.emit(Events.UI.TextEditEnd);
        expect(panel.isTextEditing).toBe(false);
        expect(updateSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(99);
        expect(updateSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(panel.currentId).toBe('text-1');
        expect(panel.panel.style.display).toBe('flex');
    });
});
