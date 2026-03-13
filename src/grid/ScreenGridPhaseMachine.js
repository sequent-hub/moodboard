/**
 * Общая state machine для screen-grid.
 * Возвращает world-step активной фазы и screen-step (px) для текущего zoom.
 */

/** @type {{ zoomMin: number, zoomMax: number, worldStep: number }[]} */
const DEFAULT_PHASES = [
    { zoomMin: 0.02, zoomMax: 0.12, worldStep: 160 },
    { zoomMin: 0.12, zoomMax: 0.25, worldStep: 80 },
    { zoomMin: 0.25, zoomMax: 0.5, worldStep: 40 },
    { zoomMin: 0.5, zoomMax: 5, worldStep: 20 },
];

function clampZoom(zoom) {
    return Math.max(0.02, Math.min(5, zoom || 1));
}

function pickPhase(zoom, phases = DEFAULT_PHASES) {
    const z = clampZoom(zoom);
    for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const inRange = i === phases.length - 1
            ? (z >= phase.zoomMin && z <= phase.zoomMax)
            : (z >= phase.zoomMin && z < phase.zoomMax);
        if (inRange) return phase;
    }
    return phases[phases.length - 1];
}

export function resolveScreenGridState(zoom, options = {}) {
    const z = clampZoom(zoom);
    const phases = options.phases || DEFAULT_PHASES;
    const minScreenSpacing = options.minScreenSpacing ?? 8;
    const phase = pickPhase(z, phases);
    const worldStep = phase.worldStep;
    const screenStep = Math.max(minScreenSpacing, worldStep * z);
    return { zoom: z, phase, worldStep, screenStep };
}

export function getScreenAnchor(worldOffset, stepPx) {
    const step = Math.max(1e-6, stepPx || 1);
    const mod = worldOffset % step;
    return mod < 0 ? mod + step : mod;
}

export function snapScreenValue(valuePx, anchorPx, stepPx) {
    const step = Math.max(1e-6, stepPx || 1);
    return Math.round((valuePx - anchorPx) / step) * step + anchorPx;
}

export { DEFAULT_PHASES };
