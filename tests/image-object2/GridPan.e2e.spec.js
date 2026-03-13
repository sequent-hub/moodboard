/**
 * E2E-тесты поведения сетки при панорамировании и зуме.
 * Screen-grid остаётся в экранных координатах и реагирует на viewport события.
 */
import { test, expect } from '@playwright/test';

test.describe('GridPan E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  function getLayersState(page) {
    return page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      const world = core?.pixi?.worldLayer || core?.pixi?.app?.stage;
      const grid = core?.pixi?.gridLayer;
      return {
        world: world ? { x: world.x, y: world.y, scale: world.scale?.x ?? 1 } : null,
        grid: grid ? { x: grid.x, y: grid.y, scale: grid.scale?.x ?? 1 } : null,
      };
    });
  }

  function emitPanUpdate(page, delta) {
    return page.evaluate((d) => {
      const core = window.moodboard?.coreMoodboard;
      if (core?.eventBus) {
        core.eventBus.emit('tool:pan:update', { delta: d });
      }
    }, delta);
  }

  test('grid keeps screen anchor on PanUpdate', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');
    await expect.poll(() => page.evaluate(() => window.moodboard?.coreMoodboard?.pixi?.gridLayer?.children?.length || 0)).toBeGreaterThan(0);

    const before = await getLayersState(page);
    const delta = { x: 50, y: -30 };
    await emitPanUpdate(page, delta);

    const after = await getLayersState(page);
    expect(after.world.x).toBe(before.world.x + delta.x);
    expect(after.world.y).toBe(before.world.y + delta.y);
    expect(after.grid.x).toBe(0);
    expect(after.grid.y).toBe(0);
  });

  test('line grid keeps screen anchor when zooming (zoom-in button)', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');
    await expect.poll(() => page.evaluate(() => window.moodboard?.coreMoodboard?.pixi?.gridLayer?.children?.length || 0)).toBeGreaterThan(0);

    const before = await getLayersState(page);

    await page.click('.moodboard-zoombar__button[data-action="zoom-in"]');

    await expect
      .poll(() => page.evaluate(() => (window.moodboard?.coreMoodboard?.pixi?.worldLayer || window.moodboard?.coreMoodboard?.pixi?.app?.stage)?.scale?.x || 0))
      .toBeGreaterThan(before.world.scale);

    const after = await getLayersState(page);
    expect(after.grid.x).toBe(0);
    expect(after.grid.y).toBe(0);
    expect(after.grid.scale).toBe(1);
  });

  test('line grid keeps screen anchor on wheel zoom', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');
    await expect.poll(() => page.evaluate(() => window.moodboard?.coreMoodboard?.pixi?.gridLayer?.children?.length || 0)).toBeGreaterThan(0);

    const before = await getLayersState(page);

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -100);

    await expect
      .poll(() => page.evaluate(() => (window.moodboard?.coreMoodboard?.pixi?.worldLayer || window.moodboard?.coreMoodboard?.pixi?.app?.stage)?.scale?.x || 0))
      .toBeGreaterThan(before.world.scale);

    const after = await getLayersState(page);
    expect(after.grid.x).toBe(0);
    expect(after.grid.y).toBe(0);
    expect(after.grid.scale).toBe(1);
  });

  test('dot grid keeps screen anchor when zooming', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="dot"]');
    await expect.poll(() => page.evaluate(() => window.moodboard?.coreMoodboard?.pixi?.gridLayer?.children?.length || 0)).toBeGreaterThan(0);

    const before = await getLayersState(page);

    await page.click('.moodboard-zoombar__button[data-action="zoom-in"]');
    await page.click('.moodboard-zoombar__button[data-action="zoom-in"]');

    await expect
      .poll(() => page.evaluate(() => (window.moodboard?.coreMoodboard?.pixi?.worldLayer || window.moodboard?.coreMoodboard?.pixi?.app?.stage)?.scale?.x || 0))
      .toBeGreaterThan(before.world.scale);

    const after = await getLayersState(page);
    expect(after.grid.x).toBe(0);
    expect(after.grid.y).toBe(0);
    expect(after.grid.scale).toBe(1);
  });

  test('dot grid keeps screen anchor on wheel zoom (phase transition)', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="dot"]');
    await expect.poll(() => page.evaluate(() => window.moodboard?.coreMoodboard?.pixi?.gridLayer?.children?.length || 0)).toBeGreaterThan(0);

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await page.mouse.wheel(0, -100);
    await page.mouse.wheel(0, -100);

    const state = await getLayersState(page);
    expect(state.grid.scale).toBe(1);
    expect(state.grid.x).toBe(0);
    expect(state.grid.y).toBe(0);
  });

  test('grid pans with real pan tool drag', async ({ page }) => {
    await page.click('.moodboard-topbar__button[data-grid="line"]');
    await expect.poll(() => page.evaluate(() => window.moodboard?.coreMoodboard?.pixi?.gridLayer?.children?.length || 0)).toBeGreaterThan(0);

    await page.click('.moodboard-toolbar__button--pan');

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const before = await getLayersState(page);

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy - 40);
    await page.mouse.up();

    const after = await getLayersState(page);
    const expectedDx = 80;
    const expectedDy = -40;
    expect(Math.abs(after.world.x - before.world.x - expectedDx)).toBeLessThan(2);
    expect(Math.abs(after.world.y - before.world.y - expectedDy)).toBeLessThan(2);
    expect(Math.abs(after.grid.x)).toBeLessThan(0.1);
    expect(Math.abs(after.grid.y)).toBeLessThan(0.1);
  });
});
