/**
 * DotGridZoomPhases: тесты фазового переключения при зуме.
 * Чистые функции без PIXI — защита от регрессий зуммирования сетки.
 */
import { describe, it, expect } from 'vitest';
import {
  getActivePhases,
  getEffectiveSize,
  PHASES,
} from '../../src/grid/DotGridZoomPhases.js';

const HARMONIC_SIZES = [96, 48, 24, 12];

describe('DotGridZoomPhases', () => {
  describe('getEffectiveSize', () => {
    it('returns only harmonic sizes (96, 48, 24, 12)', () => {
      const zooms = [0.1, 0.2, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5];
      for (const z of zooms) {
        const size = getEffectiveSize(z);
        expect(HARMONIC_SIZES).toContain(size);
      }
    });

    it('returns finer grid at higher zoom (size decreases)', () => {
      const sizeLow = getEffectiveSize(0.2);
      const sizeMid = getEffectiveSize(1);
      const sizeHigh = getEffectiveSize(3);

      expect(sizeLow).toBeGreaterThanOrEqual(sizeMid);
      expect(sizeMid).toBeGreaterThanOrEqual(sizeHigh);
    });

    it('at zoom 1 (100%) returns 24 or 48', () => {
      const size = getEffectiveSize(1);
      expect([24, 48]).toContain(size);
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
        expect(phases.length).toBeGreaterThanOrEqual(1);
        expect(phases.every((p) => p.alpha > 0 && p.alpha <= 1)).toBe(true);
      }
    });

    it('in overlap zone returns two phases with crossfade', () => {
      const phases = getActivePhases(0.4);
      expect(phases.length).toBe(2);
      const alphas = phases.map((p) => p.alpha);
      expect(alphas.some((a) => a < 1)).toBe(true);
    });

    it('phase sizes are always harmonic', () => {
      for (const z of [0.2, 0.5, 1, 1.5]) {
        const phases = getActivePhases(z);
        for (const { phase } of phases) {
          expect(HARMONIC_SIZES).toContain(phase.size);
        }
      }
    });
  });

  describe('harmonic invariant (no moiré)', () => {
    it('all phase sizes divide each other (96→48→24→12)', () => {
      for (let i = 0; i < HARMONIC_SIZES.length - 1; i++) {
        const coarse = HARMONIC_SIZES[i];
        const fine = HARMONIC_SIZES[i + 1];
        expect(coarse % fine).toBe(0);
      }
    });

    it('PHASES uses harmonic sizes', () => {
      const sizes = [...new Set(PHASES.map((p) => p.size))].sort((a, b) => b - a);
      expect(sizes).toEqual([96, 48, 24, 12]);
    });
  });
});
