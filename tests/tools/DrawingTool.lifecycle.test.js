/**
 * Baseline-тесты жизненного цикла DrawingTool: destroy, отписка от EventBus,
 * очистка tempGraphics и _eraserIdleTimer.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { EventBus } from '../../src/core/EventBus.js';

vi.mock('pixi.js', () => ({
    Graphics: vi.fn().mockImplementation(() => ({
        clear: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawCircle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        quadraticCurveTo: vi.fn().mockReturnThis(),
        blendMode: 'normal',
        parent: null,
        destroy: vi.fn(),
    })),
    Point: vi.fn().mockImplementation((x, y) => ({ x, y })),
    BLEND_MODES: { LIGHTEN: 'lighten', NORMAL: 'normal' },
}));

import { DrawingTool } from '../../src/tools/object-tools/DrawingTool.js';

describe('DrawingTool lifecycle', () => {
    let eventBus;
    let tool;

    beforeEach(() => {
        eventBus = new EventBus();
        tool = new DrawingTool(eventBus);
    });

    afterEach(() => {
        if (tool && !tool.destroyed) {
            tool.destroy();
        }
    });

    it('BrushSet обновляет brush до destroy', () => {
        eventBus.emit(Events.Draw.BrushSet, { mode: 'marker', color: 0x22c55e });
        expect(tool.brush.mode).toBe('marker');
        expect(tool.brush.color).toBe(0x22c55e);
    });

    it('после destroy BrushSet больше не обновляет brush', () => {
        eventBus.emit(Events.Draw.BrushSet, { mode: 'pencil', color: 0x111827 });
        const beforeDestroy = { ...tool.brush };

        tool.destroy();

        eventBus.emit(Events.Draw.BrushSet, { mode: 'marker', color: 0xff0000 });
        expect(tool.brush.mode).toBe(beforeDestroy.mode);
        expect(tool.brush.color).toBe(beforeDestroy.color);
    });

    it('destroy очищает tempGraphics если он был создан', () => {
        const mockWorld = { addChild: vi.fn() };
        tool.world = mockWorld;
        tool.isDrawing = true;
        tool.points = [{ x: 10, y: 10 }];
        const mockGraphics = {
            parent: { removeChild: vi.fn() },
            destroy: vi.fn(),
        };
        tool.tempGraphics = mockGraphics;

        tool.destroy();

        expect(tool.tempGraphics).toBeNull();
        expect(mockGraphics.destroy).toHaveBeenCalled();
    });

    it('destroy очищает _eraserIdleTimer', () => {
        tool._eraserIdleTimer = setTimeout(() => {}, 99999);

        tool.destroy();

        expect(tool._eraserIdleTimer).toBeNull();
    });

    it('повторный destroy не падает', () => {
        tool.destroy();
        expect(() => tool.destroy()).not.toThrow();
    });

    it('не подписывается на HitTest (пустой handler удалён)', () => {
        expect(eventBus.events.has(Events.Tool.HitTest)).toBe(false);
    });
});
