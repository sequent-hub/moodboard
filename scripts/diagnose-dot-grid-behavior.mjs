import { getActivePhases, getScreenSpacing } from '../src/grid/DotGridZoomPhases.js';

const CHECKPOINTS = [500, 400, 300, 250, 200, 150, 125, 100, 75, 50, 33, 25, 20, 15, 10, 5, 2];

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
        alpha: CONFIG.baseOpacity,
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

const rows = CHECKPOINTS.map(buildRow);
printMarkdown(rows);
