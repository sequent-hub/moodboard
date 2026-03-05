import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';
import { createHtmlHandlesContext } from './HtmlHandlesLayer.baseline.helpers.js';

function getEventCounts(onMock) {
    const map = new Map();
    for (const [eventName] of onMock.mock.calls) {
        map.set(eventName, (map.get(eventName) || 0) + 1);
    }
    return map;
}

describe('HtmlHandlesLayer baseline: lifecycle contracts', () => {
    let ctx;
    let layer;
    let addSpy;
    let removeSpy;

    beforeEach(() => {
        ctx = createHtmlHandlesContext();
        addSpy = vi.spyOn(window, 'addEventListener');
        removeSpy = vi.spyOn(window, 'removeEventListener');
        layer = new HtmlHandlesLayer(ctx.container, ctx.eventBus, ctx.core);
    });

    afterEach(() => {
        layer?.destroy();
        addSpy.mockRestore();
        removeSpy.mockRestore();
        ctx?.cleanup();
    });

    it('attach subscribes listeners once and creates one root layer', () => {
        layer.attach();

        expect(ctx.container.querySelectorAll('.moodboard-html-handles').length).toBe(1);
        const counts = getEventCounts(ctx.eventBus.on);
        expect(counts.get(Events.Tool.SelectionAdd)).toBe(1);
        expect(counts.get(Events.Tool.SelectionClear)).toBe(1);
        expect(counts.get(Events.Object.TransformUpdated)).toBe(1);

        const resizeAddCall = addSpy.mock.calls.find(([name]) => name === 'resize');
        expect(resizeAddCall).toBeTruthy();
        expect(typeof resizeAddCall[1]).toBe('function');
    });

    it('destroy removes DOM root and resize listener; repeated destroy is safe', () => {
        layer.attach();
        const resizeHandler = addSpy.mock.calls.find(([name]) => name === 'resize')[1];
        expect(ctx.container.querySelector('.moodboard-html-handles')).not.toBeNull();

        expect(() => layer.destroy()).not.toThrow();
        expect(ctx.container.querySelector('.moodboard-html-handles')).toBeNull();
        expect(removeSpy).toHaveBeenCalledWith('resize', resizeHandler);

        expect(() => layer.destroy()).not.toThrow();
    });

    it('attach/destroy cycle with recreated instance does not duplicate layer nodes', () => {
        layer.attach();
        layer.destroy();

        const second = new HtmlHandlesLayer(ctx.container, ctx.eventBus, ctx.core);
        second.attach();

        expect(ctx.container.querySelectorAll('.moodboard-html-handles').length).toBe(1);

        second.destroy();
    });
});
