/**
 * E2E регрессионные тесты: рамка группы НЕ должна становиться горизонтальной
 * после остановки группового вращения.
 *
 * Баг: при групповом вращении после каждой остановки (mouse up) рамка
 * перестраивалась и выравнивалась по горизонтали (rotate(0deg)).
 *
 * Эти тесты обязаны падать при возврате такого поведения.
 */
import { test, expect } from '@playwright/test';

test.describe('GroupSelection: frame must NOT become horizontal after group rotation', () => {
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

  async function getFrameRotationDeg(page) {
    return page.evaluate(() => {
      const box = document.querySelector('.mb-handles-box');
      if (!box) return null;
      const t = box.style.transform || '';
      const m = t.match(/rotate\((-?\d+\.?\d*)deg\)/);
      return m ? parseFloat(m[1]) : 0;
    });
  }

  async function performRotateViaHandle(page, ids, angleDirection = 1) {
    const rotateHandle = page.locator('.mb-rotate-handle[data-id="__group__"]');
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const center = await getObjectCanvasCenter(page, ids[0]);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    const offset = 60 * angleDirection;
    const handleCenterX = handleBox.x + handleBox.width / 2;
    const handleCenterY = handleBox.y + handleBox.height / 2;
    const targetX = canvasBox.x + center.x + offset;
    const targetY = canvasBox.y + center.y - offset;

    await page.mouse.move(handleCenterX, handleCenterY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY);
    await page.mouse.up();
    await page.waitForTimeout(80);
  }

  test('frame stays rotated after first rotate gesture (must NOT be rotate(0deg))', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 80, height: 80 }, { x: 300, y: 200 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'circle' }, width: 60, height: 60 }, { x: 420, y: 210 });

    await setSelection(page, [id1, id2]);
    await performRotateViaHandle(page, [id1, id2]);

    const rotation = await getFrameRotationDeg(page);
    expect(rotation).not.toBeNull();
    expect(Math.abs(rotation)).toBeGreaterThan(5);
  });

  test('frame stays rotated after EACH stop in repeated rotate gestures', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 80, height: 80 }, { x: 300, y: 200 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'circle' }, width: 60, height: 60 }, { x: 420, y: 210 });

    await setSelection(page, [id1, id2]);

    await performRotateViaHandle(page, [id1, id2], 1);
    const rotation1 = await getFrameRotationDeg(page);
    expect(rotation1).not.toBeNull();
    expect(Math.abs(rotation1)).toBeGreaterThan(5);

    await performRotateViaHandle(page, [id1, id2], 1);
    const rotation2 = await getFrameRotationDeg(page);
    expect(rotation2).not.toBeNull();
    expect(Math.abs(rotation2)).toBeGreaterThan(5);
  });
});
