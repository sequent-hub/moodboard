import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

describe('HtmlHandlesLayer baseline: transform sync contracts', () => {
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

    it('repositions single-selection box on pan and zoom updates', () => {
        ctx.setObject('obj-1', { x: 100, y: 120, width: 140, height: 80, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-1');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-1' });

        const before = ctx.container.querySelector('.mb-handles-box');
        const baseLeft = parseFloat(before.style.left);
        const baseTop = parseFloat(before.style.top);
        const baseWidth = parseFloat(before.style.width);

        ctx.world.x = 40;
        ctx.world.y = 20;
        ctx.eventBus.emit(Events.Tool.PanUpdate, {});
        const afterPan = ctx.container.querySelector('.mb-handles-box');
        expect(parseFloat(afterPan.style.left)).toBe(baseLeft + 40);
        expect(parseFloat(afterPan.style.top)).toBe(baseTop + 20);

        ctx.world.scale.x = 2;
        ctx.world.scale.y = 2;
        ctx.eventBus.emit(Events.UI.ZoomPercent, { value: 200 });
        const afterZoom = ctx.container.querySelector('.mb-handles-box');
        expect(parseFloat(afterZoom.style.width)).toBe(baseWidth * 2);
    });

    it('recalculates box geometry on single-object transform events', () => {
        ctx.setObject('obj-1', { x: 30, y: 40, width: 100, height: 60, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-1');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-1' });

        let box = ctx.container.querySelector('.mb-handles-box');
        let prev = `${box.style.left}|${box.style.top}|${box.style.width}|${box.style.height}`;

        const checks = [
            Events.Tool.DragUpdate,
            Events.Tool.ResizeUpdate,
            Events.Tool.RotateUpdate,
        ];

        for (const eventName of checks) {
            const current = ctx.getObject('obj-1');
            ctx.setObject('obj-1', {
                x: current.x + 5,
                y: current.y + 3,
                width: current.width + 7,
                height: current.height + 4,
                type: 'note',
            });
            ctx.eventBus.emit(eventName, { object: 'obj-1' });
            box = ctx.container.querySelector('.mb-handles-box');
            const next = `${box.style.left}|${box.style.top}|${box.style.width}|${box.style.height}`;
            expect(next).not.toBe(prev);
            prev = next;
        }
    });

    it('recalculates group geometry on group transform events', () => {
        ctx.setObject('obj-a', { x: 10, y: 10, width: 80, height: 50, type: 'note' });
        ctx.setObject('obj-b', { x: 120, y: 30, width: 90, height: 60, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        const start = ctx.container.querySelector('.mb-handles-box');
        const startWidth = parseFloat(start.style.width);

        ctx.setObject('obj-b', { x: 220, y: 30, width: 110, height: 90, type: 'note' });
        ctx.eventBus.emit(Events.Tool.GroupResizeUpdate, { objects: ['obj-a', 'obj-b'] });
        const afterResize = ctx.container.querySelector('.mb-handles-box');
        expect(parseFloat(afterResize.style.width)).toBeGreaterThan(startWidth);

        ctx.setObject('obj-a', { x: -20, y: -15, width: 80, height: 50, type: 'note' });
        ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, { objects: ['obj-a', 'obj-b'], angle: 20 });
        const afterRotate = ctx.container.querySelector('.mb-handles-box');
        expect(parseFloat(afterRotate.style.left)).toBeLessThan(parseFloat(afterResize.style.left));
    });
});
