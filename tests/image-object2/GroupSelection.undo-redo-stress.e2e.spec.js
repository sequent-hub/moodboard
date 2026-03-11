/**
 * Стресс-тест undo/redo для групповых операций.
 * Каждое действие — скриншот. На каждом undo сверяем с эталоном (состояние до этого шага).
 * На каждом redo сверяем с эталоном (состояние после этого шага).
 * Проверяется реальная картинка на PIXI canvas, а не только данные в state.
 *
 * ТРЕБУЕТ ДОРАБОТКИ: воспроизводит ~1–2% пиксельную variance (рендеринг), но не ловит
 * реальный баг в браузере (2 объекта не двигаются, рамка вокруг 2 вместо 4).
 * Отключён до доработки.
 *
 * Тест использует РЕАЛЬНУЮ симуляцию мыши (ручка поворота, перетаскивание группы).
 * Для создания/обновления baseline: --update-snapshots
 */
import { test, expect } from '@playwright/test';

const EVENTS = {
  getSelection: 'tool:get:selection',
  keyboardSelectAll: 'keyboard:select-all',
  keyboardUndo: 'keyboard:undo',
  keyboardRedo: 'keyboard:redo',
};

test.describe('GroupSelection undo/redo stress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await page.click('.moodboard-toolbar__button--select');
  });

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

  async function getSelection(page) {
    return page.evaluate((eventName) => {
      const req = { selection: [] };
      window.moodboard.coreMoodboard.eventBus.emit(eventName, req);
      return req.selection || [];
    }, EVENTS.getSelection);
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

  async function setSelection(page, ids) {
    await page.evaluate((objectIds) => {
      const selectTool = window.moodboard.coreMoodboard.selectTool;
      selectTool.setSelection(objectIds);
      selectTool.updateResizeHandles();
    }, ids);
  }

  async function performRotateViaHandle(page, ids) {
    const rotateHandle = page.locator('.mb-rotate-handle[data-id="__group__"]');
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const center = await getObjectCanvasCenter(page, ids[0]);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const handleCenterX = canvasBox.x + (handleBox.x - canvasBox.x) + handleBox.width / 2;
    const handleCenterY = canvasBox.y + (handleBox.y - canvasBox.y) + handleBox.height / 2;
    const targetX = canvasBox.x + center.x + 50;
    const targetY = canvasBox.y + center.y - 40;
    await page.mouse.move(handleCenterX, handleCenterY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY);
    await page.mouse.up();
  }

  async function performGroupDrag(page, ids, deltaX, deltaY) {
    const center = await getObjectCanvasCenter(page, ids[0]);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const fromX = canvasBox.x + center.x;
    const fromY = canvasBox.y + center.y;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + deltaX, fromY + deltaY);
    await page.mouse.up();
  }

  async function triggerUndo(page) {
    await page.evaluate((eventName) => {
      window.moodboard.coreMoodboard.eventBus.emit(eventName);
    }, EVENTS.keyboardUndo);
  }

  async function triggerRedo(page) {
    await page.evaluate((eventName) => {
      window.moodboard.coreMoodboard.eventBus.emit(eventName);
    }, EVENTS.keyboardRedo);
  }

  const canvasLocator = '.moodboard-workspace__canvas canvas';
  const screenshotOpts = { maxDiffPixelRatio: 0.002 };

  test.skip('4 objects: each action = screenshot, each undo/redo = visual comparison', async ({
    page,
  }) => {
    test.setTimeout(120000);

    await clearBoard(page);

    const objectCount = 4;
    const ids = [];
    const baseConfig = { type: 'note', properties: { content: 'x' }, width: 80, height: 80 };
    const positions = [
      { x: 200, y: 200 },
      { x: 320, y: 200 },
      { x: 200, y: 320 },
      { x: 320, y: 320 },
    ];

    for (let i = 0; i < objectCount; i++) {
      const id = await createObject(page, baseConfig, positions[i]);
      ids.push(id);
    }

    await setSelection(page, ids);
    await expect.poll(async () => (await getSelection(page)).length).toBe(objectCount);

    await page.evaluate((n) => {
      const h = window.moodboard.coreMoodboard.history;
      h.options.maxHistorySize = Math.max(h.options.maxHistorySize, n);
    }, 50);

    let stateIndex = 0;
    await expect(page.locator(canvasLocator)).toHaveScreenshot(`state-${stateIndex}.png`, screenshotOpts);

    const rotateCount1 = 5;
    for (let i = 0; i < rotateCount1; i++) {
      await performRotateViaHandle(page, ids);
      await page.waitForTimeout(50);
      stateIndex++;
      await expect(page.locator(canvasLocator)).toHaveScreenshot(`state-${stateIndex}.png`, screenshotOpts);
    }

    await performGroupDrag(page, ids, 40, 30);
    await page.waitForTimeout(50);
    stateIndex++;
    await expect(page.locator(canvasLocator)).toHaveScreenshot(`state-${stateIndex}.png`, screenshotOpts);

    const rotateCount2 = 3;
    for (let i = 0; i < rotateCount2; i++) {
      await performRotateViaHandle(page, ids);
      await page.waitForTimeout(50);
      stateIndex++;
      await expect(page.locator(canvasLocator)).toHaveScreenshot(`state-${stateIndex}.png`, screenshotOpts);
    }

    const totalSteps = stateIndex;
    expect(totalSteps).toBe(rotateCount1 + 1 + rotateCount2);

    for (let u = 0; u < totalSteps; u++) {
      await triggerUndo(page);
      await page.waitForTimeout(30);
      const expectedState = totalSteps - 1 - u;
      await expect(page.locator(canvasLocator)).toHaveScreenshot(`state-${expectedState}.png`, screenshotOpts);
    }

    for (let r = 0; r < totalSteps; r++) {
      await triggerRedo(page);
      await page.waitForTimeout(30);
      const expectedState = r + 1;
      await expect(page.locator(canvasLocator)).toHaveScreenshot(`state-${expectedState}.png`, screenshotOpts);
    }
  });
});
