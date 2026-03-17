import { describe, expect, it, vi } from 'vitest';

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

describe('CrossGrid opacity contract', () => {
    it('forces opacity to 1 regardless of incoming options and setters', async () => {
        const { CrossGrid } = await import('../../src/grid/CrossGrid.js');
        const grid = new CrossGrid({ enabled: true, opacity: 0.25, size: 20 });

        expect(grid.opacity).toBe(1);
        expect(grid.graphics.alpha).toBe(1);

        grid.setOpacity(0.1);
        expect(grid.opacity).toBe(1);
        expect(grid.graphics.alpha).toBe(1);

        grid.createVisual();
        expect(grid.graphics.alpha).toBe(1);
    });
});
