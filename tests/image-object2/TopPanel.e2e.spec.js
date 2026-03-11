/**
 * E2E-тесты верхней панели (Top Panel): сетки line/dot/cross/off, палитра фона.
 */
import { test, expect } from '@playwright/test';

test.describe('TopPanel E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await expect(page.locator('.moodboard-topbar')).toBeVisible();
    await expect(page.locator('.moodboard-topbar__button')).toHaveCount(5, { timeout: 10000 });
  });

  function getGridLayerChildren(page) {
    return page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      if (!core?.pixi?.gridLayer) return 0;
      return core.pixi.gridLayer.children.length;
    });
  }

  function getRendererBackgroundColor(page) {
    return page.evaluate(() => {
      const app = window.moodboard?.coreMoodboard?.pixi?.app;
      if (!app?.renderer) return null;
      const colorInt = app.renderer.background?.color ?? app.renderer.backgroundColor;
      if (typeof colorInt !== 'number') return null;
      return `#${colorInt.toString(16).padStart(6, '0')}`.toLowerCase();
    });
  }

  function getActiveGridButton(page) {
    return page.evaluate(() => {
      const btn = document.querySelector('.moodboard-topbar__button--active[data-grid]');
      return btn ? btn.dataset.grid : null;
    });
  }

  function getBoardServiceGridEnabled(page) {
    return page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      if (!core?.boardService?.grid) return null;
      return core.boardService.grid.enabled;
    });
  }

  test('grid line: click activates button and shows grid', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');

    await expect
      .poll(() => getActiveGridButton(page))
      .toBe('line');

    await expect
      .poll(() => getGridLayerChildren(page))
      .toBeGreaterThan(0);
  });

  test('grid dot: click switches to dot grid', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');
    await expect.poll(() => getGridLayerChildren(page)).toBeGreaterThan(0);

    await page.click('.moodboard-topbar__button[data-grid="dot"]');

    await expect
      .poll(() => getActiveGridButton(page))
      .toBe('dot');

    await expect
      .poll(() => getGridLayerChildren(page))
      .toBeGreaterThan(0);
  });

  test('grid cross: click switches to cross grid', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');
    await expect.poll(() => getGridLayerChildren(page)).toBeGreaterThan(0);

    await page.click('.moodboard-topbar__button[data-grid="cross"]');

    await expect
      .poll(() => getActiveGridButton(page))
      .toBe('cross');

    await expect
      .poll(() => getGridLayerChildren(page))
      .toBeGreaterThan(0);
  });

  test('grid off: click disables grid', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');
    await expect.poll(() => getGridLayerChildren(page)).toBeGreaterThan(0);

    await page.click('.moodboard-topbar__button[data-grid="off"]');

    await expect
      .poll(() => getActiveGridButton(page))
      .toBe('off');

    await expect
      .poll(() => getBoardServiceGridEnabled(page))
      .toBe(false);
  });

  test('paint: click opens popover with palette', async ({ page }) => {
    await page.click('.moodboard-topbar__button--paint');

    await expect(page.locator('.moodboard-topbar__paint-popover')).toBeVisible();
    await expect(page.locator('.moodboard-topbar__paint-btn')).toHaveCount(5);
  });

  test('paint: selecting color changes board background', async ({ page }) => {
    const beforeHex = await getRendererBackgroundColor(page);

    await page.click('.moodboard-topbar__button--paint');
    await expect(page.locator('.moodboard-topbar__paint-popover')).toBeVisible();

    const whiteBtn = page.locator('.moodboard-topbar__paint-btn[data-board="#ffffff"]');
    await expect(whiteBtn).toBeVisible();
    await whiteBtn.click();

    await expect
      .poll(() => getRendererBackgroundColor(page))
      .toBe('#ffffff');
  });
});
