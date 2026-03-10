/**
 * E2E-тесты инструмента «Добавить файл» (attachments).
 * Покрывают диалог выбора, призрак, размещение, выделение, панель «Скачать», рамку, перемещение, удаление.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILE = path.join(__dirname, '..', 'fixtures', 'test-file.txt');

const TOOL_GET_SELECTION = 'tool:get:selection';
const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';
const EVENTS_KEYBOARD_DELETE = 'keyboard:delete';

async function createObject(page, type, position, properties = {}) {
  return page.evaluate(
    ({ objectType, objectPosition, objectProperties }) => {
      const result = window.moodboard.createObject(objectType, objectPosition, objectProperties);
      return result?.id ?? null;
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

async function triggerDelete(page) {
  await page.evaluate((eventName) => {
    window.moodboard.coreMoodboard.eventBus.emit(eventName);
  }, EVENTS_KEYBOARD_DELETE);
}

async function getObjectCount(page) {
  return page.evaluate(() => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).length;
  });
}

test.describe('FileTool E2E (attachments instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('file dialog opens on attachments button click', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('.moodboard-toolbar__button--attachments')
    ]);
    expect(fileChooser).toBeTruthy();
    await fileChooser.setFiles(FIXTURE_FILE);
  });

  test('file ghost appears after file selection', async ({ page }) => {
    page.once('dialog', (d) => d.accept());

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('.moodboard-toolbar__button--attachments')
    ]);
    await fileChooser.setFiles(FIXTURE_FILE);

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
        { timeout: 5000 }
      )
      .toBe(true);
  });

  test('file is added to board via attachments button (dialog, ghost, click)', async ({
    page
  }) => {
    page.once('dialog', (d) => d.accept());

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('.moodboard-toolbar__button--attachments')
    ]);
    await fileChooser.setFiles(FIXTURE_FILE);

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
        { timeout: 5000 }
      )
      .toBe(true);

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const fileObj = (board?.objects || []).find((o) => o.type === 'file');
        return fileObj != null;
      })
      .toBe(true);

    const board = await page.evaluate(() => window.moodboard.exportBoard());
    const fileObj = (board?.objects || []).find((o) => o.type === 'file');
    expect(fileObj.properties.fileName).toBe('test-file.txt');
  });

  test('file selection shows handles box (frame)', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 320, y: 220 }, {
      fileName: 'doc.pdf',
      fileSize: 1024,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);
    await expect.poll(() => getSelection(page)).toEqual([fileId]);

    const handlesBox = page.locator('.mb-handles-box');
    await expect(handlesBox).toBeVisible();
  });

  test('file selection shows download button in properties panel', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 320, y: 220 }, {
      fileName: 'report.pdf',
      fileSize: 2048,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);
    await expect.poll(() => getSelection(page)).toEqual([fileId]);

    const panel = page.locator('.moodboard-file-properties-panel');
    await expect(panel).toBeVisible({ timeout: 2000 });
    const downloadBtn = page.locator('.moodboard-file-panel-download');
    await expect(downloadBtn).toBeVisible();
  });

  test('download button is disabled when file has no fileId', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 320, y: 220 }, {
      fileName: 'local.txt',
      fileSize: 100,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);

    const downloadBtn = page.locator('.moodboard-file-panel-download');
    await expect(downloadBtn).toBeVisible({ timeout: 2000 });
    await expect(downloadBtn).toBeDisabled();
    await expect(downloadBtn).toHaveAttribute('title', 'Файл недоступен для скачивания');
  });

  test('download triggers request when file has fileId', async ({ page }) => {
    let downloadRequested = false;
    await page.route('**/api/files/**', (route) => {
      downloadRequested = true;
      route.fulfill({ status: 200, body: 'test content' });
    });

    const fileId = await page.evaluate(() => {
      const core = window.moodboard.coreMoodboard;
      const result = core.createObject('file', { x: 320, y: 220 }, {
        fileName: 'remote.pdf',
        fileSize: 500,
        width: 120,
        height: 140
      }, { fileId: 'test-file-id' });
      return result?.id ?? null;
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);

    const downloadBtn = page.locator('.moodboard-file-panel-download');
    await expect(downloadBtn).toBeVisible({ timeout: 2000 });
    await expect(downloadBtn).toBeEnabled();
    await downloadBtn.click();

    await expect
      .poll(() => downloadRequested, { timeout: 5000 })
      .toBe(true);
  });

  test('file frame is shown without resize handles (isFileTarget)', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 320, y: 220 }, {
      fileName: 'frame-test.pdf',
      fileSize: 0,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);

    const handlesBox = page.locator('.mb-handles-box');
    await expect(handlesBox).toBeVisible();
    const resizeHandle = page.locator(`.mb-handle[data-id="${fileId}"][data-dir="se"]`);
    await expect(resizeHandle).not.toBeVisible();
  });

  test('file can be moved by drag', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 300, y: 200 }, {
      fileName: 'move.pdf',
      fileSize: 0,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);
    await expect.poll(() => getSelection(page)).toEqual([fileId]);

    const before = await getObjectById(page, fileId);
    const center = await getObjectCanvasCenter(page, fileId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 80, canvasBox.y + center.y + 50);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, fileId);
        const dx = Math.abs((after?.position?.x ?? 0) - (before?.position?.x ?? 0));
        const dy = Math.abs((after?.position?.y ?? 0) - (before?.position?.y ?? 0));
        return dx > 50 || dy > 30;
      })
      .toBe(true);
  });

  test('file can be deleted with Delete', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 300, y: 200 }, {
      fileName: 'delete.pdf',
      fileSize: 0,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);
    await expect.poll(() => getSelection(page)).toEqual([fileId]);

    await triggerDelete(page);

    await expect.poll(() => getObjectById(page, fileId)).toBeNull();
  });

  test('undo restores deleted file', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 300, y: 200 }, {
      fileName: 'undo-test.pdf',
      fileSize: 0,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);

    const countBefore = await getObjectCount(page);
    await triggerDelete(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore - 1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);
    const restored = await getObjectById(page, fileId);
    expect(restored).toBeTruthy();
    expect(restored.type).toBe('file');
  });

  test('FileCanceled hides ghost and switches to select', async ({ page }) => {
    page.once('dialog', (d) => d.accept());
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('.moodboard-toolbar__button--attachments')
    ]);
    await fileChooser.setFiles(FIXTURE_FILE);

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
        { timeout: 3000 }
      )
      .toBe(true);

    await page.evaluate(() => {
      window.moodboard.coreMoodboard.eventBus.emit('place:file:canceled');
    });

    await expect
      .poll(
        async () => {
          const hasGhost = await page.evaluate(() => {
            const tm = window.moodboard?.coreMoodboard?.toolManager;
            const pt = tm?.tools?.get?.('place') ?? tm?.registry?.get?.('place');
            return pt?.ghostContainer != null;
          });
          return !hasGhost;
        },
        { timeout: 2000 }
      )
      .toBe(true);
  });

  test('fallback file has dimensions 120x140', async ({ page }) => {
    page.once('dialog', (d) => d.accept());
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('.moodboard-toolbar__button--attachments')
    ]);
    await fileChooser.setFiles(FIXTURE_FILE);

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);

    const fileObj = await page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || []).find((o) => o.type === 'file') || null;
    });
    expect(fileObj).toBeTruthy();
    expect(fileObj.width).toBe(120);
    expect(fileObj.height).toBe(140);
  });

  test('long filename does not break file object', async ({ page }) => {
    const longName = 'A'.repeat(100) + '.pdf';
    const fileId = await createObject(page, 'file', { x: 320, y: 220 }, {
      fileName: longName,
      fileSize: 0,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);

    const obj = await getObjectById(page, fileId);
    expect(obj).toBeTruthy();
    expect(obj.properties.fileName).toBe(longName);
    const handlesBox = page.locator('.mb-handles-box');
    await expect(handlesBox).toBeVisible();
  });

  test('redo removes file again after undo', async ({ page }) => {
    const fileId = await createObject(page, 'file', { x: 300, y: 200 }, {
      fileName: 'redo-test.pdf',
      fileSize: 0,
      width: 120,
      height: 140
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [fileId]);

    const countBefore = await getObjectCount(page);
    await triggerDelete(page);
    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);
    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore - 1);
    await expect.poll(() => getObjectById(page, fileId)).toBeNull();
  });
});
