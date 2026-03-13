/**
 * DotGridZoomPhases: тесты профиля dot-grid.
 * Чистые функции без PIXI — защита от регрессий зумирования сетки.
 */
import { describe, it, expect } from 'vitest';
import {
  getActivePhases,
  getDotOpacity,
  getEffectiveSize,
  getScreenSpacing,
  PHASES,
} from '../../src/grid/DotGridZoomPhases.js';

const EXPECTED_BY_ZOOM = [
  { z: 0.10, size: 160 },
  { z: 0.15, size: 80 },
  { z: 0.20, size: 80 },
  { z: 0.33, size: 40 },
  { z: 0.50, size: 40 },
  { z: 1.00, size: 20 },
  { z: 2.00, size: 20 },
  { z: 4.00, size: 20 },
];

describe('DotGridZoomPhases', () => {
  describe('getEffectiveSize', () => {
    it('returns expected world steps for zoom checkpoints', () => {
      for (const { z, size } of EXPECTED_BY_ZOOM) {
        expect(getEffectiveSize(z)).toBe(size);
      }
    });

    it('clamps zoom to 0.02-5 range', () => {
      expect(getEffectiveSize(0.01)).toBe(getEffectiveSize(0.02));
      expect(getEffectiveSize(10)).toBe(getEffectiveSize(5));
    });
  });

  describe('getActivePhases', () => {
    it('returns at least one phase for any zoom in range', () => {
      for (const z of [0.1, 0.4, 0.5, 1, 2, 5]) {
        const phases = getActivePhases(z);
        expect(phases.length).toBe(1);
        expect(phases.every((p) => p.alpha > 0 && p.alpha <= 1)).toBe(true);
      }
    });

    it('always returns one active phase with alpha=1', () => {
      const phases = getActivePhases(0.33);
      expect(phases.length).toBe(1);
      expect(phases[0].alpha).toBe(1);
    });

    it('phase size matches expected table', () => {
      for (const { z, size } of EXPECTED_BY_ZOOM) {
        const phases = getActivePhases(z);
        expect(phases[0].phase.size).toBe(size);
      }
    });

    it('uses coarse phase exactly at 50% boundary', () => {
      expect(getActivePhases(0.5)[0].phase.size).toBe(40);
      expect(getActivePhases(0.5001)[0].phase.size).toBe(20);
    });
  });

  describe('phase definition', () => {
    it('PHASES contains low-zoom coarsening + base phase', () => {
      expect(PHASES.length).toBe(4);
      expect(PHASES[0].size).toBe(160);
      expect(PHASES[1].size).toBe(80);
      expect(PHASES[2].size).toBe(40);
      expect(PHASES[3].size).toBe(20);
      expect(PHASES[0].zoomMin).toBe(0.02);
      expect(PHASES[3].zoomMax).toBe(5);
    });
  });

  describe('getScreenSpacing', () => {
    it('keeps >=100% profile unchanged and orders 100..2 checkpoints', () => {
      const checkpoints = [
        { z: 1.0, step: 20 },
        { z: 0.75, step: 19 },
        { z: 0.5, step: 18 },
        { z: 0.33, step: 17 },
        { z: 0.25, step: 16 },
        { z: 0.2, step: 15 },
        { z: 0.15, step: 14 },
        { z: 0.1, step: 13 },
        { z: 0.05, step: 12 },
        { z: 0.02, step: 11 },
      ];
      for (const row of checkpoints) {
        expect(getScreenSpacing(row.z)).toBe(row.step);
      }
    });
  });

  describe('getDotOpacity', () => {
    it('returns 1.0 at 100%, 0.5 at 2%, and 0.3 at 500%', () => {
      expect(getDotOpacity(1)).toBe(1);
      expect(getDotOpacity(0.02)).toBe(0.5);
      expect(getDotOpacity(5)).toBe(0.3);
    });

    it('returns interpolated opacity between 2% and 100%', () => {
      expect(getDotOpacity(0.5)).toBeCloseTo(0.744897959, 6);
      expect(getDotOpacity(0.25)).toBeCloseTo(0.617346939, 6);
      expect(getDotOpacity(0.1)).toBeCloseTo(0.540816327, 6);
    });

    it('matches configured opacity checkpoints at >100%', () => {
      expect(getDotOpacity(1.25)).toBeCloseTo(0.9, 6);
      expect(getDotOpacity(1.5)).toBeCloseTo(0.7, 6);
      expect(getDotOpacity(2)).toBeCloseTo(0.6, 6);
      expect(getDotOpacity(2.5)).toBeCloseTo(0.5, 6);
      expect(getDotOpacity(3)).toBeCloseTo(0.4, 6);
      expect(getDotOpacity(4)).toBeCloseTo(0.35, 6);
      expect(getDotOpacity(5)).toBeCloseTo(0.3, 6);
    });

    it('interpolates between >100% checkpoints', () => {
      // between 125%(0.9) and 150%(0.7)
      expect(getDotOpacity(1.375)).toBeCloseTo(0.8, 6);
      // between 300%(0.4) and 400%(0.35)
      expect(getDotOpacity(3.5)).toBeCloseTo(0.375, 6);
    });
  });
});
