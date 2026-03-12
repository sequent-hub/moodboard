/**
 * Логика фаз точечной сетки при зуме (чистые функции, тестируемые без PIXI).
 * Фазы подобраны по зафиксированным checkpoint'ам Miro:
 * - high zoom: базовый шаг 20 world units;
 * - low zoom: шаг укрупняется, чтобы избежать перегруза при отрисовке.
 */

/** @type {{ zoomMin: number, zoomMax: number, size: number, dotSize: number }[]} */
export const PHASES = [
    { zoomMin: 0.02, zoomMax: 0.12, size: 160, dotSize: 0.7 },
    { zoomMin: 0.12, zoomMax: 0.25, size: 80, dotSize: 0.8 },
    { zoomMin: 0.25, zoomMax: 0.5, size: 40, dotSize: 0.9 },
    { zoomMin: 0.5, zoomMax: 5, size: 20, dotSize: 1 }
];

/**
 * Возвращает активные фазы и их alpha для crossfade.
 * @param {number} zoom - world.scale.x (1 = 100%)
 * @returns {Array<{ phase: object, alpha: number }>}
 */
export function getActivePhases(zoom) {
    const z = Math.max(0.02, Math.min(5, zoom));
    for (let i = 0; i < PHASES.length; i++) {
        const phase = PHASES[i];
        const inRange = i === PHASES.length - 1
            ? (z >= phase.zoomMin && z <= phase.zoomMax)
            : (z >= phase.zoomMin && z < phase.zoomMax);
        if (inRange) {
            return [{ phase, alpha: 1 }];
        }
    }
    return [{ phase: PHASES[PHASES.length - 1], alpha: 1 }];
}

/**
 * Эффективный size для snap (доминирующая фаза).
 * @param {number} zoom
 * @returns {number}
 */
export function getEffectiveSize(zoom) {
    return getActivePhases(zoom)[0].phase.size;
}
