export class GridSnapResolver {
    constructor(core) {
        this.core = core;
    }

    _getGrid() {
        return this.core?.boardService?.grid || null;
    }

    _isEnabled() {
        const grid = this._getGrid();
        return !!(grid && grid.enabled && grid.snapEnabled !== false);
    }

    snapWorldTopLeft(position, size = null) {
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return position;
        }
        if (!this._isEnabled()) return position;
        const grid = this._getGrid();
        const halfW = size ? (size.width || 0) / 2 : 0;
        const halfH = size ? (size.height || 0) / 2 : 0;
        const center = {
            x: position.x + halfW,
            y: position.y + halfH,
        };
        if (typeof grid.snapWorldPoint === 'function') {
            const snappedCenter = grid.snapWorldPoint(center.x, center.y);
            return {
                x: snappedCenter.x - halfW,
                y: snappedCenter.y - halfH,
            };
        }
        const fallback = grid.snapToGrid(center.x, center.y);
        return {
            x: fallback.x - halfW,
            y: fallback.y - halfH,
        };
    }
}
