/**
 * Unit-тесты BoxSelectController.
 * Страховка: start/update/end, isMultiSelect, исключение frame.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pixi.js', () => {
    const g = () => ({
        clear: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        drawRect: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        parent: { removeChild: vi.fn() },
    });
    return { Graphics: vi.fn().mockImplementation(g) };
});

import { BoxSelectController } from '../../../src/tools/object-tools/selection/BoxSelectController.js';

function rectIntersectsRect(a, b) {
    return !(
        b.x > a.x + a.width ||
        b.x + b.width < a.x ||
        b.y > a.y + a.height ||
        b.y + b.height < a.y
    );
}

describe('BoxSelectController baseline', () => {
    let app;
    let selection;
    let emit;
    let setSelection;
    let clearSelection;

    beforeEach(() => {
        selection = {
            toArray: vi.fn(() => []),
            has: vi.fn(() => false),
        };
        emit = vi.fn((event, payload) => {
            if (event === 'tool:get:all:objects' || event === 'get:all:objects') {
                payload.objects = payload.objects || [];
            }
        });
        setSelection = vi.fn();
        clearSelection = vi.fn();
        app = {
            stage: {
                sortableChildren: false,
                addChild: vi.fn(),
                getChildByName: vi.fn(),
            },
        };
    });

    function createController() {
        const ctrl = new BoxSelectController({
            app,
            selection,
            emit: (e, p) => emit(e, p),
            setSelection,
            clearSelection,
            rectIntersectsRect,
        });
        return ctrl;
    }

    it('start without isMultiSelect clears selection', () => {
        selection.toArray.mockReturnValue(['a']);
        const ctrl = createController();

        ctrl.start({ x: 10, y: 20 }, false);

        expect(clearSelection).toHaveBeenCalled();
        expect(ctrl.isMultiSelect).toBe(false);
    });

    it('start with isMultiSelect keeps initial selection', () => {
        selection.toArray.mockReturnValue(['a', 'b']);
        const ctrl = createController();

        ctrl.start({ x: 10, y: 20 }, true);

        expect(clearSelection).not.toHaveBeenCalled();
        expect(ctrl.isMultiSelect).toBe(true);
        expect(ctrl.initialSelectionBeforeBox).toEqual(['a', 'b']);
    });

    it('update with matching objects excludes frame type', () => {
        selection.toArray.mockReturnValue([]);
        emit.mockImplementation((event, req) => {
            if (event === 'get:all:objects' || event === 'tool:get:all:objects') {
                req.objects = [
                    { id: 'note-1', bounds: { x: 50, y: 50, width: 100, height: 80 }, pixi: { _mb: { type: 'note' } } },
                    { id: 'frame-1', bounds: { x: 150, y: 50, width: 100, height: 80 }, pixi: { _mb: { type: 'frame' } } },
                    { id: 'shape-1', bounds: { x: 250, y: 50, width: 60, height: 60 }, pixi: { _mb: { type: 'shape' } } },
                ];
            }
        });

        const ctrl = createController();
        ctrl.start({ x: 0, y: 0 }, false);
        ctrl.update({ x: 350, y: 200 });

        expect(setSelection).toHaveBeenCalledWith(
            expect.arrayContaining(['note-1', 'shape-1'])
        );
        expect(setSelection.mock.calls[0][0]).not.toContain('frame-1');
    });

    it('end cleans up selectionGraphics', () => {
        selection.toArray.mockReturnValue([]);
        const graphics = { clear: vi.fn(), destroy: vi.fn(), parent: { removeChild: vi.fn() } };
        const ctrl = createController();
        ctrl.selectionBox = { startX: 0, startY: 0, endX: 100, endY: 100 };
        ctrl.selectionGraphics = graphics;

        emit.mockImplementation((event, req) => {
            if (event === 'get:all:objects' || event === 'tool:get:all:objects') {
                req.objects = [{ id: 'a', bounds: { x: 10, y: 10, width: 20, height: 20 }, pixi: { _mb: { type: 'note' } } }];
            }
        });

        ctrl.end();

        expect(graphics.parent.removeChild).toHaveBeenCalledWith(graphics);
        expect(graphics.destroy).toHaveBeenCalled();
        expect(ctrl.selectionGraphics).toBeNull();
    });
});
