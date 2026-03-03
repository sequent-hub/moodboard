import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

vi.mock('pixi.js', () => ({
    Graphics: vi.fn().mockImplementation(() => ({
        clear: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawCircle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        parent: { removeChild: vi.fn() },
        destroy: vi.fn(),
    })),
    Point: vi.fn().mockImplementation((x, y) => ({ x, y })),
    BLEND_MODES: { LIGHTEN: 'lighten', NORMAL: 'normal' },
}));

import { DrawingTool } from '../../src/tools/object-tools/DrawingTool.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((eventName, handler) => {
            if (!handlers.has(eventName)) handlers.set(eventName, []);
            handlers.get(eventName).push(handler);
        }),
        emit: vi.fn((eventName, payload) => {
            const list = handlers.get(eventName) || [];
            list.forEach((h) => h(payload));
        }),
    };
}

describe('DrawingTool eraser', () => {
    let eventBus;
    let tool;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createEventBus();
        tool = new DrawingTool(eventBus);
        tool.brush = { color: 0x111827, width: 2, mode: 'eraser' };
    });

    it('удаляет drawing при пересечении в одной системе координат', () => {
        const drawingPixi = {
            _mb: {
                type: 'drawing',
                properties: {
                    points: [{ x: 0, y: 10 }, { x: 100, y: 10 }],
                    strokeWidth: 2,
                    baseWidth: 100,
                    baseHeight: 20,
                },
            },
            toLocal: vi.fn((p) => ({ x: p.x, y: p.y })),
        };
        const allObjects = [{
            id: 'draw-1',
            pixi: drawingPixi,
            bounds: { x: 0, y: 0, width: 100, height: 20 },
        }];

        eventBus.on(Events.Tool.GetAllObjects, (req) => {
            req.objects = allObjects;
        });

        tool._eraserSweep({ x: 10, y: 10 }, { x: 20, y: 10 });

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.ToolbarAction, { type: 'delete-object', id: 'draw-1' });
    });

    it('удаляет drawing при zoom/pan (bounds в global, сегмент ластика в world)', () => {
        const drawingPixi = {
            _mb: {
                type: 'drawing',
                properties: {
                    points: [{ x: 0, y: 10 }, { x: 100, y: 10 }],
                    strokeWidth: 2,
                    baseWidth: 100,
                    baseHeight: 20,
                },
            },
            toLocal: vi.fn((p) => ({ x: p.x - 120, y: p.y - 100 })),
        };
        const allObjects = [{
            id: 'draw-2',
            pixi: drawingPixi,
            bounds: { x: 120, y: 100, width: 200, height: 40 },
        }];

        eventBus.on(Events.Tool.GetAllObjects, (req) => {
            req.objects = allObjects;
        });

        // world -> global: x*2 + 120, y*2 + 80
        tool.world = {
            toGlobal: vi.fn((p) => ({ x: p.x * 2 + 120, y: p.y * 2 + 80 })),
        };

        // Сегмент ластика пересекает линию в world-координатах
        tool._eraserSweep({ x: 10, y: 20 }, { x: 20, y: 20 });

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.ToolbarAction, { type: 'delete-object', id: 'draw-2' });
    });
});
