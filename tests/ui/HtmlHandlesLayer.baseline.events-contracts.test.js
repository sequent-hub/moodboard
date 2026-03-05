import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

function eventNames(onMock) {
    return onMock.mock.calls.map(([name]) => name);
}

describe('HtmlHandlesLayer baseline: event contracts', () => {
    let ctx;
    let layer;

    beforeEach(() => {
        ctx = createHtmlHandlesContext();
        layer = new HtmlHandlesLayer(ctx.container, ctx.eventBus, ctx.core);
        layer.attach();
    });

    afterEach(() => {
        layer?.destroy();
        ctx?.cleanup();
    });

    it('subscribes to expected selection/transform channels', () => {
        const names = eventNames(ctx.eventBus.on);

        const required = [
            Events.Tool.SelectionAdd,
            Events.Tool.SelectionClear,
            Events.Object.TransformUpdated,
            Events.Tool.ResizeUpdate,
            Events.Tool.RotateUpdate,
            Events.Tool.GroupResizeUpdate,
            Events.Tool.GroupRotateUpdate,
            Events.UI.ZoomPercent,
            Events.Tool.PanUpdate,
        ];

        for (const eventName of required) {
            expect(names).toContain(eventName);
            expect(names.filter((name) => name === eventName).length).toBe(1);
        }
    });

    it('reacts to SelectionAdd and SelectionClear with update/hide', () => {
        ctx.setObject('obj-1', { x: 20, y: 40, width: 120, height: 70, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-1');

        const updateSpy = vi.spyOn(layer, 'update');
        const hideSpy = vi.spyOn(layer, 'hide');
        updateSpy.mockClear();
        hideSpy.mockClear();

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-1' });
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(ctx.container.querySelector('.mb-handles-box')).not.toBeNull();

        ctx.eventBus.emit(Events.Tool.SelectionClear, { tool: 'select', objects: ['obj-1'] });
        expect(hideSpy).toHaveBeenCalledTimes(1);
        expect(ctx.container.querySelector('.mb-handles-box')).toBeNull();
    });

    it('reacts to TransformUpdated only for selected objects', () => {
        ctx.setObject('obj-selected', { x: 20, y: 20, width: 100, height: 60, type: 'note' });
        ctx.setObject('obj-other', { x: 220, y: 160, width: 80, height: 50, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-selected');

        const updateSpy = vi.spyOn(layer, 'update');
        updateSpy.mockClear();

        ctx.eventBus.emit(Events.Object.TransformUpdated, { objectId: 'obj-other' });
        expect(updateSpy).not.toHaveBeenCalled();

        ctx.eventBus.emit(Events.Object.TransformUpdated, { objectId: 'obj-selected' });
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });
});
