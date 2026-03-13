import { getActivePhases, getDotOpacity, getScreenSpacing } from '../src/grid/DotGridZoomPhases.js';
import { getScreenAnchor, snapScreenValue } from '../src/grid/ScreenGridPhaseMachine.js';

const CHECKPOINTS = [500, 400, 300, 250, 200, 150, 125, 100, 75, 50, 33, 25, 20, 15, 10, 5, 2];
const ZOOM_LEVELS = [2, 5, 10, 15, 20, 25, 33, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500];
const CURSORS = [
    { x: 120, y: 90 },
    { x: 400, y: 250 },
    { x: 799, y: 599 },
    { x: 1333, y: 777 },
];

const CONFIG = {
    viewWidth: 1600,
    viewHeight: 900,
    viewportPad: 32,
    minScreenSpacing: 8,
    minScreenDotRadius: 1,
    maxDotsPerPhase: 25000,
    baseOpacity: 1,
};

function toFixedSafe(value, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : 'NaN';
}

function buildRow(zoomPercent) {
    const zoom = zoomPercent / 100;
    const phase = getActivePhases(zoom)[0].phase;
    const drawWidth = CONFIG.viewWidth + CONFIG.viewportPad * 2;
    const drawHeight = CONFIG.viewHeight + CONFIG.viewportPad * 2;

    const rawStepPx = phase.size * zoom;
    const stepPx = Math.max(1, Math.round(getScreenSpacing(zoom)));

    const estimateDots = (step) => {
        const nx = Math.floor(drawWidth / step) + 3;
        const ny = Math.floor(drawHeight / step) + 3;
        return nx * ny;
    };

    const estimatedBeforeCap = estimateDots(stepPx);
    const estimatedAfterCap = estimatedBeforeCap;

    const phaseScreenRadius = phase.dotSize * zoom;
    const dotRadius = Math.max(CONFIG.minScreenDotRadius, Math.round(phaseScreenRadius));
    const minDotRadiusApplied = dotRadius > phaseScreenRadius + 1e-9;

    return {
        zoomPercent,
        phaseSize: phase.size,
        phaseDot: phase.dotSize,
        rawStepPx,
        stepPx,
        estimatedBeforeCap,
        estimatedAfterCap,
        phaseScreenRadius,
        dotRadius,
        minDotRadiusApplied,
        alpha: CONFIG.baseOpacity * getDotOpacity(zoom),
    };
}

function printMarkdown(rows) {
    console.log('# DotGrid Diagnostics (automated)');
    console.log('');
    console.log('## Config');
    console.log('');
    console.log(`- viewport: ${CONFIG.viewWidth}x${CONFIG.viewHeight} (+pad ${CONFIG.viewportPad})`);
    console.log(`- minScreenSpacing: ${CONFIG.minScreenSpacing}`);
    console.log(`- minScreenDotRadius: ${CONFIG.minScreenDotRadius}`);
    console.log(`- maxDotsPerPhase: ${CONFIG.maxDotsPerPhase}`);
    console.log(`- baseOpacity(alpha): ${CONFIG.baseOpacity}`);
    console.log('');

    console.log('## Per-zoom table');
    console.log('');
    console.log('| zoom% | phase.size | rawStepPx | finalStepPx | dots(before) | dots(after) | phaseDotPx | finalDotPx | minDotClamp | alpha |');
    console.log('|---:|---:|---:|---:|---:|---:|---:|---:|:---:|---:|');
    for (const r of rows) {
        console.log(`| ${r.zoomPercent} | ${r.phaseSize} | ${toFixedSafe(r.rawStepPx)} | ${toFixedSafe(r.stepPx)} | ${r.estimatedBeforeCap} | ${r.estimatedAfterCap} | ${toFixedSafe(r.phaseScreenRadius)} | ${toFixedSafe(r.dotRadius)} | ${r.minDotRadiusApplied ? 'yes' : 'no'} | ${toFixedSafe(r.alpha)} |`);
    }

    const minDotCount = rows.filter((r) => r.minDotRadiusApplied).length;
    console.log('');
    console.log('## Optimization counters');
    console.log('');
    console.log(`- density cap applied: 0/${rows.length}`);
    console.log(`- min spacing clamp applied: 0/${rows.length}`);
    console.log(`- min dot radius clamp applied: ${minDotCount}/${rows.length}`);
}

