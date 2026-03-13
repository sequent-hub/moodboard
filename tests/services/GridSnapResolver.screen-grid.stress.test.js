import { describe, expect, it } from 'vitest';

import {
    getScreenAnchor,
    resolveScreenGridState,
    snapScreenValue,
} from '../../src/grid/ScreenGridPhaseMachine.js';
import { GridSnapResolver } from '../../src/services/GridSnapResolver.js';

function makeScreenGrid(type, transform) {
    return {
        type,
        enabled: true,
        snapEnabled: true,
        snapWorldPoint(x, y) {
            const { screenStep } = resolveScreenGridState(transform.scale, { minScreenSpacing: 8 });
            const sx = (x * transform.scale) + transform.worldX;
            const sy = (y * transform.scale) + transform.worldY;
            const anchorX = getScreenAnchor(transform.worldX, screenStep);
            const anchorY = getScreenAnchor(transform.worldY, screenStep);
            const snappedScreenX = snapScreenValue(sx, anchorX, screenStep);
            const snappedScreenY = snapScreenValue(sy, anchorY, screenStep);
            return {
                x: (snappedScreenX - transform.worldX) / transform.scale,
                y: (snappedScreenY - transform.worldY) / transform.scale,
            };
        },
    };
}

function makeResolver(grid) {
    return new GridSnapResolver({ boardService: { grid } });
}

describe('GridSnapResolver screen-grid stress contracts', () => {
    it('keeps snap idempotent across long drag/group/resize/place loops', () => {
        const cases = [
            { name: 'drag', size: { width: 120, height: 80 }, bias: 0.5 },
            { name: 'group-drag', size: { width: 280, height: 190 }, bias: 1.1 },
            { name: 'resize', size: { width: 91, height: 57 }, bias: -0.7 },
            { name: 'place', size: { width: 100, height: 100 }, bias: -1.3 },
        ];

        for (const type of ['dot', 'line', 'cross']) {
            for (let i = 0; i < 700; i += 1) {
                const transform = {
                    worldX: -500 + i * 2.3,
                    worldY: 400 - i * 1.7,
                    scale: Math.max(0.02, Math.min(5, 0.08 + (i % 37) * 0.12)),
                };
                const grid = makeScreenGrid(type, transform);
                const resolver = makeResolver(grid);

                for (const item of cases) {
                    const position = {
                        x: ((i * 13.17) % 1200) - 600 + item.bias,
                        y: ((i * 7.91) % 900) - 450 - item.bias,
                    };
                    const first = resolver.snapWorldTopLeft(position, item.size);
                    const second = resolver.snapWorldTopLeft(first, item.size);

                    expect(Number.isFinite(first.x)).toBe(true);
                    expect(Number.isFinite(first.y)).toBe(true);
                    expect(second.x).toBeCloseTo(first.x, 6);
                    expect(second.y).toBeCloseTo(first.y, 6);
                }
            }
        }
    });

    it('returns stable coordinates when toggling snapEnabled during long run', () => {
        const type = 'dot';
        const transform = { worldX: 130, worldY: -75, scale: 1.2 };
        const grid = makeScreenGrid(type, transform);
        const resolver = makeResolver(grid);

        for (let i = 0; i < 400; i += 1) {
            const source = { x: i * 3.3 - 420, y: i * -2.1 + 180 };
            const size = { width: 90 + (i % 4), height: 55 + (i % 3) };
            grid.snapEnabled = (i % 3) !== 0;
            const snapped = resolver.snapWorldTopLeft(source, size);

            expect(Number.isFinite(snapped.x)).toBe(true);
            expect(Number.isFinite(snapped.y)).toBe(true);
            if (grid.snapEnabled === false) {
                expect(snapped.x).toBe(source.x);
                expect(snapped.y).toBe(source.y);
            }
        }
    });
});
