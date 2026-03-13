import { describe, expect, it, vi } from 'vitest';
import { getScreenSpacing } from '../../src/grid/DotGridZoomPhases.js';
import { snapScreenValue } from '../../src/grid/ScreenGridPhaseMachine.js';

class GraphicsMock {
    constructor() {
        this.alpha = 1;
    }
    clear() {}
    beginFill() {}
    endFill() {}
    lineStyle() {}
    drawCircle() {}
    drawRect() {}
    destroy() {}
}

vi.mock('pixi.js', () => ({
    Graphics: GraphicsMock,
}));

const ZOOM_LEVELS = [2, 5, 10, 15, 20, 25, 33, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500];

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
    return Math.max(1, Math.round(getScreenSpacing(zoomScale)));
}

describe('DotGrid cursor-centric invariant', () => {
    it('keeps dot under cursor fixed for all zoom transitions when cursor starts on a dot', async () => {
        const { DotGrid } = await import('../../src/grid/DotGrid.js');
        const transitions = buildTransitions(ZOOM_LEVELS);
        const baseCursors = [
            { x: 120, y: 90 },
            { x: 400, y: 250 },
            { x: 799, y: 599 },
            { x: 1333, y: 777 },
        ];

        for (const cursor of baseCursors) {
            for (const [fromPercent, toPercent] of transitions) {
                const grid = new DotGrid({ enabled: true, size: 20, dotSize: 1 });
                const worldBefore = { x: 137, y: -83, scale: fromPercent / 100 };
                const beforeStep = stepPx(worldBefore.scale);

                const beforeAnchorX = grid._resolveScreenAnchor('x', worldBefore.x, beforeStep, null, false);
                const beforeAnchorY = grid._resolveScreenAnchor('y', worldBefore.y, beforeStep, null, false);
                const beforePoint = {
                    x: snapScreenValue(cursor.x, beforeAnchorX, beforeStep),
                    y: snapScreenValue(cursor.y, beforeAnchorY, beforeStep),
                };

                // Эмулируем сценарий пользователя: курсор стоит прямо на точке сетки.
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
