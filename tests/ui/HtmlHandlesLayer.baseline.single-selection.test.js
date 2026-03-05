import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

describe('HtmlHandlesLayer baseline: single selection contracts', () => {
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

    it('renders handles for selected single object', () => {
        ctx.setObject('obj-1', { x: 100, y: 120, width: 180, height: 90, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-1');

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-1' });

        const box = ctx.container.querySelector('.mb-handles-box');
        expect(box).not.toBeNull();
        expect(box.querySelectorAll('[data-dir]').length).toBe(4);
        expect(box.querySelectorAll('[data-edge]').length).toBe(4);
        expect(box.querySelector('[data-handle="rotate"]')).not.toBeNull();
        expect(layer.target).toEqual({
            type: 'single',
            id: 'obj-1',
            bounds: { x: 100, y: 120, width: 180, height: 90 },
        });
    });

    it('hides handles on SelectionClear', () => {
        ctx.setObject('obj-1', { x: 50, y: 60, width: 120, height: 70, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-1');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-1' });
        expect(ctx.container.querySelector('.mb-handles-box')).not.toBeNull();

        ctx.eventBus.emit(Events.Tool.SelectionClear, { tool: 'select', objects: ['obj-1'] });

        expect(ctx.container.querySelector('.mb-handles-box')).toBeNull();
        expect(layer.visible).toBe(false);
    });
});
