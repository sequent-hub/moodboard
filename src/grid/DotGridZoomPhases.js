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
 * Дискретный профиль dot-grid по zoom checkpoint'ам:
 * на каждом шаге фиксированы spacing / dotRadius / color.
 */
export const DOT_CHECKPOINTS = [
    { zoomPercent: 10, spacing: 16, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 11, spacing: 16, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 12, spacing: 18, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 13, spacing: 10, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 15, spacing: 12, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 17, spacing: 14, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 19, spacing: 16, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 20, spacing: 16, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 21, spacing: 18, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 24, spacing: 20, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 26, spacing: 16, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 30, spacing: 12, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 33, spacing: 13, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 37, spacing: 16, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 41, spacing: 18, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 46, spacing: 20, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 50, spacing: 10, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 52, spacing: 11, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 58, spacing: 12, dotRadius: 1, color: 0xE8E8E8 },
    { zoomPercent: 1.4, spacing: 16, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 1.6, spacing: 18, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 1.8, spacing: 8, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 2.0, spacing: 10, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 2.2, spacing: 12, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 2.4, spacing: 14, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 2.6, spacing: 16, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 3.0, spacing: 18, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 3.4, spacing: 8, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 3.6, spacing: 10, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 4.0, spacing: 12, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 4.6, spacing: 14, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 5.4, spacing: 16, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 6.0, spacing: 18, dotRadius: 0.5, color: 0xA3A3A3 },
    { zoomPercent: 7.0, spacing: 8, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 7.6, spacing: 10, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 8.4, spacing: 12, dotRadius: 1, color: 0xA3A3A3 },
    { zoomPercent: 73, spacing: 15, dotRadius: 1, color: 0xE8E8E8 },
    { zoomPercent: 75, spacing: 15, dotRadius: 1, color: 0xE8E8E8 },
    { zoomPercent: 82, spacing: 16, dotRadius: 1, color: 0xE8E8E8 },
    { zoomPercent: 92, spacing: 18, dotRadius: 1.2, color: 0xE8E8E8 },
    { zoomPercent: 100, spacing: 20, dotRadius: 1, color: 0xE8E8E8 },
    { zoomPercent: 103, spacing: 21, dotRadius: 1.3, color: 0xE8E8E8 },
    { zoomPercent: 115, spacing: 23, dotRadius: 1.4, color: 0xE8E8E8 },
    { zoomPercent: 125, spacing: 25, dotRadius: 1, color: 0xE8E8E8 },
    { zoomPercent: 129, spacing: 26, dotRadius: 1.5, color: 0xE3E3E3 },
    { zoomPercent: 144, spacing: 29, dotRadius: 1.7, color: 0xE7E7E7 },
    { zoomPercent: 150, spacing: 30, dotRadius: 2, color: 0xE8E8E8 },
    { zoomPercent: 162, spacing: 32, dotRadius: 1.5, color: 0xE5E5E5 },
    { zoomPercent: 181, spacing: 36, dotRadius: 2, color: 0xE2E2E2 },
    { zoomPercent: 200, spacing: 40, dotRadius: 2, color: 0xE8E8E8 },
    { zoomPercent: 250, spacing: 50, dotRadius: 2, color: 0xE8E8E8 },
    { zoomPercent: 300, spacing: 60, dotRadius: 3, color: 0xE8E8E8 },
    { zoomPercent: 400, spacing: 80, dotRadius: 4, color: 0xE8E8E8 },
    { zoomPercent: 500, spacing: 100, dotRadius: 5, color: 0xE8E8E8 },
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

function resolveDotCheckpoint(zoom) {
    const z = clampZoom(zoom);
    const p = z * 100;
    let best = DOT_CHECKPOINTS[0];
    let bestDist = Math.abs(best.zoomPercent - p);
    for (let i = 1; i < DOT_CHECKPOINTS.length; i += 1) {
        const row = DOT_CHECKPOINTS[i];
        const dist = Math.abs(row.zoomPercent - p);
        if (dist < bestDist) {
            best = row;
            bestDist = dist;
        }
    }
    return best;
}

function sanitizeColor(color, fallback = 0xE8E8E8) {
    const n = Number(color);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(0xFFFFFF, Math.round(n)));
}

function sanitizeSpacing(spacing, fallback = 20) {
    const n = Number(spacing);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.round(n));
}

function sanitizeDotRadius(radius, fallback = 1) {
    const n = Number(radius);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, n);
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
 * Возвращает текущий checkpoint (копию) для zoom.
 * @param {number} zoom
 * @returns {{ zoomPercent:number, spacing:number, dotRadius:number, color:number }}
 */
export function getDotCheckpointForZoom(zoom) {
    const row = resolveDotCheckpoint(zoom);
    return {
        zoomPercent: row.zoomPercent,
        spacing: row.spacing,
        dotRadius: row.dotRadius,
        color: row.color,
    };
}

/**
 * Обновляет checkpoint для заданного zoomPercent.
 * Используется debug-панелью для live-настройки.
 * @param {number} zoomPercent
 * @param {{ spacing?: number, dotRadius?: number, color?: number }} patch
 * @returns {{ zoomPercent:number, spacing:number, dotRadius:number, color:number } | null}
 */
export function updateDotCheckpoint(zoomPercent, patch = {}) {
    const target = Number(zoomPercent);
    if (!Number.isFinite(target)) return null;
    const row = DOT_CHECKPOINTS.find((r) => Math.abs(r.zoomPercent - target) < 1e-6);
    if (!row) return null;
    if (Object.prototype.hasOwnProperty.call(patch, 'spacing')) {
        row.spacing = sanitizeSpacing(patch.spacing, row.spacing);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'dotRadius')) {
        row.dotRadius = sanitizeDotRadius(patch.dotRadius, row.dotRadius);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'color')) {
        row.color = sanitizeColor(patch.color, row.color);
    }
    return {
        zoomPercent: row.zoomPercent,
        spacing: row.spacing,
        dotRadius: row.dotRadius,
        color: row.color,
    };
}

/**
 * Возвращает screen-spacing в px для текущего zoom.
 * @param {number} zoom
 * @param {number} minScreenSpacing
 * @returns {number}
 */
export function getScreenSpacing(zoom) {
    return resolveDotCheckpoint(zoom).spacing;
}

/**
 * Возвращает integer-радиус точки в screen-space для текущего zoom.
 * @param {number} zoom
 * @param {number} minScreenDotRadius
 * @returns {number}
 */
export function getScreenDotRadius(zoom, minScreenDotRadius = 1) {
    const stepRadius = resolveDotCheckpoint(zoom).dotRadius;
    return Math.max(0, Math.round(stepRadius));
}

/**
 * Возвращает raw-радиус без округления (для debug-просмотра).
 * @param {number} zoom
 * @param {number} minScreenDotRadius
 * @returns {number}
 */
export function getRawScreenDotRadius(zoom, minScreenDotRadius = 0.1) {
    const stepRadius = resolveDotCheckpoint(zoom).dotRadius;
    return Math.max(0, Number(stepRadius) || 0);
}

/**
 * Возвращает цвет точки для текущего zoom-checkpoint.
 * @param {number} zoom
 * @param {number} fallbackColor
 * @returns {number}
 */
export function getDotColor(zoom, fallbackColor = 0xE8E8E8) {
    const color = resolveDotCheckpoint(zoom).color;
    return Number.isFinite(color) ? color : fallbackColor;
}

/**
 * Точечная сетка всегда рендерится без прозрачности.
 * @param {number} zoom
 * @returns {number}
 */
export function getDotOpacity(zoom) {
    void zoom;
    return 1;
}
