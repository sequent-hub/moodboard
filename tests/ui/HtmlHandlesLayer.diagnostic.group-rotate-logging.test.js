import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

describe('HtmlHandlesLayer diagnostics: group rotate logging', () => {
    let ctx;
    let layer;
    let infoSpy;

    beforeEach(() => {
        ctx = createHtmlHandlesContext();
        layer = new HtmlHandlesLayer(ctx.container, ctx.eventBus, ctx.core);
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        layer.attach();
    });

    afterEach(() => {
        infoSpy?.mockRestore();
        layer?.destroy();
        ctx?.cleanup();
    });

    it('logs rendered group box metrics during group rotate updates', () => {
        ctx.setObject('obj-a', { x: 10, y: 10, width: 80, height: 50, rotation: 0, type: 'note' });
        ctx.setObject('obj-b', { x: 120, y: 30, width: 90, height: 60, rotation: 35, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });
        infoSpy.mockClear();
        ctx.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 105, y: 45 },
        });

        ctx.setObject('obj-a', { x: -20, y: -15, width: 80, height: 50, rotation: 20, type: 'note' });
        ctx.setObject('obj-b', { x: 140, y: 25, width: 90, height: 60, rotation: 55, type: 'note' });
        ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: 20,
        });

        expect(infoSpy).toHaveBeenCalledWith(
            'HtmlHandlesLayer group box diagnostics:',
            expect.objectContaining({
                targetId: '__group__',
                rotation: 20,
                worldBounds: expect.objectContaining({
                    x: 5,
                    y: 5,
                    width: 200,
                    height: 80,
                }),
                cssRect: expect.objectContaining({
                    left: 5,
                    top: 5,
                    width: 200,
                    height: 80,
                }),
            })
        );
    });
});
