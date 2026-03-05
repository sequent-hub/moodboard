import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

describe('HtmlHandlesLayer baseline: group selection contracts', () => {
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

    it('renders group box and handles for multi-selection', () => {
        ctx.setObject('obj-a', { x: 10, y: 20, width: 100, height: 50, type: 'note' });
        ctx.setObject('obj-b', { x: 180, y: 80, width: 90, height: 70, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        const box = ctx.container.querySelector('.mb-handles-box');
        expect(box).not.toBeNull();
        expect(box.querySelectorAll('[data-dir]').length).toBe(4);
        expect(box.querySelector('[data-handle="rotate"]')).not.toBeNull();
        expect(layer.target.type).toBe('group');
        expect(layer.target.id).toBe('__group__');
    });

    it('updates group bounds after GroupDragUpdate when member bounds changed', () => {
        ctx.setObject('obj-a', { x: 10, y: 20, width: 100, height: 50, type: 'note' });
        ctx.setObject('obj-b', { x: 180, y: 80, width: 90, height: 70, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        const initialBox = ctx.container.querySelector('.mb-handles-box');
        const initialWidth = parseFloat(initialBox.style.width);
        const initialHeight = parseFloat(initialBox.style.height);

        ctx.setObject('obj-b', { x: 260, y: 140, width: 120, height: 110, type: 'note' });
        ctx.eventBus.emit(Events.Tool.GroupDragUpdate, { objects: ['obj-a', 'obj-b'] });

        const updatedBox = ctx.container.querySelector('.mb-handles-box');
        const updatedWidth = parseFloat(updatedBox.style.width);
        const updatedHeight = parseFloat(updatedBox.style.height);

        expect(updatedWidth).toBeGreaterThan(initialWidth);
        expect(updatedHeight).toBeGreaterThan(initialHeight);
    });
});
