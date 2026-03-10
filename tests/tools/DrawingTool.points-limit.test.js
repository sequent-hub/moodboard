/**
 * Тесты лимита точек при рисовании: decimation при большом количестве точек.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

const MAX_POINTS = 5000;

describe('DrawingTool points limit', () => {
    let eventBus;
    let tool;
    let capturedAction;

    beforeEach(() => {
        eventBus = new EventBus();
        capturedAction = null;
        eventBus.on(Events.UI.ToolbarAction, (payload) => {
            if (payload?.type === 'drawing') capturedAction = payload;
        });
        tool = new DrawingTool(eventBus);
        tool.world = { addChild: vi.fn(), toLocal: (p) => ({ x: p.x, y: p.y }) };
        tool.tempGraphics = {
            parent: { removeChild: vi.fn() },
            destroy: vi.fn(),
        };
    });

    it('штрих с малым числом точек создаёт drawing без изменений', () => {
        tool.isDrawing = true;
        tool.brush = { color: 0x111827, width: 2, mode: 'pencil' };
        tool.points = [
            { x: 10, y: 20 },
            { x: 50, y: 25 },
            { x: 100, y: 30 },
        ];

        tool._finishAndCommit();

        expect(capturedAction).toBeTruthy();
        expect(capturedAction.properties.points).toHaveLength(3);
    });

    it('штрих с >5000 точек децимируется до MAX_POINTS', () => {
        tool.isDrawing = true;
        tool.brush = { color: 0x111827, width: 2, mode: 'pencil' };
        tool.points = [];
        for (let i = 0; i < 10000; i++) {
            tool.points.push({ x: i, y: 50 });
        }

        tool._finishAndCommit();

        expect(capturedAction).toBeTruthy();
        expect(capturedAction.properties.points.length).toBeLessThanOrEqual(MAX_POINTS);
        expect(capturedAction.properties.points.length).toBeGreaterThan(2);
        expect(capturedAction.properties.points[0]).toEqual({ x: 0, y: 0 });
        const last = capturedAction.properties.points[capturedAction.properties.points.length - 1];
        expect(last.x).toBe(9999);
        expect(last.y).toBe(0);
    });
});
