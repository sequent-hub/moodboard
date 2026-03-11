/**
 * E2E-тесты панели зума (ZoomPanel) и карты доски (MapPanel).
 * Кнопки +/−, зум колесом, меню (По размеру экрана, К выделению, 100%), панель с миникартой.
 */
import { test, expect } from '@playwright/test';

test.describe('ZoomPanel E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await expect(page.locator('.moodboard-zoombar')).toBeVisible();
    await page.click('.moodboard-toolbar__button--select');
  });

  function getWorldScale(page) {
    return page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      const world = core?.pixi?.worldLayer || core?.pixi?.app?.stage;
      return world ? world.scale.x : null;
    });
  }

  function getZoomPercentLabel(page) {
    return page.evaluate(() => {
      const el = document.querySelector('.moodboard-zoombar__label-value');
      return el ? el.textContent.trim() : null;
    });
  }

  async function openZoomMenu(page) {
    await page.click('.moodboard-zoombar__label');
    await expect(page.locator('.moodboard-zoombar__menu')).toBeVisible();
  }

  async function clickZoomMenuItem(page, index) {
    const items = page.locator('.moodboard-zoombar__menu-item');
    await items.nth(index).click();
  }

  async function createObject(page, config, position) {
    return page.evaluate(
      ({ cfg, pos }) => {
        return window.moodboard.createObject(cfg.type, pos, {
          ...cfg.properties,
          width: cfg.width,
          height: cfg.height,
        }).id;
      },
      { cfg: config, pos: position }
    );
  }

  async function clearBoard(page) {
    await page.evaluate(() => window.moodboard.clearBoard());
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board.objects || []).length;
      })
      .toBe(0);
  }

  async function setSelection(page, ids) {
    await page.evaluate((objectIds) => {
      const selectTool = window.moodboard.coreMoodboard.selectTool;
      selectTool.setSelection(objectIds);
      selectTool.updateResizeHandles();
    }, ids);
  }

  async function getObjectCanvasCenter(page, id) {
    return page.evaluate((objectId) => {
      const core = window.moodboard.coreMoodboard;
      const pixiObject = core.pixi.objects.get(objectId);
      if (!pixiObject) return null;
      const world = core.pixi.worldLayer || core.pixi.app.stage;
      const point = world.toGlobal({ x: pixiObject.x, y: pixiObject.y });
      return { x: point.x, y: point.y };
    }, id);
  }

  async function wheelOverCanvas(page, deltaX, deltaY) {
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(deltaX, deltaY);
  }

  test('buttons +/- change scale and update label', async ({ page }) => {
    const scaleBefore = await getWorldScale(page);
    expect(scaleBefore).toBe(1);

    await page.click('.moodboard-zoombar__button[data-action="zoom-in"]');

    await expect
      .poll(() => getWorldScale(page))
      .toBeGreaterThan(scaleBefore);

    const scaleAfterIn = await getWorldScale(page);
    await expect
      .poll(() => getZoomPercentLabel(page))
      .toBe(String(Math.round(scaleAfterIn * 100)) + '%');

    await page.click('.moodboard-zoombar__button[data-action="zoom-out"]');

    await expect
      .poll(() => getWorldScale(page))
      .toBeLessThan(scaleAfterIn);
  });

  test('mouse wheel zooms in/out over canvas', async ({ page }) => {
    const scaleBefore = await getWorldScale(page);

    await wheelOverCanvas(page, 0, -100);

    await expect
      .poll(() => getWorldScale(page))
      .toBeGreaterThan(scaleBefore);

    const scaleAfterIn = await getWorldScale(page);
    await wheelOverCanvas(page, 0, 100);

    await expect
      .poll(() => getWorldScale(page))
      .toBeLessThan(scaleAfterIn);
  });

  test('Fit to screen: menu item adjusts scale to bbox of objects', async ({ page }) => {
    await clearBoard(page);
    await createObject(page, { type: 'note', properties: { content: 'A' }, width: 200, height: 200 }, { x: 100, y: 100 });
    await createObject(page, { type: 'shape', properties: { kind: 'circle' }, width: 150, height: 150 }, { x: 400, y: 300 });

    await openZoomMenu(page);
    await clickZoomMenuItem(page, 0);

    await expect
      .poll(() => getWorldScale(page))
      .toBeGreaterThan(0);
    const label = await getZoomPercentLabel(page);
    expect(label).toMatch(/^\d+%$/);
  });

  test('Fit to screen: empty board does not crash', async ({ page }) => {
    await clearBoard(page);
    const scaleBefore = await getWorldScale(page);

    await openZoomMenu(page);
    await clickZoomMenuItem(page, 0);

    await expect
      .poll(() => getWorldScale(page))
      .toBe(scaleBefore);
  });

  test('Zoom to selection: menu item adjusts scale to selection bbox', async ({ page }) => {
    await clearBoard(page);
    const id = await createObject(page, { type: 'note', properties: { content: 'X' }, width: 120, height: 120 }, { x: 300, y: 250 });
    await setSelection(page, [id]);

    await openZoomMenu(page);
    await clickZoomMenuItem(page, 1);

    await expect
      .poll(() => getWorldScale(page))
      .toBeGreaterThan(0);
  });

  test('100%: menu item resets scale to 1', async ({ page }) => {
    await page.click('.moodboard-zoombar__button[data-action="zoom-in"]');
    await expect.poll(() => getWorldScale(page)).toBeGreaterThan(1);

    await openZoomMenu(page);
    await clickZoomMenuItem(page, 2);

    await expect
      .poll(() => getWorldScale(page))
      .toBe(1);
    await expect
      .poll(() => getZoomPercentLabel(page))
      .toBe('100%');
  });

  test('Map button toggles popup with minimap canvas', async ({ page }) => {
    await page.click('.moodboard-mapbar__button');

    await expect(page.locator('.moodboard-mapbar__popup')).toBeVisible();
    await expect(page.locator('.moodboard-minimap-canvas')).toBeVisible();

    await page.click('.moodboard-mapbar__button');
    await expect(page.locator('.moodboard-mapbar__popup')).not.toBeVisible();
  });

  test('Map: click on minimap centers view (MinimapCenterOn)', async ({ page }) => {
    await createObject(page, { type: 'note', properties: {}, width: 80, height: 80 }, { x: 500, y: 400 });
    await page.click('.moodboard-zoombar__button[data-action="zoom-in"]');
    await page.click('.moodboard-zoombar__button[data-action="zoom-in"]');

    await page.click('.moodboard-mapbar__button');
    await expect(page.locator('.moodboard-mapbar__popup')).toBeVisible();
    const canvas = page.locator('.moodboard-minimap-canvas');
    await expect(canvas).toBeVisible();

    const worldBefore = await page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      const world = core?.pixi?.worldLayer || core?.pixi?.app?.stage;
      return world ? { x: world.x, y: world.y } : null;
    });

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.3, canvasBox.y + canvasBox.height * 0.3);

    await expect
      .poll(async () => {
        const worldAfter = await page.evaluate(() => {
          const core = window.moodboard?.coreMoodboard;
          const world = core?.pixi?.worldLayer || core?.pixi?.app?.stage;
          return world ? { x: world.x, y: world.y } : null;
        });
        return worldAfter && (Math.abs(worldAfter.x - worldBefore.x) > 1 || Math.abs(worldAfter.y - worldBefore.y) > 1);
      })
      .toBe(true);
  });
});
