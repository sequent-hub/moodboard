import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

/**
 * Тесты синхронизации рамки выделения.
 * - Рамка НЕ должна меняться при вращении (сохраняется от выделения до снятия).
 * - Рамка должна откатываться с объектами при Undo/Redo.
 */
describe('HtmlHandlesLayer: frame sync', () => {
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

    it('does NOT recalc frame on TransformUpdated after group rotation (frame stays)', () => {
        ctx.setObject('obj-a', { x: 10, y: 20, width: 100, height: 50, type: 'note', rotation: 0 });
        ctx.setObject('obj-b', { x: 180, y: 80, width: 90, height: 70, type: 'note', rotation: 0 });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        ctx.eventBus.emit(Events.Tool.GroupRotateStart, { objects: ['obj-a', 'obj-b'], center: { x: 95, y: 65 } });
        ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, { objects: ['obj-a', 'obj-b'], angle: 30 });
        ctx.eventBus.emit(Events.Tool.GroupRotateEnd, { objects: ['obj-a', 'obj-b'] });

        const boxAfterRotate = ctx.container.querySelector('.mb-handles-box');
        expect(boxAfterRotate).not.toBeNull();
        const leftAfter = parseFloat(boxAfterRotate.style.left);
        const topAfter = parseFloat(boxAfterRotate.style.top);

        ctx.eventBus.emit(Events.Object.TransformUpdated, { objectId: 'obj-a' });
        ctx.eventBus.emit(Events.Object.TransformUpdated, { objectId: 'obj-b' });

        const boxAfterTransform = ctx.container.querySelector('.mb-handles-box');
        expect(parseFloat(boxAfterTransform.style.left)).toBe(leftAfter);
        expect(parseFloat(boxAfterTransform.style.top)).toBe(topAfter);
    });

    it('recalcs frame on History.Changed with lastUndone (Undo scenario)', () => {
        ctx.setObject('obj-a', { x: 10, y: 20, width: 100, height: 50, type: 'note', rotation: 0 });
        ctx.setObject('obj-b', { x: 180, y: 80, width: 90, height: 70, type: 'note', rotation: 0 });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        ctx.eventBus.emit(Events.Tool.GroupRotateStart, { objects: ['obj-a', 'obj-b'], center: { x: 95, y: 65 } });
        ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, { objects: ['obj-a', 'obj-b'], angle: 30 });
        ctx.eventBus.emit(Events.Tool.GroupRotateEnd, { objects: ['obj-a', 'obj-b'] });

        ctx.setObject('obj-a', { x: 10, y: 20, rotation: 0 });
        ctx.setObject('obj-b', { x: 180, y: 80, rotation: 0 });

        ctx.eventBus.emit(Events.History.Changed, { lastUndone: 'group-rotate' });

        const box = ctx.container.querySelector('.mb-handles-box');
        expect(box).not.toBeNull();
        const left = parseFloat(box.style.left);
        const top = parseFloat(box.style.top);
        const width = parseFloat(box.style.width);
        const height = parseFloat(box.style.height);

        expect(left).toBeCloseTo(10, 0);
        expect(top).toBeCloseTo(20, 0);
        expect(width).toBeCloseTo(260, 0);
        expect(height).toBeCloseTo(130, 0);
    });

    it('calls _endGroupRotationPreview on History.Changed with lastUndone', () => {
        ctx.setObject('obj-a', { x: 20, y: 40, width: 80, height: 60, type: 'note' });
        ctx.setObject('obj-b', { x: 150, y: 100, width: 70, height: 50, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });
        ctx.eventBus.emit(Events.Tool.GroupRotateStart, { objects: ['obj-a', 'obj-b'] });
        ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, { objects: ['obj-a', 'obj-b'], angle: 15 });
        ctx.eventBus.emit(Events.Tool.GroupRotateEnd, { objects: ['obj-a', 'obj-b'] });

        expect(layer._groupRotationPreview).not.toBeNull();

        const endSpy = vi.spyOn(layer, '_endGroupRotationPreview');
        ctx.eventBus.emit(Events.History.Changed, { lastUndone: 'group-rotate' });

        expect(endSpy).toHaveBeenCalledTimes(1);
        expect(layer._groupRotationPreview).toBeNull();
    });
});
