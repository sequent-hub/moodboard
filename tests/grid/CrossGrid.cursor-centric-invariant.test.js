import { describe, expect, it, vi } from 'vitest';
import { getCrossScreenSpacing } from '../../src/grid/CrossGridZoomPhases.js';
import { snapScreenValue } from '../../src/grid/ScreenGridPhaseMachine.js';
import { MIRO_ZOOM_LEVELS } from '../../src/services/MiroZoomLevels.js';

class GraphicsMock {
    constructor() {
        this.alpha = 1;
    }
    clear() {}
    beginFill() {}
    endFill() {}
    drawRect() {}
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

function stepPx(zoomScale) {
    return Math.max(1, Math.round(getCrossScreenSpacing(zoomScale)));
}

describe('CrossGrid cursor-centric invariant', () => {
    it('keeps cross node under cursor fixed across zoom transitions', async () => {
        const { CrossGrid } = await import('../../src/grid/CrossGrid.js');
        const transitions = buildTransitions(MIRO_ZOOM_LEVELS);
        const baseCursors = [
            { x: 120, y: 90 },
            { x: 400, y: 250 },
            { x: 799, y: 599 },
        ];

        for (const cursor of baseCursors) {
            for (const [fromPercent, toPercent] of transitions) {
                const grid = new CrossGrid({ enabled: true, size: 20, crossHalfSize: 4 });
                const worldBefore = { x: 137, y: -83, scale: fromPercent / 100 };
                const beforeStep = stepPx(worldBefore.scale);

                const beforeAnchorX = grid._resolveScreenAnchor('x', worldBefore.x, beforeStep, null, false);
                const beforeAnchorY = grid._resolveScreenAnchor('y', worldBefore.y, beforeStep, null, false);
                const beforePoint = {
                    x: snapScreenValue(cursor.x, beforeAnchorX, beforeStep),
                    y: snapScreenValue(cursor.y, beforeAnchorY, beforeStep),
                };

                const lockedCursor = { x: beforePoint.x, y: beforePoint.y };
                const worldAfter = applyCursorCentricZoom(worldBefore, lockedCursor, toPercent);
                const afterStep = stepPx(worldAfter.scale);

                const afterAnchorX = grid._resolveScreenAnchor('x', worldAfter.x, afterStep, lockedCursor.x, true);
                const afterAnchorY = grid._resolveScreenAnchor('y', worldAfter.y, afterStep, lockedCursor.y, true);
                const afterPoint = {
                    x: snapScreenValue(lockedCursor.x, afterAnchorX, afterStep),
                    y: snapScreenValue(lockedCursor.y, afterAnchorY, afterStep),
                };

                expect(afterPoint.x - beforePoint.x).toBe(0);
                expect(afterPoint.y - beforePoint.y).toBe(0);
            }
        }
    });
});
