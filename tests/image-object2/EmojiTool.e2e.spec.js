/**
 * E2E-тесты инструмента «Эмоджи» (custom-emoji).
 * Покрывают: popup меню, отображение эмоджи, добавление на доску, призрак,
 * перемещение, масштабирование, вращение, удаление, undo/redo.
 * Объекты из popup: type: 'image', properties.isEmojiIcon: true.
 */
import { test, expect } from '@playwright/test';

const TOOL_GET_SELECTION = 'tool:get:selection';
const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';
const EVENTS_KEYBOARD_DELETE = 'keyboard:delete';

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

/** Добавить эмоджи через popup: клик по кнопке → выбор эмоджи → ghost → клик по холсту. */
async function addEmojiViaPopup(page) {
  await page.click('.moodboard-toolbar__button--emoji');
  const popup = page.locator('.moodboard-toolbar__popup--emoji');
  await expect(popup).toBeVisible();
  const firstEmojiBtn = popup.locator('.moodboard-emoji__btn').first();
  await expect(firstEmojiBtn).toBeVisible();
  await firstEmojiBtn.click();
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const tm = window.moodboard?.coreMoodboard?.toolManager;
          const pt = tm?.tools?.get?.('place') ?? tm?.registry?.get?.('place');
          return pt?.ghostContainer != null;
        }),
      { timeout: 5000 }
    )
    .toBe(true);
  const canvas = page.locator('.moodboard-workspace__canvas canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
}

