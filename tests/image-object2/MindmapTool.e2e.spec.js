/**
 * E2E-тесты инструмента «Интеллект-карта» (mindmap-add).
 * Проверяют включение режима размещения, добавление объекта и undo/redo.
 */
import { test, expect } from '@playwright/test';

const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';

async function getObjectCount(page) {
  return page.evaluate(() => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).length;
  });
}

async function triggerUndo(page) {
  await page.evaluate((eventName) => {
    window.moodboard.coreMoodboard.eventBus.emit(eventName);
  }, EVENTS_KEYBOARD_UNDO);
}

async function triggerRedo(page) {
  await page.evaluate((eventName) => {
    window.moodboard.coreMoodboard.eventBus.emit(eventName);
  }, EVENTS_KEYBOARD_REDO);
}

test.describe('MindmapTool E2E (mindmap-add instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('mindmap button activates place mode and shows ghost', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const tm = window.moodboard?.coreMoodboard?.toolManager;
            const activeTool = tm?.getActiveTool?.();
            const placeTool = tm?.tools?.get?.('place') ?? tm?.registry?.get?.('place');
            return {
              activeToolName: activeTool?.name || null,
              hasGhost: !!placeTool?.ghostContainer,
              pendingType: placeTool?.pending?.type || null
            };
          }),
        { timeout: 5000 }
      )
      .toEqual({
        activeToolName: 'place',
        hasGhost: true,
        pendingType: 'mindmap'
      });
  });

  test('mindmap object is added at click position and supports undo/redo', async ({ page }) => {
    const countBefore = await getObjectCount(page);

    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    const clickLocalX = canvasBox.width / 2;
    const clickLocalY = canvasBox.height / 2;
    await page.mouse.click(canvasBox.x + clickLocalX, canvasBox.y + clickLocalY);

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const core = window.moodboard?.coreMoodboard;
          if (!core) return null;
          const board = window.moodboard.exportBoard();
          const object = (board?.objects || []).find((o) => o.type === 'mindmap');
          if (!object?.id) return null;
          const pixiObject = core.pixi.objects.get(object.id);
          if (!pixiObject) return null;
          const world = core.pixi.worldLayer || core.pixi.app.stage;
          const p = world.toGlobal({ x: pixiObject.x, y: pixiObject.y });
          return { x: p.x, y: p.y };
        });
      })
      .toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number)
      });

    await expect
      .poll(async () => {
        const center = await page.evaluate(() => {
          const core = window.moodboard?.coreMoodboard;
          if (!core) return null;
          const board = window.moodboard.exportBoard();
          const object = (board?.objects || []).find((o) => o.type === 'mindmap');
          if (!object?.id) return null;
          const pixiObject = core.pixi.objects.get(object.id);
          if (!pixiObject) return null;
          const world = core.pixi.worldLayer || core.pixi.app.stage;
          const p = world.toGlobal({ x: pixiObject.x, y: pixiObject.y });
          return { x: p.x, y: p.y };
        });
        if (!center) return null;
        const dx = Math.abs(center.x - clickLocalX);
        const dy = Math.abs(center.y - clickLocalY);
        return dx <= 1 && dy <= 1;
      })
      .toBe(true);

    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);

    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).some((o) => o.type === 'mindmap');
      })
      .toBe(true);
  });
});
