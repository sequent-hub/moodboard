/**
 * E2E-тесты инструмента «Фрейм» (frame).
 * Покрывают: popup панель, добавление всех типов фреймов, перемещение, масштабирование,
 * объекты на фрейме, захват произвольным фреймом, панель свойств, рамка и выделение.
 */
import { test, expect } from '@playwright/test';

const TOOL_GET_SELECTION = 'tool:get:selection';
const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';

/** Пресеты фреймов: data-id → ожидаемые свойства. */
const FRAME_PRESETS = [
  { dataId: 'a4', expectedType: 'a4', expectedTitle: 'A4', minWidth: 400, minHeight: 500 },
  { dataId: '1x1', expectedType: '1x1', expectedTitle: '1:1', minWidth: 500, minHeight: 500 },
  { dataId: '4x3', expectedType: '4x3', expectedTitle: '4:3', minWidth: 600, minHeight: 400 },
  { dataId: '16x9', expectedType: '16x9', expectedTitle: '16:9', minWidth: 600, minHeight: 300 }
];

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

/** Добавить фрейм-пресет через popup: клик по кнопке frame → выбор пресета → ghost → клик по холсту. */
async function addFramePresetViaPopup(page, dataId) {
  await page.click('.moodboard-toolbar__button--frame');
  const popup = page.locator('.frame-popup');
  await expect(popup).toBeVisible();
  await page.click(`.frame-popup__btn[data-id="${dataId}"]`);
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

/** Добавить произвольный фрейм: клик frame → Произвольный → mousedown → mousemove → mouseup. */
async function addArbitraryFrameViaDraw(page, fromX, fromY, toX, toY) {
  await page.click('.moodboard-toolbar__button--frame');
  const popup = page.locator('.frame-popup');
  await expect(popup).toBeVisible();
  await page.click('.frame-popup__btn[data-id="custom"]');
  const canvas = page.locator('.moodboard-workspace__canvas canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();
  await page.mouse.move(canvasBox.x + fromX, canvasBox.y + fromY);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + toX, canvasBox.y + toY);
  await page.mouse.up();
}

test.describe('FrameTool E2E (frame instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('frame popup appears on button click and contains all frame buttons', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--frame');
    const popup = page.locator('.frame-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.frame-popup__btn--header')).toHaveText('Произвольный');
    for (const { dataId } of FRAME_PRESETS) {
      await expect(popup.locator(`.frame-popup__btn[data-id="${dataId}"]`)).toBeVisible();
    }
    await expect(popup.locator('.frame-popup__holder')).toHaveCount(5);
    await expect(popup.locator('.frame-popup__caption')).toHaveCount(5);
  });

  for (const { dataId, expectedType, expectedTitle, minWidth, minHeight } of FRAME_PRESETS) {
    test(`preset ${dataId} is added via popup and canvas click`, async ({ page }) => {
      const countBefore = await getObjectCount(page);
      await addFramePresetViaPopup(page, dataId);
      await expect
        .poll(async () => {
          const board = await page.evaluate(() => window.moodboard.exportBoard());
          const frameObj = (board?.objects || []).find((o) => o.type === 'frame');
          return (
            frameObj &&
            frameObj.properties?.type === expectedType &&
            frameObj.width >= minWidth &&
            frameObj.height >= minHeight
          );
        })
        .toBe(true);
      await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
    });
  }

  test('arbitrary frame is added via draw mode (mousedown-mousemove-mouseup)', async ({ page }) => {
    const countBefore = await getObjectCount(page);
    await addArbitraryFrameViaDraw(page, 200, 150, 400, 320);
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const frameObj = (board?.objects || []).find(
          (o) => o.type === 'frame' && (o.properties?.isArbitrary || o.properties?.title === 'Произвольный')
        );
        return frameObj && frameObj.width >= 150 && frameObj.height >= 150;
      })
      .toBe(true);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
  });

  test('move: frame position changes after drag', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 300, y: 200 }, {
      width: 260,
      height: 180,
      title: 'Move test'
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);
    await expect.poll(() => getSelection(page)).toEqual([frameId]);

    const before = await getObjectById(page, frameId);
    const center = await getObjectCanvasCenter(page, frameId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 80, canvasBox.y + center.y + 50);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, frameId);
        const pos = after?.position || {};
        const dx = Math.abs(pos.x - (before?.position?.x ?? 0));
        const dy = Math.abs(pos.y - (before?.position?.y ?? 0));
        return dx > 50 || dy > 30;
      })
      .toBe(true);
  });

  test('resize: handle changes frame width and height', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 320, y: 220 }, {
      width: 200,
      height: 150,
      title: 'Resize test'
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);

    const before = await getObjectById(page, frameId);
    const handle = page.locator(`.mb-handle[data-id="${frameId}"][data-dir="se"]`);
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, frameId);
        return after && after.width > before.width && after.height > before.height;
      })
      .toBe(true);
  });

  test('note created inside frame gets frameId', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 250, y: 180 }, {
      width: 300,
      height: 250,
      title: 'Host'
    });
    const frameCenter = await getObjectCanvasCenter(page, frameId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.click('.moodboard-toolbar__button--note');
    await page.mouse.click(canvasBox.x + frameCenter.x, canvasBox.y + frameCenter.y);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const noteObj = (board?.objects || []).find((o) => o.type === 'note');
        return noteObj?.properties?.frameId === frameId;
      })
      .toBe(true);
  });

  test('note moves with frame when frame is dragged', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 280, y: 200 }, {
      width: 280,
      height: 200,
      title: 'Group'
    });
    const noteId = await createObject(page, 'note', { x: 350, y: 300 }, {
      content: 'Child',
      width: 80,
      height: 80,
      frameId
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);

    const frameBefore = await getObjectById(page, frameId);
    const noteBefore = await getObjectById(page, noteId);
    const frameBounds = await page.evaluate((id) => {
      const core = window.moodboard.coreMoodboard;
      const obj = core.pixi.objects.get(id);
      if (!obj) return null;
      const world = core.pixi.worldLayer || core.pixi.app.stage;
      const tl = world.toGlobal({ x: obj.x, y: obj.y });
      return { x: tl.x + 20, y: tl.y + 20 };
    }, frameId);
    expect(frameBounds).toBeTruthy();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + frameBounds.x, canvasBox.y + frameBounds.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + frameBounds.x + 70, canvasBox.y + frameBounds.y + 45);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const frameAfter = await getObjectById(page, frameId);
        const noteAfter = await getObjectById(page, noteId);
        const frameDx = (frameAfter?.position?.x ?? 0) - (frameBefore?.position?.x ?? 0);
        const frameDy = (frameAfter?.position?.y ?? 0) - (frameBefore?.position?.y ?? 0);
        const noteDx = (noteAfter?.position?.x ?? 0) - (noteBefore?.position?.x ?? 0);
        const noteDy = (noteAfter?.position?.y ?? 0) - (noteBefore?.position?.y ?? 0);
        return Math.abs(noteDx - frameDx) < 5 && Math.abs(noteDy - frameDy) < 5 && Math.abs(frameDx) > 50;
      })
      .toBe(true);
  });

  test('arbitrary frame captures intersecting note on creation', async ({ page }) => {
    const noteId = await createObject(page, 'note', { x: 320, y: 240 }, {
      content: 'Capture me',
      width: 100,
      height: 100
    });

    await addArbitraryFrameViaDraw(page, 250, 200, 450, 350);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const frameObj = (board?.objects || []).find((o) => o.type === 'frame' && o.properties?.isArbitrary);
        const noteObj = (board?.objects || []).find((o) => o.id === noteId);
        return frameObj && noteObj?.properties?.frameId === frameObj.id;
      })
      .toBe(true);
  });

  test('rename: title changes in properties panel', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 320, y: 220 }, {
      width: 220,
      height: 160,
      title: 'Original'
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);

    const panel = page.locator('.frame-properties-panel');
    await expect(panel).toBeVisible({ timeout: 2000 });
    const titleInput = panel.locator('.fpp-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Renamed frame');
    await titleInput.blur();

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, frameId);
        return obj?.properties?.title;
      })
      .toBe('Renamed frame');
  });

  test('type change in properties panel updates frame properties', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 320, y: 220 }, {
      width: 200,
      height: 150,
      title: 'Type test',
      type: 'custom'
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);

    const typeSelect = page.locator('.frame-properties-panel .fpp-select');
    await expect(typeSelect).toBeVisible({ timeout: 2000 });
    await typeSelect.selectOption({ value: '4x3' });

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, frameId);
        return obj?.properties?.type === '4x3';
      })
      .toBe(true);
  });

  test('background color changes in properties panel', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 320, y: 220 }, {
      width: 200,
      height: 150,
      title: 'Color test'
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);

    const colorButton = page.locator('.frame-properties-panel .fpp-color-button');
    await expect(colorButton).toBeVisible({ timeout: 2000 });
    await colorButton.click();
    const presetBtn = page.locator('.frame-properties-panel [data-color-hex="#E3F2FD"]').first();
    await expect(presetBtn).toBeVisible({ timeout: 2000 });
    await presetBtn.click();

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, frameId);
        const bg = obj?.backgroundColor ?? obj?.properties?.backgroundColor;
        return typeof bg === 'number' && bg === 0xe3f2fd;
      })
      .toBe(true);
  });

  test('selection shows handles box and resize handles, rotate handle hidden for frame', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 320, y: 220 }, {
      width: 200,
      height: 150,
      title: 'Handles'
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);

    const handlesBox = page.locator('.mb-handles-box');
    await expect(handlesBox).toBeVisible();
    const resizeHandle = page.locator(`.mb-handle[data-id="${frameId}"][data-dir="se"]`);
    await expect(resizeHandle).toBeVisible();
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${frameId}"]`);
    await expect(rotateHandle).toHaveCount(0);
  });

  test('click on frame selects it', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 350, y: 250 }, {
      width: 200,
      height: 150,
      title: 'Select'
    });
    await page.click('.moodboard-toolbar__button--select');
    const center = await getObjectCanvasCenter(page, frameId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    await page.mouse.click(canvasBox.x + center.x, canvasBox.y + center.y);

    await expect.poll(() => getSelection(page)).toContain(frameId);
    await expect(page.locator('.mb-handles-box')).toBeVisible();
  });

  test('color palette closes on outside click', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 320, y: 220 }, {
      width: 200,
      height: 150,
      title: 'Palette'
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);

    const colorButton = page.locator('.frame-properties-panel .fpp-color-button');
    await expect(colorButton).toBeVisible({ timeout: 2000 });
    await colorButton.click();
    const palette = page.locator('.frame-properties-panel .color-palette');
    await expect(palette).toBeVisible();
    await expect(palette).toHaveCSS('display', 'flex');

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    await page.mouse.click(canvasBox.x + canvasBox.width - 30, canvasBox.y + canvasBox.height - 30);
    await expect(palette).toHaveCSS('display', 'none');
  });

  test('frame title persists after zoom change', async ({ page }) => {
    const frameId = await createObject(page, 'frame', { x: 320, y: 220 }, {
      width: 200,
      height: 150
    });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [frameId]);
    const titleInput = page.locator('.frame-properties-panel .fpp-input');
    await expect(titleInput).toBeVisible({ timeout: 2000 });
    await titleInput.fill('Zoom test');
    await titleInput.blur();

    await page.evaluate(() => {
      window.moodboard.coreMoodboard.eventBus.emit('ui:zoom:percent', { percentage: 150 });
    });
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, frameId);
        return obj?.properties?.title === 'Zoom test';
      })
      .toBe(true);
  });
});
