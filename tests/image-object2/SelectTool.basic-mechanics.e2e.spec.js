import { test, expect } from '@playwright/test';

const TOOL_GET_SELECTION = 'tool:get:selection';

test.describe('SelectTool basic mechanics (Playwright)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
    await page.click('.moodboard-toolbar__button--select');
  });

  async function createObject(page, type, position, properties = {}) {
    return page.evaluate(
      ({ objectType, objectPosition, objectProperties }) => {
        return window.moodboard.createObject(objectType, objectPosition, objectProperties).id;
      },
      { objectType: type, objectPosition: position, objectProperties: properties }
    );
  }

  async function getObjectById(page, id) {
    return page.evaluate((objectId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || []).find((obj) => obj.id === objectId) || null;
    }, id);
  }

  async function getSelection(page) {
    return page.evaluate((eventName) => {
      const req = { selection: [] };
      window.moodboard.coreMoodboard.eventBus.emit(eventName, req);
      return req.selection || [];
    }, TOOL_GET_SELECTION);
  }

  async function getObjectCanvasCenter(page, id) {
    return page.evaluate((objectId) => {
      const core = window.moodboard.coreMoodboard;
      const pixiObject = core.pixi.objects.get(objectId);
      if (!pixiObject) return null;

      const world = core.pixi.worldLayer || core.pixi.app.stage;
      const p = world.toGlobal({ x: pixiObject.x, y: pixiObject.y });
      return { x: p.x, y: p.y };
    }, id);
  }

  async function clickObject(page, id) {
    const center = await getObjectCanvasCenter(page, id);
    expect(center).toBeTruthy();

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    await page.mouse.click(canvasBox.x + center.x, canvasBox.y + center.y);
  }

  test('select, multi-select and clear selection by Escape', async ({ page }) => {
    const firstId = await createObject(page, 'note', { x: 220, y: 170 }, { width: 180, height: 180 });
    const secondId = await createObject(page, 'note', { x: 520, y: 220 }, { width: 180, height: 180 });

    await clickObject(page, firstId);
    await expect.poll(() => getSelection(page)).toEqual([firstId]);

    await page.keyboard.down('Control');
    await clickObject(page, secondId);
    await page.keyboard.up('Control');

    await expect
      .poll(async () => {
        const selected = await getSelection(page);
        return [...selected].sort();
      })
      .toEqual([firstId, secondId].sort());

    await page.keyboard.press('Escape');
    await expect.poll(() => getSelection(page)).toEqual([]);
  });

  test('drag moves selected object', async ({ page }) => {
    const objectId = await createObject(page, 'note', { x: 320, y: 220 }, { width: 180, height: 180 });
    const before = await getObjectById(page, objectId);
    expect(before).toBeTruthy();

    await clickObject(page, objectId);
    await expect.poll(() => getSelection(page)).toEqual([objectId]);

    const center = await getObjectCanvasCenter(page, objectId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    const startX = canvasBox.x + center.x;
    const startY = canvasBox.y + center.y;
    const endX = startX + 120;
    const endY = startY + 70;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, objectId);
        return {
          dx: Math.round(after.position.x - before.position.x),
          dy: Math.round(after.position.y - before.position.y)
        };
      })
      .toEqual({ dx: 120, dy: 70 });
  });

  test('resize with handle changes object size', async ({ page }) => {
    const objectId = await createObject(page, 'note', { x: 280, y: 180 }, { width: 180, height: 180 });
    await clickObject(page, objectId);
    await expect.poll(() => getSelection(page)).toEqual([objectId]);

    const before = await getObjectById(page, objectId);
    const handle = page.locator(`.mb-handle[data-id="${objectId}"][data-dir="se"]`);
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, objectId);
        return {
          widthIncreased: after.width > before.width,
          heightIncreased: after.height > before.height
        };
      })
      .toEqual({ widthIncreased: true, heightIncreased: true });
  });

  test('rotate with rotate handle changes rotation', async ({ page }) => {
    const objectId = await createObject(page, 'note', { x: 360, y: 210 }, { width: 180, height: 180 });
    await clickObject(page, objectId);
    await expect.poll(() => getSelection(page)).toEqual([objectId]);

    const before = await getObjectById(page, objectId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${objectId}"]`);
    await expect(rotateHandle).toBeVisible();

    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, objectId);

    const fromX = handleBox.x + handleBox.width / 2;
    const fromY = handleBox.y + handleBox.height / 2;
    const toX = canvasBox.x + center.x + 130;
    const toY = canvasBox.y + center.y - 80;

    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, objectId);
        const beforeRotation = before.transform?.rotation || 0;
        const afterRotation = after.transform?.rotation || 0;
        return Math.abs(afterRotation - beforeRotation);
      })
      .toBeGreaterThan(0.1);
  });

  test('box select and Delete key remove selected objects', async ({ page }) => {
    const firstId = await createObject(page, 'note', { x: 220, y: 180 }, { width: 140, height: 140 });
    const secondId = await createObject(page, 'note', { x: 420, y: 240 }, { width: 140, height: 140 });

    const firstCenter = await getObjectCanvasCenter(page, firstId);
    const secondCenter = await getObjectCanvasCenter(page, secondId);

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    const left = Math.min(firstCenter.x, secondCenter.x) - 140;
    const top = Math.min(firstCenter.y, secondCenter.y) - 140;
    const right = Math.max(firstCenter.x, secondCenter.x) + 140;
    const bottom = Math.max(firstCenter.y, secondCenter.y) + 140;

    await page.mouse.move(canvasBox.x + left, canvasBox.y + top);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + right, canvasBox.y + bottom);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const selected = await getSelection(page);
        return [...selected].sort();
      })
      .toEqual([firstId, secondId].sort());

    await page.keyboard.press('Delete');

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const ids = new Set((board.objects || []).map((obj) => obj.id));
        return {
          firstExists: ids.has(firstId),
          secondExists: ids.has(secondId)
        };
      })
      .toEqual({ firstExists: false, secondExists: false });
  });
});
