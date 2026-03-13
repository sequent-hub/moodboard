import { incrementGridDiagnosticCounter, logGridDiagnostic } from '../grid/GridDiagnostics.js';

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
        incrementGridDiagnosticCounter('gridSnapResolver.snapWorldTopLeft.calls');
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return position;
        }
        if (!this._isEnabled()) {
            logGridDiagnostic('GridSnapResolver', 'snap skipped: grid disabled', { position, size });
            return position;
        }
        const grid = this._getGrid();
        const halfW = size ? (size.width || 0) / 2 : 0;
        const halfH = size ? (size.height || 0) / 2 : 0;
        const center = {
            x: position.x + halfW,
            y: position.y + halfH,
        };
        if (typeof grid.snapWorldPoint === 'function') {
            const snappedCenter = grid.snapWorldPoint(center.x, center.y);
            const snapped = {
                x: snappedCenter.x - halfW,
                y: snappedCenter.y - halfH,
            };
            logGridDiagnostic('GridSnapResolver', 'snap via snapWorldPoint', {
                type: grid.type || 'unknown',
                position,
                size,
                snapped,
            });
            return snapped;
        }
        const fallback = grid.snapToGrid(center.x, center.y);
        const snapped = {
            x: fallback.x - halfW,
            y: fallback.y - halfH,
        };
        logGridDiagnostic('GridSnapResolver', 'snap via snapToGrid fallback', {
            type: grid.type || 'unknown',
            position,
            size,
            snapped,
        });
        return snapped;
    }
}
