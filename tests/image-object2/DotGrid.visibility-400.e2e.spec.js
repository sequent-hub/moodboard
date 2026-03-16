import { test, expect } from '@playwright/test';

test.describe('DotGrid visibility at 400%', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await expect(page.locator('.moodboard-zoombar')).toBeVisible();
  });

  async function zoomTo400(page) {
    const zoomIn = page.locator('.moodboard-zoombar__button[data-action="zoom-in"]');
    await expect(zoomIn).toBeVisible();
    for (let i = 0; i < 24; i += 1) {
      const label = await page.evaluate(() => {
        const el = document.querySelector('.moodboard-zoombar__label-value');
        return el ? el.textContent.trim() : '';
      });
      if (label === '400%') return;
      await zoomIn.click();
    }
    throw new Error('Failed to reach 400% zoom using zoom-in button');
  }

  test('dot grid produces visible non-white pixels on canvas', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="dot"]');
    await zoomTo400(page);

    await expect
      .poll(() => page.evaluate(() => {
        const core = window.moodboard?.coreMoodboard;
        const world = core?.pixi?.worldLayer || core?.pixi?.app?.stage;
        return Math.round((world?.scale?.x || 0) * 100);
      }))
      .toBe(400);

    const metrics = await page.evaluate(() => {
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

      // Анализируем центральную область, чтобы исключить UI-накладки у краёв.
      const x0 = Math.floor(w * 0.15);
      const y0 = Math.floor(h * 0.15);
      const x1 = Math.floor(w * 0.85);
      const y1 = Math.floor(h * 0.85);

      let nonWhite = 0;
      let total = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const idx = (y * w + x) * 4;
          const r = image[idx];
          const g = image[idx + 1];
          const b = image[idx + 2];
          total += 1;
          if (!(r >= 250 && g >= 250 && b >= 250)) {
            nonWhite += 1;
          }
        }
      }

      return { ok: true, nonWhite, total };
    });

    expect(metrics.ok).toBe(true);
    expect(metrics.nonWhite).toBeGreaterThan(0);
  });
});
