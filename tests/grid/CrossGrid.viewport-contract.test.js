import { describe, expect, it, vi } from 'vitest';
import { getScreenAnchor, snapScreenValue } from '../../src/grid/ScreenGridPhaseMachine.js';
import { getCrossScreenSpacing } from '../../src/grid/CrossGridZoomPhases.js';

class GraphicsMock {
    clear() {}
    beginFill() {}
    endFill() {}
    drawRect() {}
    destroy() {}
}

vi.mock('pixi.js', () => ({
    Graphics: GraphicsMock,
}));

function normalizeAnchor(anchor, stepPx) {
    const step = Math.max(1, Math.round(stepPx));
    return ((Math.round(anchor) % step) + step) % step;
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

describe('CrossGrid viewport contract', () => {
    it('locks anchor to cursor during zoom and releases to world anchor after', async () => {
        const { CrossGrid } = await import('../../src/grid/CrossGrid.js');
        const grid = new CrossGrid({ enabled: true, size: 20, crossHalfSize: 4 });

        const worldBefore = { x: 133, y: -77, scale: 1.03 };
        const beforeStep = Math.max(1, Math.round(getCrossScreenSpacing(worldBefore.scale)));
        const beforeAnchorX = grid._resolveScreenAnchor('x', worldBefore.x, beforeStep, null, false);
        const beforeAnchorY = grid._resolveScreenAnchor('y', worldBefore.y, beforeStep, null, false);
        const cursor = { x: 401, y: 249 };
        const lockedCursor = {
            x: snapScreenValue(cursor.x, beforeAnchorX, beforeStep),
            y: snapScreenValue(cursor.y, beforeAnchorY, beforeStep),
        };

        const worldAfterZoom = applyCursorCentricZoom(worldBefore, lockedCursor, 115);
        const afterStep = Math.max(1, Math.round(getCrossScreenSpacing(worldAfterZoom.scale)));
        const duringZoomAnchorX = grid._resolveScreenAnchor('x', worldAfterZoom.x, afterStep, lockedCursor.x, true);
        const duringZoomAnchorY = grid._resolveScreenAnchor('y', worldAfterZoom.y, afterStep, lockedCursor.y, true);
        expect(duringZoomAnchorX).toBe(normalizeAnchor(lockedCursor.x, afterStep));
        expect(duringZoomAnchorY).toBe(normalizeAnchor(lockedCursor.y, afterStep));

        const snappedDuringZoom = {
            x: snapScreenValue(lockedCursor.x, duringZoomAnchorX, afterStep),
            y: snapScreenValue(lockedCursor.y, duringZoomAnchorY, afterStep),
        };
        expect(snappedDuringZoom.x).toBe(lockedCursor.x);
        expect(snappedDuringZoom.y).toBe(lockedCursor.y);

        const worldAfterRelease = { x: worldAfterZoom.x + 17, y: worldAfterZoom.y - 11, scale: worldAfterZoom.scale };
        const releasedAnchorX = grid._resolveScreenAnchor('x', worldAfterRelease.x, afterStep, lockedCursor.x, false);
        const releasedAnchorY = grid._resolveScreenAnchor('y', worldAfterRelease.y, afterStep, lockedCursor.y, false);
        expect(releasedAnchorX).toBe(normalizeAnchor(getScreenAnchor(worldAfterRelease.x, afterStep), afterStep));
        expect(releasedAnchorY).toBe(normalizeAnchor(getScreenAnchor(worldAfterRelease.y, afterStep), afterStep));
    });

    it('preserves cursor-to-node offset when cursor is not on a node', async () => {
        const { CrossGrid } = await import('../../src/grid/CrossGrid.js');
        const grid = new CrossGrid({ enabled: true, size: 20, crossHalfSize: 4 });

        const worldBefore = { x: 137, y: -83, scale: 1.03 };
        const beforeStep = Math.max(1, Math.round(getCrossScreenSpacing(worldBefore.scale)));
        const beforeAnchorX = grid._resolveScreenAnchor('x', worldBefore.x, beforeStep, null, false);
        const beforeAnchorY = grid._resolveScreenAnchor('y', worldBefore.y, beforeStep, null, false);
        const cursor = { x: 401, y: 249 }; // намеренно не привязан к узлу
        const beforeOffsetX = normalizeAnchor(Math.round(cursor.x) - beforeAnchorX, beforeStep);
        const beforeOffsetY = normalizeAnchor(Math.round(cursor.y) - beforeAnchorY, beforeStep);

        const worldAfterZoom = applyCursorCentricZoom(worldBefore, cursor, 115);
        const afterStep = Math.max(1, Math.round(getCrossScreenSpacing(worldAfterZoom.scale)));
        const duringZoomAnchorX = grid._resolveScreenAnchor('x', worldAfterZoom.x, afterStep, cursor.x, true);
        const duringZoomAnchorY = grid._resolveScreenAnchor('y', worldAfterZoom.y, afterStep, cursor.y, true);

        const afterOffsetX = normalizeAnchor(Math.round(cursor.x) - duringZoomAnchorX, afterStep);
        const afterOffsetY = normalizeAnchor(Math.round(cursor.y) - duringZoomAnchorY, afterStep);

        expect(afterOffsetX).toBe(normalizeAnchor(beforeOffsetX, afterStep));
        expect(afterOffsetY).toBe(normalizeAnchor(beforeOffsetY, afterStep));
    });
});
