/**
 * E2E-тесты инструмента «Фигуры» (shapes).
 * Покрывают: popup меню, добавление каждой фигуры, трансформации (move, resize, rotate),
 * рамки и ручки при выделении, undo/redo.
 */
import { test, expect } from '@playwright/test';

const TOOL_GET_SELECTION = 'tool:get:selection';
const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';

/** Кнопки фигур: btnClass → properties.kind. Первая — shape → square. */
const SHAPE_BUTTONS = [
  { btnClass: 'moodboard-shapes__btn--shape', kind: 'square' },
  { btnClass: 'moodboard-shapes__btn--rounded-square', kind: 'rounded' },
  { btnClass: 'moodboard-shapes__btn--circle', kind: 'circle' },
  { btnClass: 'moodboard-shapes__btn--triangle', kind: 'triangle' },
  { btnClass: 'moodboard-shapes__btn--diamond', kind: 'diamond' },
  { btnClass: 'moodboard-shapes__btn--parallelogram', kind: 'parallelogram' },
  { btnClass: 'moodboard-shapes__btn--arrow', kind: 'arrow' }
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

async function addShapeViaPopup(page, btnClass) {
  await page.click('.moodboard-toolbar__button--shapes');
  const popup = page.locator('.moodboard-toolbar__popup--shapes');
  await expect(popup).toBeVisible();
  await page.click(`.moodboard-shapes__grid .${btnClass}`);
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

test.describe('ShapesTool E2E (shapes instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('shapes popup appears on button click and contains shape buttons', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--shapes');
    const popup = page.locator('.moodboard-toolbar__popup--shapes');
    await expect(popup).toBeVisible();
    const grid = popup.locator('.moodboard-shapes__grid');
    await expect(grid).toBeVisible();
    for (const { btnClass } of SHAPE_BUTTONS) {
      await expect(grid.locator(`.${btnClass}`)).toBeVisible();
    }
  });

  for (const { btnClass, kind } of SHAPE_BUTTONS) {
    test(`shape ${kind} is added via menu and canvas click`, async ({ page }) => {
      const countBefore = await getObjectCount(page);
      await addShapeViaPopup(page, btnClass);
      await expect
        .poll(async () => {
          const board = await page.evaluate(() => window.moodboard.exportBoard());
          const shapeObj = (board?.objects || []).find((o) => o.type === 'shape');
          return shapeObj && shapeObj.properties?.kind === kind;
        })
        .toBe(true);
      await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
    });
  }

  test('move: shape position changes after drag', async ({ page }) => {
    const shapeId = await createObject(page, 'shape', { x: 320, y: 220 }, { kind: 'circle', width: 100, height: 100 });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [shapeId]);
    await expect.poll(() => getSelection(page)).toEqual([shapeId]);

    const before = await getObjectById(page, shapeId);
    const center = await getObjectCanvasCenter(page, shapeId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 80, canvasBox.y + center.y + 50);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, shapeId);
        const dx = Math.abs((after?.position?.x ?? 0) - (before?.position?.x ?? 0));
        const dy = Math.abs((after?.position?.y ?? 0) - (before?.position?.y ?? 0));
        return dx > 50 || dy > 30;
      })
      .toBe(true);
  });

  test('resize: handle changes shape width and height', async ({ page }) => {
    const shapeId = await createObject(page, 'shape', { x: 320, y: 220 }, { kind: 'square', width: 100, height: 100 });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [shapeId]);

    const before = await getObjectById(page, shapeId);
    const handle = page.locator(`.mb-handle[data-id="${shapeId}"][data-dir="se"]`);
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, shapeId);
        return after && after.width > before.width && after.height > before.height;
      })
      .toBe(true);
  });

  test('rotate: rotate handle changes shape transform.rotation', async ({ page }) => {
    const shapeId = await createObject(page, 'shape', { x: 360, y: 210 }, { kind: 'triangle', width: 100, height: 100 });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [shapeId]);

    const before = await getObjectById(page, shapeId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${shapeId}"]`);
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, shapeId);

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
        const after = await getObjectById(page, shapeId);
        const beforeRot = before?.transform?.rotation ?? 0;
        const afterRot = after?.transform?.rotation ?? 0;
        return Math.abs(afterRot - beforeRot) > 0.1;
      })
      .toBe(true);
  });

  test('selection shows frame and handles (mb-handles-box, mb-handle, mb-rotate-handle)', async ({ page }) => {
    const shapeId = await createObject(page, 'shape', { x: 320, y: 220 }, { kind: 'diamond', width: 100, height: 100 });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [shapeId]);

    const frame = page.locator('.mb-handles-box');
    await expect(frame).toBeVisible();
    const resizeHandle = page.locator(`.mb-handle[data-id="${shapeId}"][data-dir="se"]`);
    await expect(resizeHandle).toBeVisible();
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${shapeId}"]`);
    await expect(rotateHandle).toBeVisible();
  });

  test('undo/redo: add shape can be undone and redone', async ({ page }) => {
    const countBefore = await getObjectCount(page);
    await addShapeViaPopup(page, 'moodboard-shapes__btn--circle');

    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);

    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
    const boardAfter = await page.evaluate(() => window.moodboard.exportBoard());
    const shapeObj = (boardAfter?.objects || []).find((o) => o.type === 'shape');
    expect(shapeObj).toBeTruthy();
    expect(shapeObj?.properties?.kind).toBe('circle');
  });

  test('undo/redo: move shape can be undone and redone', async ({ page }) => {
    const shapeId = await createObject(page, 'shape', { x: 320, y: 220 }, { kind: 'square', width: 100, height: 100 });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [shapeId]);

    const before = await getObjectById(page, shapeId);
    const center = await getObjectCanvasCenter(page, shapeId);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(canvasBox.x + center.x, canvasBox.y + center.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 100, canvasBox.y + center.y + 60);
    await page.mouse.up();

    const afterMove = await getObjectById(page, shapeId);
    expect(afterMove.position.x).not.toBe(before.position.x);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, shapeId);
        return Math.round(obj?.position?.x ?? 0) === Math.round(before.position.x);
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, shapeId);
        return Math.round(obj?.position?.x ?? 0) === Math.round(afterMove.position.x);
      })
      .toBe(true);
  });

  test('undo/redo: resize shape can be undone and redone', async ({ page }) => {
    const shapeId = await createObject(page, 'shape', { x: 320, y: 220 }, { kind: 'circle', width: 100, height: 100 });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [shapeId]);

    const before = await getObjectById(page, shapeId);
    const handle = page.locator(`.mb-handle[data-id="${shapeId}"][data-dir="se"]`);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30);
    await page.mouse.up();

    const afterResize = await getObjectById(page, shapeId);
    expect(afterResize.width).toBeGreaterThan(before.width);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, shapeId);
        return Math.round(obj?.width ?? 0) === before.width;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, shapeId);
        return obj?.width === afterResize.width;
      })
      .toBe(true);
  });

  test('undo/redo: rotate shape can be undone and redone', async ({ page }) => {
    const shapeId = await createObject(page, 'shape', { x: 360, y: 210 }, { kind: 'triangle', width: 100, height: 100 });
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [shapeId]);

    const before = await getObjectById(page, shapeId);
    const beforeRot = before?.transform?.rotation ?? 0;
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${shapeId}"]`);
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, shapeId);

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center.x + 100, canvasBox.y + center.y - 70);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, shapeId);
        const r = obj?.transform?.rotation ?? 0;
        return Math.abs(r - beforeRot) > 0.1;
      }, { timeout: 3000 })
      .toBe(true);

    const afterRotate = await getObjectById(page, shapeId);
    const afterRot = afterRotate?.transform?.rotation ?? 0;

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, shapeId);
        return Math.abs((obj?.transform?.rotation ?? 0) - beforeRot) < 0.01;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, shapeId);
        return Math.abs((obj?.transform?.rotation ?? 0) - afterRot) < 0.01;
      })
      .toBe(true);
  });
});
