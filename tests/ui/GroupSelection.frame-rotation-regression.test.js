/**
 * Регрессионные тесты: рамка группы НЕ должна перестраиваться и становиться
 * горизонтальной (rotate(0deg)) после остановки группового вращения.
 *
 * Баг: при групповом вращении после каждой остановки (mouse up / GroupRotateEnd)
 * рамка сбрасывала угол и выравнивалась по горизонтали.
 *
 * Эти тесты обязаны падать при возврате такого поведения.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

function parseRotationDeg(transformCss) {
    if (!transformCss || transformCss === 'none') return 0;
    const m = transformCss.match(/rotate\((-?\d+\.?\d*)deg\)/);
    return m ? parseFloat(m[1]) : 0;
}

describe('GroupSelection: frame must NOT become horizontal after group rotation', () => {
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

    it('frame stays rotated after first GroupRotateEnd (must NOT revert to rotate(0deg))', () => {
        ctx.setObject('obj-a', { x: 10, y: 10, width: 80, height: 50, type: 'note' });
        ctx.setObject('obj-b', { x: 120, y: 30, width: 90, height: 60, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        ctx.eventBus.emit(Events.Tool.GroupRotateStart, {
            objects: ['obj-a', 'obj-b'],
            center: { x: 110, y: 50 },
        });
        ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, {
            objects: ['obj-a', 'obj-b'],
            angle: 25,
        });
        ctx.eventBus.emit(Events.Tool.GroupRotateEnd, {
            objects: ['obj-a', 'obj-b'],
        });

        const box = ctx.container.querySelector('.mb-handles-box');
        expect(box).not.toBeNull();
        const rotation = parseRotationDeg(box.style.transform);
        expect(rotation).not.toBe(0);
        expect(Math.abs(rotation)).toBe(25);
    });

    it('frame stays rotated after EACH stop in repeated rotate gestures', () => {
        ctx.setObject('obj-a', { x: 10, y: 10, width: 80, height: 50, type: 'note' });
        ctx.setObject('obj-b', { x: 120, y: 30, width: 90, height: 60, type: 'note' });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');
        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        const angles = [15, 10, -5];
        for (let i = 0; i < angles.length; i++) {
            ctx.eventBus.emit(Events.Tool.GroupRotateStart, {
                objects: ['obj-a', 'obj-b'],
                center: { x: 110, y: 50 },
            });
            ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, {
                objects: ['obj-a', 'obj-b'],
                angle: angles[i],
            });
            ctx.eventBus.emit(Events.Tool.GroupRotateEnd, {
                objects: ['obj-a', 'obj-b'],
            });

            const box = ctx.container.querySelector('.mb-handles-box');
            expect(box).not.toBeNull();
            const rotation = parseRotationDeg(box.style.transform);
            const expectedTotal = angles.slice(0, i + 1).reduce((a, b) => a + b, 0);
            expect(rotation).not.toBe(0);
            expect(Math.abs(rotation - expectedTotal)).toBeLessThan(0.01);
        }
    });

    it('frame MUST NOT become rotate(0deg) after TransformUpdated following group rotation', () => {
        ctx.setObject('obj-a', { x: 10, y: 20, width: 100, height: 50, type: 'note', rotation: 0 });
        ctx.setObject('obj-b', { x: 180, y: 80, width: 90, height: 70, type: 'note', rotation: 0 });
        ctx.core.selectTool.selectedObjects.add('obj-a');
        ctx.core.selectTool.selectedObjects.add('obj-b');

        ctx.eventBus.emit(Events.Tool.SelectionAdd, { tool: 'select', object: 'obj-a' });

        ctx.eventBus.emit(Events.Tool.GroupRotateStart, { objects: ['obj-a', 'obj-b'], center: { x: 95, y: 65 } });
        ctx.eventBus.emit(Events.Tool.GroupRotateUpdate, { objects: ['obj-a', 'obj-b'], angle: 30 });
        ctx.eventBus.emit(Events.Tool.GroupRotateEnd, { objects: ['obj-a', 'obj-b'] });

        const rotationBefore = parseRotationDeg(ctx.container.querySelector('.mb-handles-box').style.transform);
        expect(rotationBefore).not.toBe(0);

        ctx.eventBus.emit(Events.Object.TransformUpdated, { objectId: 'obj-a' });
        ctx.eventBus.emit(Events.Object.TransformUpdated, { objectId: 'obj-b' });

        const boxAfter = ctx.container.querySelector('.mb-handles-box');
        const rotationAfter = parseRotationDeg(boxAfter.style.transform);
        expect(rotationAfter).not.toBe(0);
        expect(Math.abs(rotationAfter - rotationBefore)).toBeLessThan(0.01);
    });
});
