/**
 * Логика фаз точечной сетки при зуме (чистые функции, тестируемые без PIXI).
 * Размеры гармоничные: 96→48→24→12, узлы совпадают при crossfade, нет moiré.
 */

/** @type {{ zoomMin: number, zoomMax: number, size: number, dotSize: number }[]} */
export const PHASES = [
    { zoomMin: 0.1, zoomMax: 0.45, size: 96, dotSize: 2 },   // 10–45%
    { zoomMin: 0.35, zoomMax: 0.9, size: 48, dotSize: 1.5 },  // 35–90%
    { zoomMin: 0.75, zoomMax: 1.8, size: 24, dotSize: 1 },     // 75–180%
    { zoomMin: 1.5, zoomMax: 5, size: 12, dotSize: 0.6 }      // 150–500%
];

/**
 * Возвращает активные фазы и их alpha для crossfade.
 * @param {number} zoom - world.scale.x (1 = 100%)
 * @returns {Array<{ phase: object, alpha: number }>}
 */
export function getActivePhases(zoom) {
    const z = Math.max(0.02, Math.min(5, zoom));
    const result = [];
    for (let i = 0; i < PHASES.length; i++) {
        const p = PHASES[i];
        if (z < p.zoomMin || z > p.zoomMax) continue;
        const next = PHASES[i + 1];
        const prev = PHASES[i - 1];
        let alpha = 1;
        if (next && z >= next.zoomMin && p.zoomMax > next.zoomMin) {
            alpha = (p.zoomMax - z) / (p.zoomMax - next.zoomMin);
        } else if (prev && z <= prev.zoomMax && prev.zoomMax > p.zoomMin) {
            alpha = (z - p.zoomMin) / (prev.zoomMax - p.zoomMin);
        }
        if (alpha > 0.01) result.push({ phase: p, alpha });
    }
    if (result.length === 0) {
        const nearest = PHASES.reduce((a, b) =>
            Math.abs(z - (a.zoomMin + a.zoomMax) / 2) < Math.abs(z - (b.zoomMin + b.zoomMax) / 2) ? a : b);
        result.push({ phase: nearest, alpha: 1 });
    }
    return result;
}

/**
 * Эффективный size для snap (доминирующая фаза).
 * @param {number} zoom
 * @returns {number}
 */
export function getEffectiveSize(zoom) {
    const phases = getActivePhases(zoom);
    const dominant = phases.reduce((a, b) => (a.alpha >= b.alpha ? a : b));
    return dominant.phase.size;
}
