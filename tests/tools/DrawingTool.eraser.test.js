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
        // Zoom x2, pan +120/+100.
        // Локальная линия: y=10, x от 0 до 100 (в локальных координатах объекта).
        // toLocal: globalX-120, globalY-100.
        // Чтобы ластик в world прошёл по y=10 локально: нужно globalY=110 → worldY=(110-80)/2=15.
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
            // Локальные bounds (независимы от zoom)
            getLocalBounds: vi.fn(() => ({ width: 100, height: 20 })),
        };
        const allObjects = [{
            id: 'draw-2',
            pixi: drawingPixi,
            // Глобальные bounds раздуты zoom x2 — используются только для bbox-отсева
            bounds: { x: 120, y: 100, width: 200, height: 40 },
        }];

        eventBus.on(Events.Tool.GetAllObjects, (req) => {
            req.objects = allObjects;
        });

        // world → global: x*2 + 120, y*2 + 80
        tool.world = {
            toGlobal: vi.fn((p) => ({ x: p.x * 2 + 120, y: p.y * 2 + 80 })),
        };

        // Ластик в world y=15: prevGlobal=(140,110), currGlobal=(160,110)
        // localPrev=(20,10), localCurr=(40,10) — ровно на линии y=10 → dist=0
        tool._eraserSweep({ x: 10, y: 15 }, { x: 20, y: 15 });

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.ToolbarAction, { type: 'delete-object', id: 'draw-2' });
    });

    // Регрессия: быстрый поперечный мах — оба конца отрезка ластика далеко от линии,
    // но сам отрезок её пересекает. Старая логика (точка→отрезок) не ловила такое.
    it('удаляет drawing при быстром поперечном движении (оба конца ластика далеко от линии)', () => {
        // Горизонтальная линия y=50, от x=0 до x=100
        const drawingPixi = {
            _mb: {
                type: 'drawing',
                properties: {
                    points: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
                    strokeWidth: 2,
                    baseWidth: 100,
                    baseHeight: 100,
                },
            },
            // toLocal — единичное преобразование (нет pan/zoom)
            toLocal: vi.fn((p) => ({ x: p.x, y: p.y })),
            getLocalBounds: vi.fn(() => ({ width: 100, height: 100 })),
        };
        const allObjects = [{
            id: 'draw-fast',
            pixi: drawingPixi,
            bounds: { x: 0, y: 0, width: 100, height: 100 },
        }];

        eventBus.on(Events.Tool.GetAllObjects, (req) => {
            req.objects = allObjects;
        });

        // Сегмент ластика идёт вертикально x=50, y от 0 до 100 — оба конца на расстоянии 50 от линии,
        // но отрезок пересекает её в точке (50, 50). Старая логика давала min(50,50)>threshold → не стирала.
        tool._eraserSweep({ x: 50, y: 0 }, { x: 50, y: 100 });

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.ToolbarAction, { type: 'delete-object', id: 'draw-fast' });
    });

    // Регрессия: масштаб при zoom — getLocalBounds вместо глобальных bounds
    it('использует getLocalBounds для вычисления scaleX/scaleY (корректен при любом zoom)', () => {
        // Линия y=10 в локальных координатах, baseWidth/baseHeight = реальный локальный размер
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
            // toLocal возвращает локальные (масштаб 1:1)
            toLocal: vi.fn((p) => ({ x: p.x, y: p.y })),
            // Локальные границы совпадают с base (zoom не влияет)
            getLocalBounds: vi.fn(() => ({ width: 100, height: 20 })),
        };
        const allObjects = [{
            id: 'draw-zoom',
            pixi: drawingPixi,
            // Глобальные bounds раздуты зумом x2 — без фикса давали scaleX=2, scaleY=2
            // и точки линии уезжали в y=20, тогда как курсор был на y=10 → промах
            bounds: { x: 0, y: 0, width: 200, height: 40 },
        }];

        eventBus.on(Events.Tool.GetAllObjects, (req) => {
            req.objects = allObjects;
        });

        // Ластик проходит ровно по линии y=10
        tool._eraserSweep({ x: 20, y: 10 }, { x: 30, y: 10 });

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.ToolbarAction, { type: 'delete-object', id: 'draw-zoom' });
    });
});
