import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../src/core/events/Events.js';
import { TextPropertiesPanel } from '../../src/ui/TextPropertiesPanel.js';
import {
    createTextPropertiesPanelContext,
    getOnEventCounts,
} from './TextPropertiesPanel.baseline.helpers.js';

describe('TextPropertiesPanel baseline: lifecycle contracts', () => {
    let ctx;
    let panel;
    let addSpy;
    let removeSpy;

    beforeEach(() => {
        ctx = createTextPropertiesPanelContext();
        addSpy = vi.spyOn(document, 'addEventListener');
        removeSpy = vi.spyOn(document, 'removeEventListener');
        panel = new TextPropertiesPanel(ctx.container, ctx.eventBus, ctx.core);
    });

    afterEach(() => {
        panel?.destroy();
        addSpy.mockRestore();
        removeSpy.mockRestore();
        ctx?.cleanup();
    });

    it('attach subscribes expected EventBus channels once and creates one root layer', () => {
        panel.attach();

        expect(ctx.container.querySelectorAll('.text-properties-layer')).toHaveLength(1);

        const counts = getOnEventCounts(ctx.eventBus.on);
        expect(counts.get(Events.Tool.SelectionAdd)).toBe(1);
        expect(counts.get(Events.Tool.SelectionRemove)).toBe(1);
        expect(counts.get(Events.Tool.SelectionClear)).toBe(1);
        expect(counts.get(Events.Tool.DragUpdate)).toBe(1);
        expect(counts.get(Events.Tool.GroupDragUpdate)).toBe(1);
        expect(counts.get(Events.Tool.ResizeUpdate)).toBe(1);
        expect(counts.get(Events.Tool.RotateUpdate)).toBe(1);
        expect(counts.get(Events.UI.ZoomPercent)).toBe(1);
        expect(counts.get(Events.Tool.PanUpdate)).toBe(1);
        expect(counts.get(Events.Object.Deleted)).toBe(1);
        expect(counts.get(Events.UI.TextEditStart)).toBe(1);
        expect(counts.get(Events.UI.TextEditEnd)).toBe(1);
        expect(counts.get(Events.Object.StateChanged)).toBe(1);
    });

    it('show/hide pair installs and removes capture-phase mousedown hook', () => {
        ctx.setObject('text-1');
        ctx.setSelected(['text-1']);
        panel.attach();

        panel.updateFromSelection();

        const addCall = addSpy.mock.calls.find(([name, handler, options]) =>
            name === 'mousedown' && handler === panel._onDocMouseDown && options === true
        );
        expect(addCall).toBeTruthy();

        panel.hide();

        expect(removeSpy).toHaveBeenCalledWith('mousedown', panel._onDocMouseDown, true);
    });

    it('does not duplicate capture-phase mousedown hook on repeated selection updates while visible', () => {
        ctx.setObject('text-1');
        ctx.setSelected(['text-1']);
        panel.attach();

        panel.updateFromSelection();
        panel.updateFromSelection();
        panel.updateFromSelection();

        const mousedownAdds = addSpy.mock.calls.filter(([name, handler, options]) =>
            name === 'mousedown' && handler === panel._onDocMouseDown && options === true
        );

        expect(mousedownAdds).toHaveLength(1);
    });

    it('destroy removes root DOM, hides panel state, and repeated destroy is safe', () => {
        ctx.setObject('text-1');
        ctx.setSelected(['text-1']);
        panel.attach();
        panel.updateFromSelection();

        expect(ctx.container.querySelector('.text-properties-layer')).toBeInTheDocument();
        expect(panel.panel.style.display).toBe('flex');

        expect(() => panel.destroy()).not.toThrow();
        expect(ctx.container.querySelector('.text-properties-layer')).toBeNull();
        expect(panel.layer).toBeNull();
        expect(panel.currentId).toBeNull();
        expect(panel.panel.style.display).toBe('none');
        expect(removeSpy).toHaveBeenCalledWith('mousedown', panel._onDocMouseDown, true);

        expect(() => panel.destroy()).not.toThrow();
    });

    it('destroy unsubscribes the same EventBus channels that attach subscribed', () => {
        panel.attach();

        const subscribedEvents = ctx.eventBus.on.mock.calls.map(([eventName]) => eventName);
        expect(subscribedEvents).toEqual([
            Events.Tool.SelectionAdd,
            Events.Tool.SelectionRemove,
            Events.Tool.SelectionClear,
            Events.Tool.DragUpdate,
            Events.Tool.GroupDragUpdate,
            Events.Tool.ResizeUpdate,
            Events.Tool.RotateUpdate,
            Events.UI.ZoomPercent,
            Events.Tool.PanUpdate,
            Events.Object.Deleted,
            Events.UI.TextEditStart,
            Events.UI.TextEditEnd,
            Events.Object.StateChanged,
        ]);

        panel.destroy();

        const unsubscribedEvents = ctx.eventBus.off.mock.calls.map(([eventName]) => eventName);
        expect(unsubscribedEvents).toEqual(subscribedEvents);
        expect(unsubscribedEvents).toHaveLength(13);
    });

    it('destroyed instance can be replaced without duplicating root layer nodes', () => {
        panel.attach();
        panel.destroy();

        const next = new TextPropertiesPanel(ctx.container, ctx.eventBus, ctx.core);
        next.attach();

        expect(ctx.container.querySelectorAll('.text-properties-layer')).toHaveLength(1);

        next.destroy();
    });
});
