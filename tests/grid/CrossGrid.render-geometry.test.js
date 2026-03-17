import { describe, expect, it, vi } from 'vitest';

class GraphicsMock {
    constructor() {
        this.alpha = 1;
        this._rects = [];
        this._fills = [];
    }
    clear() {}
    beginFill(color, alpha) {
        this._fills.push({ color, alpha });
    }
    endFill() {}
    drawRect(x, y, w, h) {
        this._rects.push({ x, y, w, h });
    }
    destroy() {}
}

vi.mock('pixi.js', () => ({
    Graphics: GraphicsMock,
}));

describe('CrossGrid render geometry', () => {
    it('draws each cross as two centered 1px rect strokes', async () => {
        const { CrossGrid } = await import('../../src/grid/CrossGrid.js');
        const grid = new CrossGrid({ enabled: true, size: 20, crossHalfSize: 4 });
        grid.setZoom(1.03);
        grid.setViewportTransform({
            worldX: 13,
            worldY: -9,
            scale: 1.03,
            viewWidth: 200,
            viewHeight: 140,
        });
        grid.setVisibleBounds(-8, -8, 120, 80);
        grid.graphics._rects = [];
        grid.graphics._fills = [];

        grid.createVisual();

        const fills = grid.graphics._fills;
        const rects = grid.graphics._rects;
        expect(fills.length).toBeGreaterThan(0);
        expect(fills[0].alpha).toBe(1);
        expect(rects.length % 2).toBe(0);
        expect(rects.length).toBeGreaterThan(0);

        for (let i = 0; i < rects.length; i += 2) {
            const h = rects[i];
            const v = rects[i + 1];

            // Horizontal stroke is 1px high; vertical stroke is 1px wide.
            expect(h.h).toBe(1);
            expect(v.w).toBe(1);

            // Both arms are odd-length and centered around the same pixel.
            expect((h.w - 1) % 2).toBe(0);
            expect((v.h - 1) % 2).toBe(0);
            const cx = h.x + ((h.w - 1) / 2);
            const cy = v.y + ((v.h - 1) / 2);
            expect(cx).toBe(v.x);
            expect(cy).toBe(h.y);
        }
    });
});
