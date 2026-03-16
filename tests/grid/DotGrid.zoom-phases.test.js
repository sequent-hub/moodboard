/**
 * DotGridZoomPhases: тесты профиля dot-grid.
 * Чистые функции без PIXI — защита от регрессий зумирования сетки.
 */
import { describe, it, expect } from 'vitest';
import {
  DOT_CHECKPOINTS,
  getActivePhases,
  getDotColor,
  getDotOpacity,
  getEffectiveSize,
  getScreenDotRadius,
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

  describe('dot checkpoints definition', () => {
    it('contains fixed checkpoint for 181% and 400%', () => {
      expect(DOT_CHECKPOINTS.some((r) => r.zoomPercent === 181)).toBe(true);
      expect(DOT_CHECKPOINTS.some((r) => r.zoomPercent === 400)).toBe(true);
    });
  });

  describe('getScreenSpacing', () => {
    it('returns fixed spacing by checkpoint', () => {
      const checkpoints = [
        { z: 0.10, step: 16 },
        { z: 0.15, step: 12 },
        { z: 0.20, step: 16 },
        { z: 0.33, step: 13 },
        { z: 0.50, step: 10 },
        { z: 0.75, step: 15 },
        { z: 1.00, step: 20 },
        { z: 1.29, step: 26 },
        { z: 1.44, step: 29 },
        { z: 1.62, step: 32 },
        { z: 1.81, step: 36 },
        { z: 2.00, step: 40 },
        { z: 3.00, step: 60 },
        { z: 4.00, step: 80 },
        { z: 5.00, step: 100 },
      ];
      for (const row of checkpoints) {
        expect(getScreenSpacing(row.z)).toBe(row.step);
      }
    });
  });

  describe('getScreenDotRadius', () => {
    it('returns fixed radius by checkpoint', () => {
      expect(getScreenDotRadius(0.1)).toBe(1);
      expect(getScreenDotRadius(1)).toBe(1);
      expect(getScreenDotRadius(1.29)).toBe(2);
      expect(getScreenDotRadius(1.44)).toBe(2);
      expect(getScreenDotRadius(1.62)).toBe(2);
      expect(getScreenDotRadius(1.81)).toBe(2);
      expect(getScreenDotRadius(2)).toBe(2);
      expect(getScreenDotRadius(3)).toBe(3);
      expect(getScreenDotRadius(4)).toBe(4);
      expect(getScreenDotRadius(5)).toBe(5);
    });
  });

  describe('getDotColor', () => {
    it('returns fixed color for checkpoints', () => {
      expect(getDotColor(1.29)).toBe(0xE3E3E3);
      expect(getDotColor(1.44)).toBe(0xE7E7E7);
      expect(getDotColor(1.62)).toBe(0xE5E5E5);
      expect(getDotColor(1.81)).toBe(0xE2E2E2);
      expect(getDotColor(4.0)).toBe(0xE8E8E8);
    });
  });

  describe('getDotOpacity', () => {
    it('always returns 1 for any zoom checkpoint', () => {
      expect(getDotOpacity(1)).toBe(1);
      expect(getDotOpacity(0.02)).toBe(1);
      expect(getDotOpacity(0.1)).toBe(1);
      expect(getDotOpacity(0.5)).toBe(1);
      expect(getDotOpacity(1.25)).toBe(1);
      expect(getDotOpacity(4)).toBe(1);
      expect(getDotOpacity(5)).toBe(1);
    });
  });
});
