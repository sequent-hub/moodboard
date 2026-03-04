import { describe, it, expect, vi } from 'vitest';
import { ToolManager } from '../../src/tools/ToolManager.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Диагностические тесты координатного контракта ToolManager.
 *
 * Здесь проверяем:
 * - преобразование clientX/clientY в координаты контейнера;
 * - проброс координат в активный инструмент;
 * - эмит координатных событий (CursorMove, WheelZoom).
 */
describe('ToolManager coordinate event routing', () => {
    function createManagerLikeContext() {
        const emitted = [];
        const activeTool = {
            onMouseDown: vi.fn(),
            onMouseMove: vi.fn(),
            onMouseUp: vi.fn(),
        };
        const ctx = {
            activeTool,
            eventBus: { emit: vi.fn((event, payload) => emitted.push({ event, payload })) },
            container: {
                getBoundingClientRect: () => ({ left: 10, top: 20, width: 500, height: 400 }),
            },
            handleAuxPanStart: vi.fn(),
            handleAuxPanEnd: vi.fn(),
            syncActiveToolCursor: vi.fn(),
            temporaryTool: null,
            spacePressed: false,
            isMouseDown: false,
            lastMousePos: null,
            hasActiveTool: vi.fn(() => false),
            emitLog: emitted,
        };
        return ctx;
    }

    it('handleMouseDown converts client coords to container-local coords', () => {
        const ctx = createManagerLikeContext();
        ToolManager.prototype.handleMouseDown.call(ctx, {
            clientX: 110,
            clientY: 220,
            button: 0,
            target: {},
        });

        expect(ctx.activeTool.onMouseDown).toHaveBeenCalledWith(
            expect.objectContaining({ x: 100, y: 200, button: 0 })
        );
        const cursorEvt = ctx.emitLog.find((e) => e.event === Events.UI.CursorMove);
        expect(cursorEvt).toBeTruthy();
        expect(cursorEvt.payload).toEqual({ x: 100, y: 200 });
    });

    it('handleMouseMove emits CursorMove and forwards local coords to active tool', () => {
        const ctx = createManagerLikeContext();
        ToolManager.prototype.handleMouseMove.call(ctx, {
            clientX: 210,
            clientY: 120,
            target: {},
        });

        expect(ctx.activeTool.onMouseMove).toHaveBeenCalledWith(
            expect.objectContaining({ x: 200, y: 100 })
        );
        const cursorEvt = ctx.emitLog.find((e) => e.event === Events.UI.CursorMove);
        expect(cursorEvt.payload).toEqual({ x: 200, y: 100 });
    });

    it('handleMouseWheel emits WheelZoom with local coords and prevents default', () => {
        const ctx = createManagerLikeContext();
        const preventDefault = vi.fn();

        ToolManager.prototype.handleMouseWheel.call(ctx, {
            clientX: 60,
            clientY: 90,
            deltaY: -120,
            ctrlKey: false,
            shiftKey: false,
            preventDefault,
        });

        const zoomEvt = ctx.emitLog.find((e) => e.event === Events.Tool.WheelZoom);
        expect(zoomEvt).toBeTruthy();
        expect(zoomEvt.payload).toEqual({ x: 50, y: 70, delta: -120 });
        expect(preventDefault).toHaveBeenCalled();
    });
});