test.describe('EmojiTool E2E (emoji instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('emoji popup appears on button click and contains sections and emoji buttons', async ({
    page
  }) => {
    await page.click('.moodboard-toolbar__button--emoji');
    const popup = page.locator('.moodboard-toolbar__popup--emoji');
    await expect(popup).toBeVisible();
    const section = popup.locator('.moodboard-emoji__section');
    await expect(section.first()).toBeVisible({ timeout: 3000 });
    const btn = popup.locator('.moodboard-emoji__btn');
    await expect(btn.first()).toBeVisible();
  });

  test('emoji buttons display images with src', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--emoji');
    const popup = page.locator('.moodboard-toolbar__popup--emoji');
    await expect(popup).toBeVisible();
    const img = popup.locator('.moodboard-emoji__img').first();
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src.length).toBeGreaterThan(0);
  });

  test('emoji is added to board via popup (click emoji → ghost → canvas)', async ({ page }) => {
    const countBefore = await getObjectCount(page);
    await addEmojiViaPopup(page);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const imgObj = (board?.objects || []).find(
          (o) => o.type === 'image' && o.properties?.isEmojiIcon === true
        );
        return imgObj != null;
      })
      .toBe(true);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
  });

  test('ghost appears after selecting emoji in popup', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--emoji');
    const popup = page.locator('.moodboard-toolbar__popup--emoji');
    await expect(popup).toBeVisible();
    await popup.locator('.moodboard-emoji__btn').first().click();

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const tm = window.moodboard?.coreMoodboard?.toolManager;
            const pt = tm?.tools?.get?.('place') ?? tm?.registry?.get?.('place');
            return pt?.ghostContainer != null;
          }),
        { timeout: 5000 }
      )
      .toBe(true);
  });

  test('move: emoji position changes after drag', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);
    await expect.poll(() => getSelection(page)).toEqual([emojiId]);

    const before = await getObjectById(page, emojiId);
    const center = await getObjectCanvasCenter(page, emojiId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 80, canvasBox.y + center.y + 50);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, emojiId);
        const dx = Math.abs((after?.position?.x ?? 0) - (before?.position?.x ?? 0));
        const dy = Math.abs((after?.position?.y ?? 0) - (before?.position?.y ?? 0));
        return dx > 50 || dy > 30;
      })
      .toBe(true);
  });

  test('resize: handle changes emoji size (locked aspect preserved)', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 320, y: 220 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);

    const before = await getObjectById(page, emojiId);
    const handle = page.locator(`.mb-handle[data-id="${emojiId}"][data-dir="se"]`);
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, emojiId);
        return after && after.width > before.width && after.height > before.height;
      })
      .toBe(true);
    const after = await getObjectById(page, emojiId);
    expect(after.width).toBe(after.height);
  });

  test('rotate: rotate handle changes emoji transform.rotation', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 360, y: 210 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);

    const before = await getObjectById(page, emojiId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${emojiId}"]`);
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, emojiId);

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
        const after = await getObjectById(page, emojiId);
        const beforeRot = before?.transform?.rotation ?? 0;
        const afterRot = after?.transform?.rotation ?? 0;
        return Math.abs(afterRot - beforeRot) > 0.1;
      })
      .toBe(true);
  });

  test('delete: emoji is removed from board', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);
    await expect.poll(() => getSelection(page)).toEqual([emojiId]);

    await triggerDelete(page);

    await expect.poll(() => getObjectById(page, emojiId)).toBeNull();
    await expect.poll(() => getObjectCount(page)).toBe(0);
  });

  test('undo/redo: add emoji can be undone and redone', async ({ page }) => {
    const countBefore = await getObjectCount(page);
    await addEmojiViaPopup(page);

    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);

    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
    const boardAfter = await page.evaluate(() => window.moodboard.exportBoard());
    const emojiObj = (boardAfter?.objects || []).find(
      (o) => o.type === 'image' && o.properties?.isEmojiIcon === true
    );
    expect(emojiObj).toBeTruthy();
    expect(emojiObj?.properties?.src || emojiObj?.properties?.isEmojiIcon).toBeTruthy();
  });

  test('undo/redo: move emoji can be undone and redone', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);

    const before = await getObjectById(page, emojiId);
    const center = await getObjectCanvasCenter(page, emojiId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 100, canvasBox.y + center.y + 60);
    await page.mouse.up();

    const afterMove = await getObjectById(page, emojiId);
    expect(afterMove.position.x).not.toBe(before.position.x);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, emojiId);
        return Math.round(obj?.position?.x ?? 0) === Math.round(before.position.x);
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, emojiId);
        return Math.round(obj?.position?.x ?? 0) === Math.round(afterMove.position.x);
      })
      .toBe(true);
  });

  test('undo/redo: resize emoji can be undone and redone', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 320, y: 220 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);

    const before = await getObjectById(page, emojiId);
    const handle = page.locator(`.mb-handle[data-id="${emojiId}"][data-dir="se"]`);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30);
    await page.mouse.up();

    const afterResize = await getObjectById(page, emojiId);
    expect(afterResize.width).toBeGreaterThan(before.width);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, emojiId);
        return Math.round(obj?.width ?? 0) === before.width;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, emojiId);
        return obj?.width === afterResize.width;
      })
      .toBe(true);
  });

  test('undo/redo: rotate emoji can be undone and redone', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 360, y: 210 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);

    const before = await getObjectById(page, emojiId);
    const beforeRot = before?.transform?.rotation ?? 0;
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${emojiId}"]`);
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, emojiId);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 100, canvasBox.y + center.y - 70);
    await page.mouse.up();

    await expect
      .poll(
        async () => {
          const obj = await getObjectById(page, emojiId);
          const r = obj?.transform?.rotation ?? 0;
          return Math.abs(r - beforeRot) > 0.1;
        },
        { timeout: 3000 }
      )
      .toBe(true);

    const afterRotate = await getObjectById(page, emojiId);
    const afterRot = afterRotate?.transform?.rotation ?? 0;

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, emojiId);
        return Math.abs((obj?.transform?.rotation ?? 0) - beforeRot) < 0.01;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, emojiId);
        return Math.abs((obj?.transform?.rotation ?? 0) - afterRot) < 0.01;
      })
      .toBe(true);
  });

  test('undo/redo: delete emoji can be undone and redone', async ({ page }) => {
    const emojiId = await createObject(page, 'image', { x: 300, y: 200 }, {
      src: TINY_PNG_DATA_URL,
      width: 64,
      height: 64,
      isEmojiIcon: true
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [emojiId]);

    const countBefore = await getObjectCount(page);
    await triggerDelete(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore - 1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);
    const restored = await getObjectById(page, emojiId);
    expect(restored).toBeTruthy();
    expect(restored?.type).toBe('image');
    expect(restored?.properties?.isEmojiIcon).toBe(true);

    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore - 1);
    await expect.poll(() => getObjectById(page, emojiId)).toBeNull();
  });
});
