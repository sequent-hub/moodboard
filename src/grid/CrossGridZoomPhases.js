/**
 * Дискретный профиль cross-grid по zoom checkpoint'ам.
 * Возвращает фиксированные screen-space параметры:
 * - spacing: расстояние между крестами в px
 * - crossHalfSize: половина длины креста в px
 */

function clampZoom(zoom) {
    return Math.max(0.01, Math.min(5, zoom || 1));
}

/**
 * В таблице используются zoom в процентах (1 = 100%).
 * Для дублей лейблов (8, 5, 4, 3, 2) используются существующие
 * "двойные проходы" из low-zoom checkpoint'ов проекта.
 */
export const CROSS_CHECKPOINTS = [
    { zoomPercent: 400, crossHalfSize: 8, spacing: 100 },
    { zoomPercent: 103, crossHalfSize: 4, spacing: 50 },
    { zoomPercent: 82, crossHalfSize: 4, spacing: 48 },
    { zoomPercent: 73, crossHalfSize: 4, spacing: 46 },
    { zoomPercent: 65, crossHalfSize: 4, spacing: 42 },
    { zoomPercent: 58, crossHalfSize: 4, spacing: 40 },
    { zoomPercent: 52, crossHalfSize: 4, spacing: 38 },
    { zoomPercent: 46, crossHalfSize: 4, spacing: 36 },
    { zoomPercent: 41, crossHalfSize: 4, spacing: 34 },
    { zoomPercent: 37, crossHalfSize: 4, spacing: 32 },
    { zoomPercent: 33, crossHalfSize: 4, spacing: 30 },
    { zoomPercent: 30, crossHalfSize: 4, spacing: 28 },
    { zoomPercent: 26, crossHalfSize: 3, spacing: 26 },
    { zoomPercent: 24, crossHalfSize: 3, spacing: 24 },
    { zoomPercent: 21, crossHalfSize: 3, spacing: 22 },
    { zoomPercent: 19, crossHalfSize: 3, spacing: 20 },
    { zoomPercent: 17, crossHalfSize: 3, spacing: 18 },
    { zoomPercent: 15, crossHalfSize: 3, spacing: 16 },
    { zoomPercent: 13, crossHalfSize: 2, spacing: 14 },
    { zoomPercent: 12, crossHalfSize: 2, spacing: 12 },
    { zoomPercent: 11, crossHalfSize: 3, spacing: 28 },
    { zoomPercent: 10, crossHalfSize: 3, spacing: 26 },
    { zoomPercent: 8.4, crossHalfSize: 3, spacing: 24 },
    { zoomPercent: 7.6, crossHalfSize: 3, spacing: 22 },
    { zoomPercent: 7.0, crossHalfSize: 3, spacing: 20 },
    { zoomPercent: 6.0, crossHalfSize: 3, spacing: 18 },
    { zoomPercent: 5.4, crossHalfSize: 3, spacing: 16 },
    { zoomPercent: 4.6, crossHalfSize: 2, spacing: 14 },
    { zoomPercent: 4.0, crossHalfSize: 2, spacing: 12 },
    { zoomPercent: 3.6, crossHalfSize: 3, spacing: 28 },
    { zoomPercent: 3.4, crossHalfSize: 3, spacing: 26 },
    { zoomPercent: 3.0, crossHalfSize: 3, spacing: 24 },
    { zoomPercent: 2.6, crossHalfSize: 3, spacing: 22 },
    { zoomPercent: 2.4, crossHalfSize: 3, spacing: 20 },
    { zoomPercent: 2.2, crossHalfSize: 3, spacing: 18 },
    { zoomPercent: 2.0, crossHalfSize: 3, spacing: 16 },
    { zoomPercent: 1.8, crossHalfSize: 2, spacing: 14 },
    { zoomPercent: 1.6, crossHalfSize: 2, spacing: 12 },
    { zoomPercent: 1.4, crossHalfSize: 2, spacing: 10 },
];

function sanitizeInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.round(n));
}

function resolveCrossCheckpoint(zoom) {
    const z = clampZoom(zoom);
    const p = z * 100;
    let best = CROSS_CHECKPOINTS[0];
    let bestDist = Math.abs(best.zoomPercent - p);
    for (let i = 1; i < CROSS_CHECKPOINTS.length; i += 1) {
        const row = CROSS_CHECKPOINTS[i];
        const dist = Math.abs(row.zoomPercent - p);
        if (dist < bestDist) {
            best = row;
            bestDist = dist;
        }
    }
    return best;
}

export function getCrossCheckpointForZoom(zoom) {
    const row = resolveCrossCheckpoint(zoom);
    return {
        zoomPercent: row.zoomPercent,
        crossHalfSize: sanitizeInt(row.crossHalfSize, 4),
        spacing: sanitizeInt(row.spacing, 20),
    };
}

export function getCrossScreenSpacing(zoom) {
    return getCrossCheckpointForZoom(zoom).spacing;
}

export function getCrossHalfSize(zoom) {
    return getCrossCheckpointForZoom(zoom).crossHalfSize;
}

export function updateCrossCheckpoint(zoomPercent, patch = {}) {
    const target = Number(zoomPercent);
    if (!Number.isFinite(target)) return null;
    const row = CROSS_CHECKPOINTS.find((r) => Math.abs(r.zoomPercent - target) < 1e-6);
    if (!row) return null;
    if (Object.prototype.hasOwnProperty.call(patch, 'crossHalfSize')) {
        row.crossHalfSize = sanitizeInt(patch.crossHalfSize, row.crossHalfSize);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'spacing')) {
        row.spacing = sanitizeInt(patch.spacing, row.spacing);
    }
    return {
        zoomPercent: row.zoomPercent,
        crossHalfSize: sanitizeInt(row.crossHalfSize, 4),
        spacing: sanitizeInt(row.spacing, 20),
    };
}
