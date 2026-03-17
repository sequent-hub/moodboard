import { describe, expect, it } from 'vitest';
import {
    CROSS_CHECKPOINTS,
    getCrossCheckpointForZoom,
    getCrossHalfSize,
    getCrossScreenSpacing,
    updateCrossCheckpoint,
} from '../../src/grid/CrossGridZoomPhases.js';

describe('CrossGridZoomPhases', () => {
    it('returns configured spacing and cross size on key checkpoints', () => {
        const checkpoints = [
            { z: 4.0, cross: 8, spacing: 100 },
            { z: 1.03, cross: 4, spacing: 50 },
            { z: 0.82, cross: 4, spacing: 48 },
            { z: 0.73, cross: 4, spacing: 46 },
            { z: 0.65, cross: 4, spacing: 42 },
            { z: 0.58, cross: 4, spacing: 40 },
            { z: 0.52, cross: 4, spacing: 38 },
            { z: 0.46, cross: 4, spacing: 36 },
            { z: 0.41, cross: 4, spacing: 34 },
            { z: 0.37, cross: 4, spacing: 32 },
            { z: 0.33, cross: 4, spacing: 30 },
            { z: 0.30, cross: 4, spacing: 28 },
            { z: 0.26, cross: 3, spacing: 26 },
            { z: 0.24, cross: 3, spacing: 24 },
            { z: 0.21, cross: 3, spacing: 22 },
            { z: 0.19, cross: 3, spacing: 20 },
            { z: 0.17, cross: 3, spacing: 18 },
            { z: 0.15, cross: 3, spacing: 16 },
            { z: 0.13, cross: 2, spacing: 14 },
            { z: 0.12, cross: 2, spacing: 12 },
            { z: 0.11, cross: 3, spacing: 28 },
            { z: 0.10, cross: 3, spacing: 26 },
            { z: 0.084, cross: 3, spacing: 24 },
            { z: 0.076, cross: 3, spacing: 22 },
            { z: 0.07, cross: 3, spacing: 20 },
            { z: 0.06, cross: 3, spacing: 18 },
            { z: 0.054, cross: 3, spacing: 16 },
            { z: 0.046, cross: 2, spacing: 14 },
            { z: 0.04, cross: 2, spacing: 12 },
            { z: 0.036, cross: 3, spacing: 28 },
            { z: 0.034, cross: 3, spacing: 26 },
            { z: 0.03, cross: 3, spacing: 24 },
            { z: 0.026, cross: 3, spacing: 22 },
            { z: 0.024, cross: 3, spacing: 20 },
            { z: 0.022, cross: 3, spacing: 18 },
            { z: 0.02, cross: 3, spacing: 16 },
            { z: 0.018, cross: 2, spacing: 14 },
            { z: 0.016, cross: 2, spacing: 12 },
            { z: 0.014, cross: 2, spacing: 10 },
        ];

        for (const row of checkpoints) {
            expect(getCrossHalfSize(row.z)).toBe(row.cross);
            expect(getCrossScreenSpacing(row.z)).toBe(row.spacing);
            const checkpoint = getCrossCheckpointForZoom(row.z);
            expect(checkpoint.crossHalfSize).toBe(row.cross);
            expect(checkpoint.spacing).toBe(row.spacing);
        }
    });

    it('contains provided 400% and 103% checkpoints', () => {
        expect(CROSS_CHECKPOINTS.some((r) => r.zoomPercent === 400)).toBe(true);
        expect(CROSS_CHECKPOINTS.some((r) => r.zoomPercent === 103)).toBe(true);
    });

    it('updates checkpoint values for live debug tuning', () => {
        const original = getCrossCheckpointForZoom(1.03);
        const updated = updateCrossCheckpoint(103, { crossHalfSize: 6, spacing: 64 });
        expect(updated?.crossHalfSize).toBe(6);
        expect(updated?.spacing).toBe(64);
        expect(getCrossHalfSize(1.03)).toBe(6);
        expect(getCrossScreenSpacing(1.03)).toBe(64);
        updateCrossCheckpoint(103, {
            crossHalfSize: original.crossHalfSize,
            spacing: original.spacing,
        });
    });
});
