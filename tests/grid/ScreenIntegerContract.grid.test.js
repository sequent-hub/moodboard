import { describe, expect, it, vi } from 'vitest';
import { createIntegerGuard } from '../helpers/pixelPerfectIntegerGuard.js';

class GraphicsMock {
    constructor() {
        this.alpha = 1;
        this._calls = [];
    }
    clear() {}
    beginFill() {}
    endFill() {}
    lineStyle() {}
    moveTo(x, y) {
        this._calls.push({ name: 'moveTo', values: [x, y] });
    }
    lineTo(x, y) {
        this._calls.push({ name: 'lineTo', values: [x, y] });
    }
    drawCircle(x, y, r) {
        this._calls.push({ name: 'drawCircle', values: [x, y, r] });
    }
    drawRect(x, y, w, h) {
        this._calls.push({ name: 'drawRect', values: [x, y, w, h] });
    }
    destroy() {}
}

vi.mock('pixi.js', () => ({
    Graphics: GraphicsMock,
}));

function getCalls(grid) {
    return grid.graphics?._calls || [];
}

function configureGrid(grid, zoom) {
    grid.setZoom(zoom);
    grid.setViewportTransform({
        worldX: 13,
        worldY: -9,
        scale: zoom,
        viewWidth: 800,
        viewHeight: 600,
    });
    grid.setVisibleBounds(-32, -32, 832, 632);
}

describe('Pixel-perfect integer contract: grid', () => {
    const checkpoints = [0.1, 0.33, 0.5, 1, 2];

    it('DotGrid emits integer draw coordinates on zoom checkpoints', async () => {
        const { DotGrid } = await import('../../src/grid/DotGrid.js');
        for (const zoom of checkpoints) {
            const grid = new DotGrid({ enabled: true, size: 20, dotSize: 1, lineWidth: 1 });
            configureGrid(grid, zoom);
            grid.createVisual();

            const guard = createIntegerGuard(`DotGrid@${zoom}`);
            for (const call of getCalls(grid)) {
                call.values.forEach((value, index) => guard.collect(`${call.name}[${index}]`, value));
            }
            guard.assertNoFractions();
        }
        expect(true).toBe(true);
    });

    it('LineGrid emits integer draw coordinates on zoom checkpoints', async () => {
        const { LineGrid } = await import('../../src/grid/LineGrid.js');
        for (const zoom of checkpoints) {
            const grid = new LineGrid({
                enabled: true,
                size: 20,
                lineWidth: 1,
                showSubGrid: true,
                subGridDivisions: 4,
                subGridColor: 0xcccccc,
                subGridOpacity: 0.3,
            });
            configureGrid(grid, zoom);
            grid.createVisual();

            const guard = createIntegerGuard(`LineGrid@${zoom}`);
            for (const call of getCalls(grid)) {
                call.values.forEach((value, index) => guard.collect(`${call.name}[${index}]`, value));
            }
            guard.assertNoFractions();
        }
        expect(true).toBe(true);
    });

    it('CrossGrid emits integer draw coordinates on zoom checkpoints', async () => {
        const { CrossGrid } = await import('../../src/grid/CrossGrid.js');
        for (const zoom of checkpoints) {
            const grid = new CrossGrid({ enabled: true, size: 20, crossHalfSize: 4, crossLineWidth: 1 });
            configureGrid(grid, zoom);
            grid.createVisual();

            const guard = createIntegerGuard(`CrossGrid@${zoom}`);
            for (const call of getCalls(grid)) {
                call.values.forEach((value, index) => guard.collect(`${call.name}[${index}]`, value));
            }
            guard.assertNoFractions();
        }
        expect(true).toBe(true);
    });
});
