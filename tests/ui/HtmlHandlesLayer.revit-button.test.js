import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

describe('HtmlHandlesLayer Revit button', () => {
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

    it('shows button only for revit-screenshot-img with view payload', () => {
        ctx.setObject('obj-1', {
            x: 100,
            y: 120,
            width: 180,
            height: 90,
            type: 'revit-screenshot-img',
            properties: { view: '{"guid":"A"}' }
        });
        ctx.core.selectTool.selectedObjects.add('obj-1');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-1' });

        const button = ctx.container.querySelector('.mb-revit-show-in-model');
        expect(button).not.toBeNull();
        const icon = button.querySelector('svg');
        expect(icon).not.toBeNull();
        expect(button.textContent).toContain('Показать в модели');
    });

    it('emits ui:revit:show-in-model when button clicked', () => {
        ctx.setObject('obj-1', {
            x: 50,
            y: 60,
            width: 120,
            height: 70,
            type: 'revit-screenshot-img',
            properties: { view: '{"view":"42"}' }
        });
        ctx.core.selectTool.selectedObjects.add('obj-1');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-1' });

        const button = ctx.container.querySelector('.mb-revit-show-in-model');
        expect(button).not.toBeNull();
        button.click();

        const call = ctx.eventBus.emit.mock.calls.find(([eventName]) => eventName === Events.UI.RevitShowInModel);
        expect(call).toBeTruthy();
        expect(call[1]).toEqual({
            objectId: 'obj-1',
            view: '{"view":"42"}'
        });
    });

    it('does not show button for regular image type', () => {
        ctx.setObject('obj-2', {
            x: 40,
            y: 40,
            width: 120,
            height: 80,
            type: 'image',
            properties: {}
        });
        ctx.core.selectTool.selectedObjects.add('obj-2');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-2' });

        const button = ctx.container.querySelector('.mb-revit-show-in-model');
        expect(button).toBeNull();
    });
});

