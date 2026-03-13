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
    // >= 100% оставляем текущий профиль без изменений.
    if (z >= 1) {
        const step = resolveDotPhase(z).size * z;
        return Math.max(1, Math.round(step));
    }

    // Ниже 100% используем явный integer-профиль для zoom-checkpoints.
    // Нижняя граница зафиксирована по запросу: 2% = 11.
    if (z >= 0.75) return 19;
    if (z >= 0.5) return 18;
    if (z >= 0.33) return 17;
    if (z >= 0.25) return 16;
    if (z >= 0.2) return 15;
    if (z >= 0.15) return 14;
    if (z >= 0.1) return 13;
    if (z >= 0.05) return 12;
    return 11;
}

/**
 * Возвращает прозрачность точек в зависимости от zoom:
 * 2% -> 0.5, 100% -> 1.0.
 * Для 100%+ используются контрольные точки:
 * 125%=0.80, 200%=0.70, 300%=0.60, 400%=0.50, 500%=0.40
 * с линейной интерполяцией между соседними точками.
 * @param {number} zoom
 * @returns {number}
 */
export function getDotOpacity(zoom) {
    const z = clampZoom(zoom);
    const minOpacity = 0.5;
    const maxOpacity = 1;

    if (z === 1) return maxOpacity;

    if (z < 1) {
        const zMin = 0.02;
        const zMax = 1;
        const t = (z - zMin) / (zMax - zMin);
        const value = minOpacity + (maxOpacity - minOpacity) * t;
        return Math.max(minOpacity, Math.min(maxOpacity, value));
    }

    const points = [
        { z: 1.0, alpha: 1.0 },
        { z: 1.25, alpha: 0.9 },
        { z: 1.5, alpha: 0.7 },
        { z: 2.0, alpha: 0.6 },
        { z: 2.5, alpha: 0.5 },
        { z: 3.0, alpha: 0.4 },
        { z: 4.0, alpha: 0.35 },
        { z: 5.0, alpha: 0.3 },
    ];
    for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        if (z >= a.z && z <= b.z) {
            const t = (z - a.z) / (b.z - a.z);
            return a.alpha + (b.alpha - a.alpha) * t;
        }
    }
    return points[points.length - 1].alpha;
}
