/**
 * E2E-тесты инструмента «Добавить картинку» (основная кнопка image-add).
 * Покрывают добавление через панель, paste, drop, трансформации и undo/redo.
 * Кнопка image2 вне scope — см. TASK_IMAGE_TOOL.md.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_IMAGE = path.join(__dirname, '..', 'fixtures', 'test-image.png');

const TOOL_GET_SELECTION = 'tool:get:selection';
const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';
const EVENTS_UI_PASTE_IMAGE = 'ui:paste-image';

// Data URL для 1x1 PNG (для paste/drop без файла)
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

async function setSelection(page, ids) {
  await page.evaluate((objectIds) => {
    const selectTool = window.moodboard.coreMoodboard.selectTool;
    selectTool.setSelection(objectIds);
    selectTool.updateResizeHandles();
  }, ids);
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

async function getObjectCount(page) {
  return page.evaluate(() => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).length;
  });
}

async function emitPasteImage(page, src, name = 'test.png') {
  await page.evaluate(({ dataUrl, fileName }) => {
    window.moodboard.coreMoodboard.eventBus.emit('ui:paste-image', {
      src: dataUrl,
      name: fileName
    });
  }, { dataUrl: src, fileName: name });
}

test.describe('ImageTool E2E (image-add instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('image is added via main toolbar button (file chooser, ghost, click)', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept());

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('.moodboard-toolbar__button--image')
    ]);
    await fileChooser.setFiles(FIXTURE_IMAGE);

    await expect
      .poll(
        async () => {
          const hasGhost = await page.evaluate(() => {
            const tm = window.moodboard?.coreMoodboard?.toolManager;
            const pt = tm?.tools?.get?.('place') ?? tm?.registry?.get?.('place');
            return pt?.ghostContainer != null;
          });
          return hasGhost;
        },
        { timeout: 8000 }
      )
      .toBe(true);

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const img = (board?.objects || []).find((o) => o.type === 'image');
        return img != null;
      })
      .toBe(true);
  });

  test('image is added via paste (Events.UI.PasteImage)', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--select');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    await canvas.click({ position: { x: 10, y: 10 } });

    await emitPasteImage(page, TINY_PNG_DATA_URL, 'paste-test.png');

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const img = (board?.objects || []).find((o) => o.type === 'image');
        return img != null;
      })
      .toBe(true);
  });

  test('image is added via drop from device', async ({ page }) => {
    test.skip(true, 'Playwright: drop с files требует особого подхода, dataTransfer.files защищён');
  });

  test('move: image position changes after drag', async ({ page }) => {
    const imageId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 180,
      height: 120
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [imageId]);
    await expect.poll(() => getSelection(page)).toEqual([imageId]);

    const before = await getObjectById(page, imageId);
    const center = await getObjectCanvasCenter(page, imageId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 80, canvasBox.y + center.y + 50);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, imageId);
        const dx = Math.abs((after?.position?.x ?? 0) - (before?.position?.x ?? 0));
        const dy = Math.abs((after?.position?.y ?? 0) - (before?.position?.y ?? 0));
        return dx > 50 || dy > 30;
      })
      .toBe(true);
  });

  test('resize: handles change image width and height', async ({ page }) => {
    const imageId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 180,
      height: 120
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [imageId]);

    const before = await getObjectById(page, imageId);
    const handle = page.locator(`.mb-handle[data-id="${imageId}"][data-dir="se"]`);
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, imageId);
        return after && after.width > before.width && after.height > before.height;
      })
      .toBe(true);
  });

  test('rotate: rotate handle changes image transform.rotation', async ({ page }) => {
    const imageId = await createObject(page, 'image', { x: 360, y: 210 }, {
      src: TINY_PNG_DATA_URL,
      width: 180,
      height: 120
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [imageId]);

    const before = await getObjectById(page, imageId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${imageId}"]`);
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, imageId);

    const fromX = handleBox.x + handleBox.width / 2;
    const fromY = handleBox.y + handleBox.height / 2;
    const toX = canvasBox.x + center.x + 80;
    const toY = canvasBox.y + center.y - 60;

    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, imageId);
        const beforeRot = before?.transform?.rotation ?? 0;
        const afterRot = after?.transform?.rotation ?? 0;
        return Math.abs(afterRot - beforeRot) > 0.1;
      })
      .toBe(true);
  });

  test('undo/redo: add image can be undone and redone', async ({ page }) => {
    const countBefore = await getObjectCount(page);
    await emitPasteImage(page, TINY_PNG_DATA_URL, 'paste-test.png');

    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);

    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
    const boardAfter = await page.evaluate(() => window.moodboard.exportBoard());
    const img = (boardAfter?.objects || []).find((o) => o.type === 'image');
    expect(img).toBeTruthy();
    expect(img?.properties?.src || img?.properties?.name).toBeTruthy();
  });

  test('undo/redo: move image can be undone and redone', async ({ page }) => {
    const imageId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 180,
      height: 120
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [imageId]);

    const before = await getObjectById(page, imageId);
    const center = await getObjectCanvasCenter(page, imageId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 100, canvasBox.y + center.y + 60);
    await page.mouse.up();

    const afterMove = await getObjectById(page, imageId);
    expect(afterMove.position.x).not.toBe(before.position.x);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, imageId);
        return Math.round(obj?.position?.x ?? 0) === Math.round(before.position.x);
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, imageId);
        return Math.round(obj?.position?.x ?? 0) === Math.round(afterMove.position.x);
      })
      .toBe(true);
  });

  test('undo/redo: resize image can be undone and redone', async ({ page }) => {
    const imageId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 180,
      height: 120
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [imageId]);

    const before = await getObjectById(page, imageId);
    const handle = page.locator(`.mb-handle[data-id="${imageId}"][data-dir="se"]`);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30);
    await page.mouse.up();

    const afterResize = await getObjectById(page, imageId);
    expect(afterResize.width).toBeGreaterThan(before.width);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, imageId);
        return Math.round(obj?.width ?? 0) === before.width;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, imageId);
        return obj?.width === afterResize.width;
      })
      .toBe(true);
  });

  test('undo/redo: rotate image can be undone and redone', async ({ page }) => {
    const imageId = await createObject(page, 'image', { x: 360, y: 210 }, {
      src: TINY_PNG_DATA_URL,
      width: 180,
      height: 120
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [imageId]);

    const before = await getObjectById(page, imageId);
    const beforeRot = before?.transform?.rotation ?? 0;
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${imageId}"]`);
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, imageId);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 100, canvasBox.y + center.y - 70);
    await page.mouse.up();

    await expect
      .poll(
        async () => {
          const obj = await getObjectById(page, imageId);
          const r = obj?.transform?.rotation ?? 0;
          return Math.abs(r - beforeRot) > 0.1;
        },
        { timeout: 3000 }
      )
      .toBe(true);

    const afterRotate = await getObjectById(page, imageId);
    const afterRot = afterRotate?.transform?.rotation ?? 0;

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, imageId);
        return Math.abs((obj?.transform?.rotation ?? 0) - beforeRot) < 0.01;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, imageId);
        return Math.abs((obj?.transform?.rotation ?? 0) - afterRot) < 0.01;
      })
      .toBe(true);
  });
});
