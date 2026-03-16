import { describe, expect, it, vi } from 'vitest';
import { snapScreenValue } from '../../src/grid/ScreenGridPhaseMachine.js';
import { resolveLineGridState } from '../../src/grid/LineGridZoomPhases.js';
import { MIRO_ZOOM_LEVELS } from '../../src/services/MiroZoomLevels.js';

class GraphicsMock {
    clear() {}
    lineStyle() {}
    moveTo() {}
    lineTo() {}
    destroy() {}
}

vi.mock('pixi.js', () => ({
    Graphics: GraphicsMock,
}));

function buildTransitions(levels) {
    const transitions = [];
    for (let i = 0; i < levels.length - 1; i += 1) {
        transitions.push([levels[i], levels[i + 1]]);
        transitions.push([levels[i + 1], levels[i]]);
    }
    return transitions;
}

function applyCursorCentricZoom(world, cursor, targetPercent) {
    const oldScale = world.scale;
    const newScale = targetPercent / 100;
    const worldPointX = (cursor.x - world.x) / oldScale;
    const worldPointY = (cursor.y - world.y) / oldScale;
    return {
        x: Math.round(cursor.x - worldPointX * newScale),
        y: Math.round(cursor.y - worldPointY * newScale),
        scale: newScale,
    };
}

describe('LineGrid cursor-centric invariant', () => {
    it('keeps major line under cursor stable during zoom transitions', async () => {
        const { LineGrid } = await import('../../src/grid/LineGrid.js');
        const transitions = buildTransitions(MIRO_ZOOM_LEVELS);
        const baseCursors = [
            { x: 140, y: 95 },
            { x: 401, y: 250 },
            { x: 802, y: 601 },
        ];

        for (const cursor of baseCursors) {
            for (const [fromPercent, toPercent] of transitions) {
                const grid = new LineGrid({
                    enabled: true,
                    lineWidth: 1,
                    showSubGrid: true,
                    subGridDivisions: 5,
                    subGridColor: 0xdddddd,
                    subGridOpacity: 0.8,
                    color: 0xcccccc,
                    opacity: 0.3,
                });

                const worldBefore = { x: 133, y: -77, scale: fromPercent / 100 };
                const fromState = resolveLineGridState(worldBefore.scale, { subGridDivisions: 5 });
                const fromStep = Math.max(1, Math.round(fromState.majorScreenStep));
                const beforeAnchorX = grid._resolveScreenAnchor('x', worldBefore.x, fromStep, null, false, 'major');
                const beforeAnchorY = grid._resolveScreenAnchor('y', worldBefore.y, fromStep, null, false, 'major');
                const beforePoint = {
                    x: snapScreenValue(cursor.x, beforeAnchorX, fromStep),
                    y: snapScreenValue(cursor.y, beforeAnchorY, fromStep),
                };

                const lockedCursor = { x: beforePoint.x, y: beforePoint.y };
                const worldAfter = applyCursorCentricZoom(worldBefore, lockedCursor, toPercent);
                const toState = resolveLineGridState(worldAfter.scale, { subGridDivisions: 5 });
                const toStep = Math.max(1, Math.round(toState.majorScreenStep));
                const afterAnchorX = grid._resolveScreenAnchor('x', worldAfter.x, toStep, lockedCursor.x, true, 'major');
                const afterAnchorY = grid._resolveScreenAnchor('y', worldAfter.y, toStep, lockedCursor.y, true, 'major');
                const afterPoint = {
                    x: snapScreenValue(lockedCursor.x, afterAnchorX, toStep),
                    y: snapScreenValue(lockedCursor.y, afterAnchorY, toStep),
                };

                expect(afterPoint.x - beforePoint.x).toBe(0);
                expect(afterPoint.y - beforePoint.y).toBe(0);
            }
        }
    });
});

