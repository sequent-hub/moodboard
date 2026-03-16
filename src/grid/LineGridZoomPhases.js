import { resolveScreenGridState } from './ScreenGridPhaseMachine.js';

function clampZoom(zoom) {
    return Math.max(0.01, Math.min(5, zoom || 1));
}

const MAJOR_SCREEN_POINTS = [
    { zoomPercent: 1.4, majorPx: 17 },
    { zoomPercent: 1.6, majorPx: 20 },
    { zoomPercent: 1.8, majorPx: 22 },
    { zoomPercent: 2.0, majorPx: 25 },
    { zoomPercent: 2.2, majorPx: 27 },
    { zoomPercent: 2.4, majorPx: 31 },
    { zoomPercent: 2.6, majorPx: 35 },
    { zoomPercent: 3.0, majorPx: 39 },
    { zoomPercent: 3.4, majorPx: 44 },
    { zoomPercent: 3.6, majorPx: 49 },
    { zoomPercent: 4.0, majorPx: 55 },
    { zoomPercent: 4.6, majorPx: 60 }, // label 5 (second pass), single grid
    { zoomPercent: 5.4, majorPx: 17 }, // label 5 (first pass), double grid
    { zoomPercent: 6.0, majorPx: 20 },
    { zoomPercent: 7.0, majorPx: 22 },
    { zoomPercent: 7.6, majorPx: 24 }, // label 8 (second pass)
    { zoomPercent: 8.4, majorPx: 27 }, // label 8 (first pass)
    { zoomPercent: 10.0, majorPx: 30 },
    { zoomPercent: 11.0, majorPx: 34 },
    { zoomPercent: 12.0, majorPx: 38 },
    { zoomPercent: 13.0, majorPx: 42 },
    { zoomPercent: 15.0, majorPx: 48 },
    { zoomPercent: 17.0, majorPx: 54 },
    { zoomPercent: 19.0, majorPx: 60 }, // single grid
    { zoomPercent: 21.0, majorPx: 17 },
    { zoomPercent: 24.0, majorPx: 19 },
    { zoomPercent: 26.0, majorPx: 21 },
    { zoomPercent: 30.0, majorPx: 24 },
    { zoomPercent: 33.0, majorPx: 26 },
    { zoomPercent: 37.0, majorPx: 30 },
    { zoomPercent: 41.0, majorPx: 33 },
    { zoomPercent: 46.0, majorPx: 37 },
    { zoomPercent: 52.0, majorPx: 42 },
    { zoomPercent: 58.0, majorPx: 46 },
    { zoomPercent: 65.0, majorPx: 52 },
    { zoomPercent: 73, majorPx: 60 },
    { zoomPercent: 82, majorPx: 16 },
    { zoomPercent: 92, majorPx: 18 },
    { zoomPercent: 103, majorPx: 20 },
    { zoomPercent: 115, majorPx: 23 },
    { zoomPercent: 129, majorPx: 25 },
    { zoomPercent: 144, majorPx: 30 },
    { zoomPercent: 162, majorPx: 35 },
    { zoomPercent: 181, majorPx: 35 },
    { zoomPercent: 203, majorPx: 40 },
    { zoomPercent: 227, majorPx: 45 },
    { zoomPercent: 254, majorPx: 50 },
    { zoomPercent: 285, majorPx: 60 },
    { zoomPercent: 319, majorPx: 64 },
    { zoomPercent: 357, majorPx: 70 },
    { zoomPercent: 400, majorPx: 80 },
];

function interpolateMajorStep(zoomPercent) {
    if (zoomPercent <= MAJOR_SCREEN_POINTS[0].zoomPercent) {
        const ratio = zoomPercent / MAJOR_SCREEN_POINTS[0].zoomPercent;
        return Math.max(1, Math.round(MAJOR_SCREEN_POINTS[0].majorPx * ratio));
    }
    if (zoomPercent >= MAJOR_SCREEN_POINTS[MAJOR_SCREEN_POINTS.length - 1].zoomPercent) {
        const ratio = zoomPercent / MAJOR_SCREEN_POINTS[MAJOR_SCREEN_POINTS.length - 1].zoomPercent;
        return Math.max(1, Math.round(MAJOR_SCREEN_POINTS[MAJOR_SCREEN_POINTS.length - 1].majorPx * ratio));
    }

    for (let i = 0; i < MAJOR_SCREEN_POINTS.length - 1; i += 1) {
        const a = MAJOR_SCREEN_POINTS[i];
        const b = MAJOR_SCREEN_POINTS[i + 1];
        if (zoomPercent >= a.zoomPercent && zoomPercent <= b.zoomPercent) {
            const t = (zoomPercent - a.zoomPercent) / (b.zoomPercent - a.zoomPercent);
            const value = a.majorPx + (b.majorPx - a.majorPx) * t;
            return Math.max(1, Math.round(value));
        }
    }
    return Math.max(1, Math.round(resolveScreenGridState(zoomPercent / 100).screenStep));
}

