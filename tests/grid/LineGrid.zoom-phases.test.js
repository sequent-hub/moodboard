import { describe, expect, it } from 'vitest';
import { resolveLineGridState } from '../../src/grid/LineGridZoomPhases.js';

describe('LineGridZoomPhases', () => {
    it('matches configured checkpoints with major/minor/super grid', () => {
        const checkpoints = [
            { z: 0.92, major: 18, minor: 4, super: 72 },
            { z: 0.82, major: 16, minor: 3, super: 64 },
            { z: 0.73, major: 60, minor: null },
            { z: 0.33, major: 26, minor: 5, super: 104 },
            { z: 0.30, major: 24, minor: 5, super: 96 },
            { z: 0.26, major: 21, minor: 4, super: 84 },
            { z: 0.24, major: 19, minor: 4, super: 76 },
            { z: 0.21, major: 17, minor: 3, super: 68 },
            { z: 0.19, major: 60, minor: null },
            { z: 0.17, major: 54, minor: 11, super: 216 },
            { z: 0.15, major: 48, minor: 10, super: 192 },
            { z: 0.13, major: 42, minor: 8, super: 168 },
            { z: 0.12, major: 38, minor: 8, super: 152 },
            { z: 0.11, major: 34, minor: 7, super: 136 },
            { z: 0.10, major: 30, minor: 6, super: 120 },
            { z: 0.084, major: 27, minor: 5, super: 108 },
            { z: 0.076, major: 24, minor: 5, super: 96 },
            { z: 0.07, major: 22, minor: 4, super: 88 },
            { z: 0.06, major: 20, minor: 4, super: 80 },
            { z: 0.054, major: 17, minor: 3, super: 68 },
            { z: 0.046, major: 60, minor: null },
            { z: 0.04, major: 55, minor: 11, super: 220 },
            { z: 0.036, major: 49, minor: 10, super: 196 },
            { z: 0.034, major: 44, minor: 9, super: 176 },
            { z: 0.03, major: 39, minor: 8, super: 156 },
            { z: 0.026, major: 35, minor: 7, super: 140 },
            { z: 0.024, major: 31, minor: 6, super: 124 },
            { z: 0.022, major: 27, minor: 5, super: 108 },
            { z: 0.02, major: 25, minor: 5, super: 100 },
            { z: 0.018, major: 22, minor: 4, super: 88 },
            { z: 0.016, major: 20, minor: 4, super: 80 },
            { z: 0.014, major: 17, minor: 3, super: 68 },
            { z: 0.65, major: 52, minor: 10, super: 208 },
            { z: 0.58, major: 46, minor: 9, super: 184 },
            { z: 0.52, major: 42, minor: 8, super: 168 },
            { z: 0.46, major: 37, minor: 7, super: 148 },
            { z: 0.41, major: 33, minor: 7, super: 132 },
            { z: 0.37, major: 30, minor: 6, super: 120 },
            { z: 1.03, major: 20, minor: 4, super: 80 },
            { z: 1.15, major: 23, minor: 5, super: 92 },
            { z: 1.29, major: 25, minor: 5, super: 100 },
            { z: 1.44, major: 30, minor: 6, super: 120 },
            { z: 1.62, major: 35, minor: 7, super: 140 },
            { z: 1.81, major: 35, minor: 7, super: 140 },
            { z: 2.03, major: 40, minor: 8, super: 160 },
            { z: 2.27, major: 45, minor: 9, super: 180 },
            { z: 2.54, major: 50, minor: 10, super: 200 },
            { z: 2.85, major: 60, minor: 12 },
            { z: 3.19, major: 64, minor: 13 },
            { z: 3.57, major: 70, minor: 14 },
            { z: 4.0, major: 80, minor: 16 },
        ];

        for (const row of checkpoints) {
            const state = resolveLineGridState(row.z, { subGridDivisions: 5, minScreenSpacing: 8 });
            expect(state.majorScreenStep).toBe(row.major);
            if (row.minor == null) {
                expect(state.minorScreenStep).toBeNull();
            } else {
                expect(state.minorScreenStep).toBe(row.minor);
            }
            if (row.super != null) {
                expect(state.superMajorScreenStep).toBe(row.super);
            } else {
                expect(state.superMajorScreenStep).toBeNull();
            }
            expect(state.showSubGridByZoom).toBe(row.minor != null);
        }
    });

    it('keeps single-grid checkpoints at 73%, 19% and second 5% pass', () => {
        const z73 = resolveLineGridState(0.73, { subGridDivisions: 5 });
        const z19 = resolveLineGridState(0.19, { subGridDivisions: 5 });
        const z5second = resolveLineGridState(0.046, { subGridDivisions: 5 });
        expect(z73.showSubGridByZoom).toBe(false);
        expect(z19.showSubGridByZoom).toBe(false);
        expect(z5second.showSubGridByZoom).toBe(false);
        expect(z73.minorScreenStep).toBeNull();
        expect(z19.minorScreenStep).toBeNull();
        expect(z5second.minorScreenStep).toBeNull();
    });

    it('supports duplicate zoom labels 8 and 5 with different major steps', () => {
        const z8first = resolveLineGridState(0.084, { subGridDivisions: 5 });
        const z8second = resolveLineGridState(0.076, { subGridDivisions: 5 });
        const z5first = resolveLineGridState(0.054, { subGridDivisions: 5 });
        const z5second = resolveLineGridState(0.046, { subGridDivisions: 5 });

        expect(z8first.majorScreenStep).toBe(27);
        expect(z8second.majorScreenStep).toBe(24);
        expect(z5first.majorScreenStep).toBe(17);
        expect(z5second.majorScreenStep).toBe(60);
    });
});

