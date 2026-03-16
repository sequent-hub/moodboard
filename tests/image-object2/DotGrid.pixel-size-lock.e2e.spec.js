import { test, expect } from '@playwright/test';

test.describe('DotGrid checkpoint runtime', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await expect(page.locator('.moodboard-zoombar')).toBeVisible();
    await page.click('.moodboard-topbar__button[data-grid="dot"]');
  });

  async function zoomToLabel(page, targetLabel) {
    const zoomIn = page.locator('.moodboard-zoombar__button[data-action="zoom-in"]');
    const zoomOut = page.locator('.moodboard-zoombar__button[data-action="zoom-out"]');
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();

    for (let i = 0; i < 40; i += 1) {
      const current = await page.evaluate(() => {
        const el = document.querySelector('.moodboard-zoombar__label-value');
        return el ? el.textContent.trim() : '';
      });
      if (current === targetLabel) return;
      const currentValue = Number.parseInt(current, 10);
      const targetValue = Number.parseInt(targetLabel, 10);
      if (Number.isFinite(currentValue) && Number.isFinite(targetValue) && currentValue < targetValue) {
        await zoomIn.click();
      } else {
        await zoomOut.click();
      }
    }
    throw new Error(`Failed to reach zoom ${targetLabel}`);
  }

  async function collectDotMetrics(page) {
    return page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      const grid = core?.boardService?.grid;
      if (!grid || grid.type !== 'dot') return { ok: false, reason: 'dot_grid_not_active' };

      const canvas = document.querySelector('.moodboard-workspace__canvas canvas');
      if (!canvas) return { ok: false, reason: 'canvas_not_found' };

      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return { ok: false, reason: 'canvas_empty' };

      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const ctx = temp.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { ok: false, reason: '2d_context_unavailable' };

      ctx.drawImage(canvas, 0, 0);
      const image = ctx.getImageData(0, 0, w, h).data;

      const z = Math.max(0.02, Math.min(5, grid._zoom || 1));
      const stepPx = z >= 1
        ? Math.max(1, Math.round((grid.size || 20) * z))
        : 20; // fallback: this test targets >=100% only

      const b = grid.getDrawBounds ? grid.getDrawBounds() : { left: 0, top: 0, right: w, bottom: h };
      const worldX = grid.viewportTransform?.worldX || 0;
      const worldY = grid.viewportTransform?.worldY || 0;
      const anchorX = grid._resolveScreenAnchor('x', worldX, stepPx, null, false);
      const anchorY = grid._resolveScreenAnchor('y', worldY, stepPx, null, false);
      const alignStart = (min, anchor, step) => {
        const minInt = Math.round(min);
        const d = ((anchor - minInt) % step + step) % step;
        return minInt + d;
      };
      const startX = alignStart(b.left, anchorX, stepPx);
      const startY = alignStart(b.top, anchorY, stepPx);

      // Берем узлы сетки вокруг центра экрана и меряем "пятно" точки в локальном окне.
      const centerX = Math.round((b.left + b.right) / 2);
      const centerY = Math.round((b.top + b.bottom) / 2);
      const nearestGrid = (center, start, step) => start + Math.round((center - start) / step) * step;
      const gx = nearestGrid(centerX, startX, stepPx);
      const gy = nearestGrid(centerY, startY, stepPx);

      const points = [];
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          points.push({ x: gx + ox * stepPx, y: gy + oy * stepPx });
        }
      }

      const footprints = [];
      for (const p of points) {
        const x0 = Math.max(0, Math.round(p.x - 4));
        const y0 = Math.max(0, Math.round(p.y - 4));
        const x1 = Math.min(w - 1, Math.round(p.x + 4));
        const y1 = Math.min(h - 1, Math.round(p.y + 4));

        let ink = 0;
        let minX = x1;
        let minY = y1;
        let maxX = x0;
        let maxY = y0;
        for (let y = y0; y <= y1; y += 1) {
          for (let x = x0; x <= x1; x += 1) {
            const idx = (y * w + x) * 4;
            const r = image[idx];
            const g = image[idx + 1];
            const bch = image[idx + 2];
            const isInk = (r < 245 || g < 245 || bch < 245);
            if (!isInk) continue;
            ink += 1;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
        if (ink > 0) {
          footprints.push({
            ink,
            bw: maxX - minX + 1,
            bh: maxY - minY + 1,
          });
        }
      }

      const median = (arr) => {
        if (!arr.length) return null;
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      };

      const widths = footprints.map((f) => f.bw);
      const heights = footprints.map((f) => f.bh);
      const inks = footprints.map((f) => f.ink);

      return {
        ok: true,
        stepPx,
        samples: footprints.length,
        centerGridX: gx,
        centerGridY: gy,
        inkMedian: median(inks),
        widthMedian: median(widths),
        heightMedian: median(heights),
      };
    });
  }

  test('keeps expected checkpoint step from 181% to 400%', async ({ page }) => {
    await zoomToLabel(page, '181%');
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.querySelector('.moodboard-zoombar__label-value');
        return el ? el.textContent.trim() : '';
      }))
      .toBe('181%');
    const m181 = await collectDotMetrics(page);
    expect(m181.ok).toBe(true);
    expect(m181.samples).toBeGreaterThan(0);
    expect(m181.inkMedian).toBeGreaterThan(0);
    expect(m181.stepPx).toBe(36);

    await zoomToLabel(page, '400%');
    await expect
      .poll(() => page.evaluate(() => {
        const el = document.querySelector('.moodboard-zoombar__label-value');
        return el ? el.textContent.trim() : '';
      }))
      .toBe('400%');
    const m400 = await collectDotMetrics(page);
    expect(m400.ok).toBe(true);
    expect(m400.samples).toBeGreaterThan(0);
    expect(m400.inkMedian).toBeGreaterThan(0);
    expect(m400.stepPx).toBe(80);

    expect(m181.widthMedian).not.toBeNull();
    expect(m181.heightMedian).not.toBeNull();
    expect(m181.inkMedian).toBeGreaterThan(0);
    expect(m400.widthMedian).not.toBeNull();
    expect(m400.heightMedian).not.toBeNull();
    expect(m400.inkMedian).toBeGreaterThan(0);
  });
});
