import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SCREENSHOT_DIR = process.env.MIRO_SHOTS_DIR || 'C:/Users/popov/AppData/Local/Temp/cursor/screenshots';

const STEP_TO_ZOOM = new Map([
  ['00', 100],
  ['01', 75],
  ['02', 50],
  ['03', 33],
  ['04', 20],
  ['05', 15],
  ['06', 10],
  ['07', 15],
  ['08', 20],
  ['09', 50],
  ['10', 100],
  ['11', 125],
  ['12', 150],
  ['13', 200],
  ['14', 250],
  ['15', 300],
  ['16', 400],
  ['17', 400],
  ['18', 400],
]);

function loadPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  return PNG.sync.read(buffer);
}

function extractDarknessProfiles(png) {
  const { width, height, data } = png;
  const xStart = Math.floor(width * 0.1);
  const xEnd = Math.floor(width * 0.92);
  const yStart = Math.floor(height * 0.08);
  const yEnd = Math.floor(height * 0.95);
  const roiW = xEnd - xStart;
  const roiH = yEnd - yStart;

  const xProfile = new Float64Array(roiW);
  const yProfile = new Float64Array(roiH);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const darkness = 255 - luminance;
      xProfile[x - xStart] += darkness;
      yProfile[y - yStart] += darkness;
    }
  }

  for (let i = 0; i < roiW; i++) xProfile[i] /= roiH;
  for (let i = 0; i < roiH; i++) yProfile[i] /= roiW;

  return { xProfile, yProfile };
}

function removeMean(arr) {
  let sum = 0;
  for (const v of arr) sum += v;
  const mean = sum / arr.length;
  return arr.map((v) => v - mean);
}

function dominantPeriod(profile, minPeriod = 4, maxPeriod = 240) {
  const centered = removeMean(profile);
  const upper = Math.min(maxPeriod, centered.length - 2);
  const scores = new Float64Array(upper + 1);
  let bestLag = minPeriod;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let lag = minPeriod; lag <= upper; lag++) {
    let corr = 0;
    for (let i = 0; i < centered.length - lag; i++) {
      corr += centered[i] * centered[i + lag];
    }
    scores[lag] = corr;
    if (corr > bestScore) {
      bestScore = corr;
      bestLag = lag;
    }
  }

  const peakThreshold = bestScore * 0.55;
  for (let lag = minPeriod + 1; lag < upper; lag++) {
    const isLocalPeak = scores[lag] >= scores[lag - 1] && scores[lag] >= scores[lag + 1];
    if (isLocalPeak && scores[lag] >= peakThreshold) {
      return lag;
    }
  }

  return bestLag;
}

function analyzeFile(filePath) {
  const png = loadPng(filePath);
  const { xProfile, yProfile } = extractDarknessProfiles(png);
  const spacingX = dominantPeriod(xProfile);
  const spacingY = dominantPeriod(yProfile);
  const spacing = (spacingX + spacingY) / 2;
  return { spacingX, spacingY, spacing };
}

function listMiroFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^miro-dot-step-\d{2}\.png$/i.test(f))
    .sort();
}

function getStep(name) {
  const match = name.match(/miro-dot-step-(\d{2})\.png/i);
  return match ? match[1] : null;
}

function main() {
  const files = listMiroFiles(SCREENSHOT_DIR);
  if (files.length === 0) {
    console.error(`No miro-dot-step-*.png files found in: ${SCREENSHOT_DIR}`);
    process.exit(1);
  }

  console.log('file,zoom_percent,spacing_x_px,spacing_y_px,spacing_avg_px');
  for (const name of files) {
    const step = getStep(name);
    const zoom = STEP_TO_ZOOM.get(step) ?? '';
    const abs = path.join(SCREENSHOT_DIR, name);
    const m = analyzeFile(abs);
    console.log(`${name},${zoom},${m.spacingX},${m.spacingY},${m.spacing.toFixed(2)}`);
  }
}

main();
