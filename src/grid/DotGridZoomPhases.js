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

function clampZoom(zoom) {
    return Math.max(0.02, Math.min(5, zoom || 1));
}

function foldZoomForCyclicSpacing(zoom) {
    const z = clampZoom(zoom);
    if (z >= 0.5) return z;
    let folded = z;
    while (folded < 0.5) {
        folded *= 2;
    }
    return Math.min(folded, 1);
}

/**
 * Для DotGrid границы фаз выбираются по "нижней" фазе (включительно),
 * чтобы на 50% происходил ожидаемый визуальный скачок.
 */
function resolveDotPhase(zoom) {
    const z = clampZoom(zoom);
    for (const phase of PHASES) {
        if (z >= phase.zoomMin && z <= phase.zoomMax) {
            return phase;
        }
    }
    return PHASES[PHASES.length - 1];
}

/**
 * Возвращает активные фазы и их alpha для crossfade.
 * @param {number} zoom - world.scale.x (1 = 100%)
 * @returns {Array<{ phase: object, alpha: number }>}
 */
export function getActivePhases(zoom) {
    const phase = resolveDotPhase(zoom);
    return [{ phase, alpha: 1 }];
}

/**
 * Эффективный size для snap (доминирующая фаза).
 * @param {number} zoom
 * @returns {number}
 */
export function getEffectiveSize(zoom) {
    return resolveDotPhase(zoom).size;
}

/**
 * Возвращает screen-spacing в px для текущего zoom.
 * @param {number} zoom
 * @param {number} minScreenSpacing
 * @returns {number}
 */
export function getScreenSpacing(zoom) {
    const z = clampZoom(zoom);
    // Цикличный режим: ниже 50% используем тот же набор экранных шагов,
    // что и в диапазоне 100%..50%, чтобы шаг не деградировал на экстремально малых зумах.
    const cycleZoom = foldZoomForCyclicSpacing(z);
    const step = resolveDotPhase(cycleZoom).size * cycleZoom;
    return Math.max(1, Math.round(step));
}
