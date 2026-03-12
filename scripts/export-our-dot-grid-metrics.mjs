import { getActivePhases, getEffectiveSize } from '../src/grid/DotGridZoomPhases.js';

const CHECKPOINTS = [10, 15, 20, 33, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500];

function fmtPhases(zoomScale) {
  const phases = getActivePhases(zoomScale);
  return phases
    .map(({ phase, alpha }) => `${phase.size}:${phase.dotSize}@${alpha.toFixed(2)}`)
    .join(' | ');
}

function toRow(percent) {
  const scale = percent / 100;
  const effectiveSize = getEffectiveSize(scale);
  const screenSpacingPx = effectiveSize * scale;
  const phases = fmtPhases(scale);
  return {
    percent,
    scale: scale.toFixed(2),
    effectiveSize,
    screenSpacingPx: screenSpacingPx.toFixed(2),
    phases,
  };
}

function main() {
  console.log('zoom_percent,scale,effective_size_world,screen_spacing_px,active_phases');
  for (const percent of CHECKPOINTS) {
    const row = toRow(percent);
    console.log(
      `${row.percent},${row.scale},${row.effectiveSize},${row.screenSpacingPx},"${row.phases}"`
    );
  }
}

main();
