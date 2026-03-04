import { describe, it, expect, vi } from 'vitest';
import { SelectTool } from '../../src/tools/object-tools/SelectTool.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Координатные тесты SelectTool.
 *
 * Фокус:
 * - корректность базового преобразования экран -> world в _toWorld;
 * - корректность стартового payload для group drag.
 */
describe('SelectTool coordinate behavior', () => {
    it('_toWorld converts input point through worldLayer.toLocal', () => {
        // Контракт:
        // SelectTool должен использовать worldLayer.toLocal как источник истины,
        // иначе при pan/zoom будут систематические сдвиги.
        const ctx = {
            app: {
                stage: {
                    getChildByName: () => ({
                        toLocal: (p) => ({ x: p.x / 2, y: p.y / 4 }),
                    }),
                },
            },
        };

        const result = SelectTool.prototype._toWorld.call(ctx, 200, 80);
        expect(result).toEqual({ x: 100, y: 20 });
    });

    it('startGroupDrag emits GroupDragStart and passes world mouse to controller', () => {
        // Контракт старта group drag:
        // - стартовые bounds группы фиксируются;
        // - контроллер получает курсор уже в world;
        // - в EventBus отправляется GroupDragStart с выбранными id.
        const emitted = [];
        const ctrlStart = vi.fn();

        const ctx = {
            groupStartBounds: null,
            isGroupDragging: false,
            isDragging: true,
            groupBoundsGraphics: null,
            resizeHandles: null,
            _groupDragCtrl: { start: ctrlStart },
            selection: { toArray: () => ['a', 'b'] },
            computeGroupBounds: () => ({ x: 10, y: 20, width: 100, height: 80 }),
            ensureGroupBoundsGraphics: vi.fn(),
            _toWorld: () => ({ x: 300, y: 400 }),
            emit: (event, payload) => emitted.push({ event, payload }),
        };

        SelectTool.prototype.startGroupDrag.call(ctx, { x: 999, y: 777 });

        expect(ctx.groupStartBounds).toEqual({ x: 10, y: 20, width: 100, height: 80 });
        expect(ctx.isGroupDragging).toBe(true);
        expect(ctx.isDragging).toBe(false);
        expect(ctrlStart).toHaveBeenCalledWith(
            { x: 10, y: 20, width: 100, height: 80 },
            { x: 300, y: 400 }
        );
        expect(emitted).toContainEqual({
            event: Events.Tool.GroupDragStart,
            payload: { objects: ['a', 'b'] },
        });
    });
});

