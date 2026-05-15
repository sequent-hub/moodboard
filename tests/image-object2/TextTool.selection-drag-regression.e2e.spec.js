import { test, expect } from '@playwright/test';

const TOOL_GET_SELECTION = 'tool:get:selection';

test.describe('Text tool regression: select and drag after blur', () => {
  test('text created from toolbar is selectable by click and draggable', async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    const createX = canvasBox.x + 520;
    const createY = canvasBox.y + 320;
    const blurX = canvasBox.x + 760;
    const blurY = canvasBox.y + 480;
    const clearSelX = canvasBox.x + 80;
    const clearSelY = canvasBox.y + 80;

    await page.click('.moodboard-toolbar__button--text-add');
    await page.mouse.click(createX, createY);

    const editor = page.locator('.moodboard-text-input');
    await expect(editor).toBeVisible();
    await editor.fill('Playwright text selection regression');
    await page.mouse.click(blurX, blurY);
    await expect(editor).toHaveCount(0);

    const created = await page.evaluate((eventName) => {
      const board = window.moodboard.exportBoard();
      const textObjects = (board?.objects || []).filter((o) => o.type === 'text' || o.type === 'simple-text');
      if (textObjects.length === 0) return null;
      const object = textObjects[textObjects.length - 1];
      const req = { selection: [] };
      window.moodboard.coreMoodboard.eventBus.emit(eventName, req);
      const htmlEl = window.moodboardHtmlTextLayer?.idToEl?.get(object.id) || null;
      const htmlRect = htmlEl?.getBoundingClientRect ? htmlEl.getBoundingClientRect() : null;
      return {
        objectId: object.id,
        content: object.properties?.content || object.content || '',
        selection: req.selection || [],
        htmlRect: htmlRect
          ? { left: htmlRect.left, top: htmlRect.top, width: htmlRect.width, height: htmlRect.height }
          : null,
      };
    }, TOOL_GET_SELECTION);

    expect(created).toBeTruthy();
    expect(created.content).toContain('Playwright text selection regression');
    expect(created.htmlRect).toBeTruthy();

    const clickPoint = {
      x: created.htmlRect.left + created.htmlRect.width / 2,
      y: created.htmlRect.top + created.htmlRect.height / 2,
    };

    await page.mouse.click(clearSelX, clearSelY);
    await expect
      .poll(async () => {
        return page.evaluate((eventName) => {
          const req = { selection: [] };
          window.moodboard.coreMoodboard.eventBus.emit(eventName, req);
          return req.selection || [];
        }, TOOL_GET_SELECTION);
      })
      .toEqual([]);

    await page.mouse.click(clickPoint.x, clickPoint.y);

    await expect
      .poll(async () => {
        return page.evaluate((eventName) => {
          const req = { selection: [] };
          window.moodboard.coreMoodboard.eventBus.emit(eventName, req);
          return req.selection || [];
        }, TOOL_GET_SELECTION);
      })
      .toEqual([created.objectId]);

    const beforeDrag = await page.evaluate((objectId) => {
      const board = window.moodboard.exportBoard();
      const object = (board?.objects || []).find((o) => o.id === objectId);
      return object ? { x: object.position.x, y: object.position.y } : null;
    }, created.objectId);
    expect(beforeDrag).toBeTruthy();

    await page.mouse.move(clickPoint.x, clickPoint.y);
    await page.mouse.down();
    await page.mouse.move(clickPoint.x + 140, clickPoint.y + 70);
    await page.mouse.up();

    await expect
      .poll(async () => {
        return page.evaluate((objectId) => {
          const board = window.moodboard.exportBoard();
          const object = (board?.objects || []).find((o) => o.id === objectId);
          if (!object) return null;
          return { x: object.position.x, y: object.position.y };
        }, created.objectId);
      })
      .toEqual({ x: beforeDrag.x + 140, y: beforeDrag.y + 70 });
  });
});
