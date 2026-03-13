/**
 * DotGridZoomPhases: тесты профиля dot-grid.
 * Чистые функции без PIXI — защита от регрессий зумирования сетки.
 */
import { describe, it, expect } from 'vitest';
import {
  getActivePhases,
  getEffectiveSize,
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
});
