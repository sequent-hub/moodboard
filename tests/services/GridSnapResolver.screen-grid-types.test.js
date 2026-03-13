import { describe, expect, it } from 'vitest';

import {
    getScreenAnchor,
    resolveScreenGridState,
    snapScreenValue,
} from '../../src/grid/ScreenGridPhaseMachine.js';
import { GridSnapResolver } from '../../src/services/GridSnapResolver.js';

function makeConfiguredGrid(type, transform) {
    return {
        type,
        enabled: true,
        snapEnabled: true,
        snapWorldPoint(x, y) {
            const { worldX, worldY, scale } = transform;
            const { screenStep } = resolveScreenGridState(scale, { minScreenSpacing: 8 });
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

function makeResolver(grid) {
    return new GridSnapResolver({
        boardService: { grid },
    });
}

describe('GridSnapResolver screen-grid contract for dot/line/cross', () => {
    const transforms = [
        { worldX: 13, worldY: -7, scale: 1 },
        { worldX: -120, worldY: 320, scale: 0.3 },
        { worldX: 420, worldY: -260, scale: 2.2 },
    ];
    const flowCases = [
        { name: 'drag', position: { x: 17, y: 29 }, size: { width: 120, height: 80 } },
        { name: 'group-drag', position: { x: -55, y: 141 }, size: { width: 240, height: 160 } },
        { name: 'resize', position: { x: 231, y: -44 }, size: { width: 91, height: 57 } },
        { name: 'place', position: { x: -312, y: 77 }, size: { width: 100, height: 100 } },
    ];

    for (const type of ['dot', 'line', 'cross']) {
        for (const transform of transforms) {
            it(`keeps idempotent snap in ${type} at scale=${transform.scale}`, () => {
                const grid = makeConfiguredGrid(type, transform);
                const resolver = makeResolver(grid);

                for (const flow of flowCases) {
                    const first = resolver.snapWorldTopLeft(flow.position, flow.size);
                    const second = resolver.snapWorldTopLeft(first, flow.size);
                    expect(Number.isFinite(first.x)).toBe(true);
                    expect(Number.isFinite(first.y)).toBe(true);
                    expect(second.x).toBeCloseTo(first.x, 6);
                    expect(second.y).toBeCloseTo(first.y, 6);
                }
            });
        }
    }
});
