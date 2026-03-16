import { describe, expect, it, vi } from 'vitest';

class GraphicsMock {
    constructor() {
        this.alpha = 1;
        this._calls = [];
    }
    clear() {}
    beginFill(color, alpha) {
        this._calls.push({ name: 'beginFill', values: [color, alpha] });
    }
    endFill() {
        this._calls.push({ name: 'endFill', values: [] });
    }
    lineStyle() {}
    moveTo() {}
    lineTo() {}
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

function getCalls(grid, name) {
    return (grid.graphics?._calls || []).filter((c) => c.name === name);
}

describe('DotGrid render checkpoints', () => {
    it('renders points on critical zoom levels', async () => {
        const { DotGrid } = await import('../../src/grid/DotGrid.js');
        const checkpoints = [1, 1.81, 2, 3, 4, 5];
        for (const zoom of checkpoints) {
            const grid = new DotGrid({ enabled: true, size: 20, dotSize: 1, lineWidth: 1 });
            configureGrid(grid, zoom);
            grid.createVisual();
            const circles = getCalls(grid, 'drawCircle');
            expect(circles.length).toBeGreaterThan(0);
        }
    });

    it('uses alpha=1 for dot fill at 400%', async () => {
        const { DotGrid } = await import('../../src/grid/DotGrid.js');
        const grid = new DotGrid({ enabled: true, size: 20, dotSize: 1, lineWidth: 1 });
        configureGrid(grid, 4);
        grid.createVisual();
        const fills = getCalls(grid, 'beginFill');
        expect(fills.length).toBeGreaterThan(0);
        for (const fill of fills) {
            expect(fill.values[1]).toBe(1);
        }
    });

    it('keeps 80px spacing at 400%', async () => {
        const { DotGrid } = await import('../../src/grid/DotGrid.js');
        const grid = new DotGrid({ enabled: true, size: 20, dotSize: 1, lineWidth: 1 });
        configureGrid(grid, 4);
        grid.graphics._calls = [];
        grid.createVisual();

        const circles = getCalls(grid, 'drawCircle');
        expect(circles.length).toBeGreaterThan(1);

        const byY = new Map();
        for (const call of circles) {
            const [x, y] = call.values;
            if (!byY.has(y)) byY.set(y, []);
            byY.get(y).push(x);
        }

        let measured = null;
        for (const xs of byY.values()) {
            if (xs.length < 2) continue;
            const sorted = [...xs].sort((a, b) => a - b);
            measured = sorted[1] - sorted[0];
            break;
        }

        expect(measured).toBe(80);
    });
});
