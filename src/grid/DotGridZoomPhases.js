import { resolveScreenGridState } from './ScreenGridPhaseMachine.js';

/**
 * Логика фаз точечной сетки при зуме (чистые функции, тестируемые без PIXI).
 */

/** @type {{ zoomMin: number, zoomMax: number, size: number, dotSize: number }[]} */
export const PHASES = [
    { zoomMin: 0.02, zoomMax: 0.12, size: 160, dotSize: 0.7 },
    { zoomMin: 0.12, zoomMax: 0.25, size: 80, dotSize: 0.8 },
    { zoomMin: 0.25, zoomMax: 0.5, size: 40, dotSize: 0.9 },
    { zoomMin: 0.5, zoomMax: 5, size: 20, dotSize: 1 },
];

/**
 * Возвращает активные фазы и их alpha для crossfade.
 * @param {number} zoom - world.scale.x (1 = 100%)
 * @returns {Array<{ phase: object, alpha: number }>}
 */
export function getActivePhases(zoom) {
    const state = resolveScreenGridState(zoom, {
        phases: PHASES.map((p) => ({ zoomMin: p.zoomMin, zoomMax: p.zoomMax, worldStep: p.size })),
        minScreenSpacing: 0,
    });
    const phase = PHASES.find((p) => p.size === state.worldStep) || PHASES[PHASES.length - 1];
    return [{ phase, alpha: 1 }];
}

/**
 * Эффективный size для snap (доминирующая фаза).
 * @param {number} zoom
 * @returns {number}
 */
export function getEffectiveSize(zoom) {
    const state = resolveScreenGridState(zoom, {
        phases: PHASES.map((p) => ({ zoomMin: p.zoomMin, zoomMax: p.zoomMax, worldStep: p.size })),
    });
    return state.worldStep;
}

/**
 * Возвращает screen-spacing в px для текущего zoom.
 * @param {number} zoom
 * @param {number} minScreenSpacing
 * @returns {number}
 */
export function getScreenSpacing(zoom, minScreenSpacing = 8) {
    const state = resolveScreenGridState(zoom, {
        phases: PHASES.map((p) => ({ zoomMin: p.zoomMin, zoomMax: p.zoomMax, worldStep: p.size })),
        minScreenSpacing,
    });
    return state.screenStep;
}
