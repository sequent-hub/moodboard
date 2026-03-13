import { describe, it, expect } from 'vitest';
import { GridSnapResolver } from '../../src/services/GridSnapResolver.js';
import {
    getScreenAnchor,
    resolveScreenGridState,
    snapScreenValue,
} from '../../src/grid/ScreenGridPhaseMachine.js';

function makeCore(grid, world = { x: 0, y: 0, scale: { x: 1 } }) {
    return {
        boardService: { grid },
        pixi: {
            worldLayer: world,
            app: { stage: world },
        },
    };
}

function makeScreenGrid({ zoom, worldX, worldY, scale, enabled = true, snapEnabled = true }) {
    return {
        enabled,
        snapEnabled,
        snapWorldPoint(x, y) {
            const { screenStep } = resolveScreenGridState(zoom, { minScreenSpacing: 8 });
            const sx = (x * scale) + worldX;
            const sy = (y * scale) + worldY;
            const anchorX = getScreenAnchor(worldX, screenStep);
            const anchorY = getScreenAnchor(worldY, screenStep);
            const snappedScreenX = snapScreenValue(sx, anchorX, screenStep);
            const snappedScreenY = snapScreenValue(sy, anchorY, screenStep);
            return {
                x: (snappedScreenX - worldX) / scale,
                y: (snappedScreenY - worldY) / scale,
            };
        },
    };
}

describe('GridSnapResolver screen-grid contract', () => {
    it('snaps by screen phase at 100% zoom', () => {
        const grid = makeScreenGrid({
            zoom: 1,
            worldX: 13,
            worldY: 7,
            scale: 1,
        });
        const resolver = new GridSnapResolver(makeCore(grid, { x: 13, y: 7, scale: { x: 1 } }));
        const snapped = resolver.snapWorldTopLeft({ x: 9, y: 9 }, { width: 2, height: 2 });
        expect(snapped.x).toBeCloseTo(19, 6);
        expect(snapped.y).toBeCloseTo(19, 6);
    });

    it('snaps by low-zoom phase when spacing changes', () => {
        const grid = makeScreenGrid({
            zoom: 0.1,
            worldX: 13,
            worldY: 7,
            scale: 0.1,
        });
        const resolver = new GridSnapResolver(makeCore(grid, { x: 13, y: 7, scale: { x: 0.1 } }));
        const snapped = resolver.snapWorldTopLeft({ x: 9, y: 9 }, { width: 2, height: 2 });
        expect(snapped.x).toBeCloseTo(-1, 6);
        expect(snapped.y).toBeCloseTo(-1, 6);
    });

    it('returns original position when snap is disabled', () => {
        const grid = makeScreenGrid({
            zoom: 1,
            worldX: 0,
            worldY: 0,
            scale: 1,
            snapEnabled: false,
        });
        const resolver = new GridSnapResolver(makeCore(grid));
        const source = { x: 17, y: 41 };
        const snapped = resolver.snapWorldTopLeft(source, { width: 10, height: 10 });
        expect(snapped).toEqual(source);
    });
});