function normalizeZoomPercent(zoomPercent) {
    return Math.round(zoomPercent * 10) / 10;
}

const EXACT_MAJOR_BY_PERCENT = new Map(
    MAJOR_SCREEN_POINTS.map((row) => [normalizeZoomPercent(row.zoomPercent), row.majorPx])
);

/**
 * Профиль line-grid под наблюдаемые checkpoint'ы из MIRO_LINE_GRID.md.
 * Возвращает major/minor screen-step и видимость подсетки.
 */
export function resolveLineGridState(zoom, options = {}) {
    const z = clampZoom(zoom);
    const base = resolveScreenGridState(z, options);
    const subDivisions = Math.max(2, Math.round(options.subGridDivisions ?? 5));
    const zoomPercent = z * 100;

    const roundedPercent = Math.round(zoomPercent);
    const normalizedPercent = normalizeZoomPercent(zoomPercent);
    let majorScreenStep = EXACT_MAJOR_BY_PERCENT.get(normalizedPercent) ?? interpolateMajorStep(zoomPercent);
    let showSubGridByZoom = true;

    // На 73% остается только одна крупная сетка (мелкая исчезает).
    if (roundedPercent === 73) {
        showSubGridByZoom = false;
    }
    if (normalizedPercent === 19.0 || normalizedPercent === 4.6) {
        showSubGridByZoom = false;
    }

    const minorScreenStep = showSubGridByZoom
        ? Math.max(1, Math.round(majorScreenStep / subDivisions))
        : null;
    const hasSuperGridByRoundedPercent =
        roundedPercent === 254 ||
        roundedPercent === 227 ||
        roundedPercent === 203 ||
        roundedPercent === 181 ||
        roundedPercent === 162 ||
        roundedPercent === 144 ||
        roundedPercent === 129 ||
        roundedPercent === 115 ||
        roundedPercent === 103 ||
        roundedPercent === 92 ||
        roundedPercent === 82 ||
        roundedPercent === 65 ||
        roundedPercent === 58 ||
        roundedPercent === 52 ||
        roundedPercent === 46 ||
        roundedPercent === 41 ||
        roundedPercent === 37;
    const hasSuperGridByExactPercent =
        normalizedPercent === 33.0 ||
        normalizedPercent === 30.0 ||
        normalizedPercent === 26.0 ||
        normalizedPercent === 24.0 ||
        normalizedPercent === 21.0 ||
        normalizedPercent === 17.0 ||
        normalizedPercent === 15.0 ||
        normalizedPercent === 13.0 ||
        normalizedPercent === 12.0 ||
        normalizedPercent === 11.0 ||
        normalizedPercent === 10.0 ||
        normalizedPercent === 8.4 ||
        normalizedPercent === 7.6 ||
        normalizedPercent === 7.0 ||
        normalizedPercent === 6.0 ||
        normalizedPercent === 5.4 ||
        normalizedPercent === 65.0 ||
        normalizedPercent === 58.0 ||
        normalizedPercent === 52.0 ||
        normalizedPercent === 46.0 ||
        normalizedPercent === 41.0 ||
        normalizedPercent === 37.0;
    const hasSuperGrid = hasSuperGridByRoundedPercent || hasSuperGridByExactPercent;
    const hasSuperGridForUltraLowZoom = normalizedPercent < 5.0 && normalizedPercent !== 4.6;
    const superMajorScreenStep = hasSuperGrid
        || hasSuperGridForUltraLowZoom
        ? Math.max(1, Math.round(majorScreenStep * 4))
        : null;

    return {
        ...base,
        screenStep: majorScreenStep,
        majorScreenStep,
        minorScreenStep,
        superMajorScreenStep,
        showSubGridByZoom,
        subDivisions,
    };
}