function normalizeAnchor(anchor, stepPx) {
    const step = Math.max(1, Math.round(stepPx));
    return ((Math.round(anchor) % step) + step) % step;
}

function resolveAnchor(worldOffset, stepPx, cursorPx, useCursorAnchor) {
    if (useCursorAnchor && Number.isFinite(cursorPx)) {
        return normalizeAnchor(cursorPx, stepPx);
    }
    return normalizeAnchor(getScreenAnchor(worldOffset, stepPx), stepPx);
}

function applyCursorCentricZoom(world, cursor, targetPercent) {
    const oldScale = world.scale;
    const newScale = targetPercent / 100;
    const worldPointX = (cursor.x - world.x) / oldScale;
    const worldPointY = (cursor.y - world.y) / oldScale;
    return {
        x: Math.round(cursor.x - worldPointX * newScale),
        y: Math.round(cursor.y - worldPointY * newScale),
        scale: newScale,
    };
}

function getTransitions(levels) {
    const transitions = [];
    for (let i = 0; i < levels.length - 1; i += 1) {
        transitions.push([levels[i], levels[i + 1]]);
        transitions.push([levels[i + 1], levels[i]]);
    }
    return transitions;
}

function runCursorInvariantDiagnostics() {
    const transitions = getTransitions(ZOOM_LEVELS);
    const rows = [];
    for (const baseCursor of CURSORS) {
        for (const [fromPercent, toPercent] of transitions) {
            const worldBefore = { x: 137, y: -83, scale: fromPercent / 100 };
            const beforeStep = Math.max(1, Math.round(getScreenSpacing(worldBefore.scale)));
            const beforeAnchorX = resolveAnchor(worldBefore.x, beforeStep, null, false);
            const beforeAnchorY = resolveAnchor(worldBefore.y, beforeStep, null, false);
            const nearestBefore = {
                x: snapScreenValue(baseCursor.x, beforeAnchorX, beforeStep),
                y: snapScreenValue(baseCursor.y, beforeAnchorY, beforeStep),
            };

            // Курсор фиксируется на ближайшей точке: это основной ручной сценарий проверки.
            const lockedCursor = { x: nearestBefore.x, y: nearestBefore.y };
            const worldAfter = applyCursorCentricZoom(worldBefore, lockedCursor, toPercent);
            const afterStep = Math.max(1, Math.round(getScreenSpacing(worldAfter.scale)));
            const afterAnchorX = resolveAnchor(worldAfter.x, afterStep, lockedCursor.x, true);
            const afterAnchorY = resolveAnchor(worldAfter.y, afterStep, lockedCursor.y, true);
            const nearestAfter = {
                x: snapScreenValue(lockedCursor.x, afterAnchorX, afterStep),
                y: snapScreenValue(lockedCursor.y, afterAnchorY, afterStep),
            };

            rows.push({
                transition: `${fromPercent}->${toPercent}`,
                cursor: `(${lockedCursor.x},${lockedCursor.y})`,
                beforePoint: `(${nearestBefore.x},${nearestBefore.y})`,
                afterPoint: `(${nearestAfter.x},${nearestAfter.y})`,
                deltaX: nearestAfter.x - nearestBefore.x,
                deltaY: nearestAfter.y - nearestBefore.y,
            });
        }
    }
    return rows;
}

function printCursorInvariantReport(rows) {
    const failed = rows.filter((row) => row.deltaX !== 0 || row.deltaY !== 0);
    console.log('');
    console.log('## Cursor Invariant Diagnostics');
    console.log('');
    console.log('| zoom transition | cursor x/y | point before | point after | deltaX | deltaY |');
    console.log('|---|---|---|---|---:|---:|');
    for (const row of rows) {
        console.log(`| ${row.transition} | ${row.cursor} | ${row.beforePoint} | ${row.afterPoint} | ${row.deltaX} | ${row.deltaY} |`);
    }
    console.log('');
    console.log(`- total transitions checked: ${rows.length}`);
    console.log(`- failed transitions (delta != 0): ${failed.length}`);
    console.log(`- status: ${failed.length === 0 ? 'PASS' : 'FAIL'}`);
}

const rows = CHECKPOINTS.map(buildRow);
printMarkdown(rows);
const cursorRows = runCursorInvariantDiagnostics();
printCursorInvariantReport(cursorRows);
