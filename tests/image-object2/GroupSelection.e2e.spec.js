/**
 * E2E-тесты группового выделения и команд.
 * Box select, multi-select (Ctrl/Shift), групповые операции, Select All, Undo/Redo.
 */
import { test, expect } from '@playwright/test';

const EVENTS = {
  getSelection: 'tool:get:selection',
  keyboardDelete: 'keyboard:delete',
  keyboardSelectAll: 'keyboard:select-all',
  keyboardUndo: 'keyboard:undo',
  keyboardRedo: 'keyboard:redo',
};

const TYPE_CONFIGS = [
  { type: 'text', properties: { content: 'T', fontSize: 18 }, width: 120, height: 40 },
  { type: 'note', properties: { content: 'N' }, width: 100, height: 100 },
  { type: 'image', properties: {}, width: 80, height: 60 },
  { type: 'shape', properties: { kind: 'circle' }, width: 80, height: 80 },
  {
    type: 'drawing',
    properties: { mode: 'pencil', strokeWidth: 2, strokeColor: 0x111, points: [{ x: 0, y: 0 }, { x: 50, y: 30 }] },
    width: 60,
    height: 40,
  },
  { type: 'file', properties: { fileName: 'f.txt' }, width: 100, height: 80 },
  { type: 'emoji', properties: { content: '🙂', fontSize: 32 }, width: 64, height: 64 },
  { type: 'frame', properties: { title: 'F' }, width: 150, height: 100 },
];

test.describe('GroupSelection E2E', () => {
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

  async function getBoard(page) {
    return page.evaluate(() => window.moodboard.exportBoard());
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

  async function getObject(page, id) {
    return page.evaluate(
      (objectId) => {
        const board = window.moodboard.exportBoard();
        return (board?.objects || []).find((obj) => obj.id === objectId) || null;
      },
      id
    );
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

  async function clickObject(page, id, options = {}) {
    const center = await getObjectCanvasCenter(page, id);
    expect(center).toBeTruthy();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + center.x, canvasBox.y + center.y, options);
  }

  async function setSelection(page, ids) {
    await page.evaluate((objectIds) => {
      const selectTool = window.moodboard.coreMoodboard.selectTool;
      selectTool.setSelection(objectIds);
      selectTool.updateResizeHandles();
    }, ids);
  }

  async function dragBy(page, fromX, fromY, toX, toY) {
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    const x1 = canvasBox.x + fromX;
    const y1 = canvasBox.y + fromY;
    const x2 = canvasBox.x + toX;
    const y2 = canvasBox.y + toY;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2);
    await page.mouse.up();
  }

  async function triggerSelectAll(page) {
    await page.evaluate((eventName) => {
      window.moodboard.coreMoodboard.eventBus.emit(eventName);
    }, EVENTS.keyboardSelectAll);
  }

  async function triggerDelete(page) {
    await page.evaluate((eventName) => {
      window.moodboard.coreMoodboard.eventBus.emit(eventName);
    }, EVENTS.keyboardDelete);
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

  test('multi-select Ctrl+click adds objects', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: { content: 'A' }, width: 120, height: 120 }, { x: 200, y: 200 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'square' }, width: 100, height: 100 }, { x: 450, y: 220 });

    await clickObject(page, id1);
    await expect.poll(() => getSelection(page)).toEqual([id1]);

    await page.keyboard.down('Control');
    await clickObject(page, id2);
    await page.keyboard.up('Control');

    await expect
      .poll(async () => {
        const sel = await getSelection(page);
        return [...sel].sort();
      })
      .toEqual([id1, id2].sort());
  });

  test('box select selects objects in area including frames', async ({ page }) => {
    await clearBoard(page);
    const id1 = await createObject(page, { type: 'note', properties: { content: 'A' }, width: 100, height: 100 }, { x: 150, y: 150 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'circle' }, width: 80, height: 80 }, { x: 300, y: 160 });
    const frameId = await createObject(page, { type: 'frame', properties: { title: 'F' }, width: 120, height: 80 }, { x: 450, y: 150 });

    await dragBy(page, 100, 100, 600, 280);

    await expect
      .poll(async () => {
        const sel = await getSelection(page);
        return sel.length >= 3 && sel.includes(id1) && sel.includes(id2) && sel.includes(frameId);
      })
      .toBe(true);
  });

  test.fixme('box select + Ctrl adds to existing selection', async ({ page }) => {
    await clearBoard(page);
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 80, height: 80 }, { x: 150, y: 150 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'square' }, width: 80, height: 80 }, { x: 300, y: 150 });

    await clickObject(page, id1);
    await expect.poll(() => getSelection(page)).toEqual([id1]);

    await page.keyboard.down('Control');
    await dragBy(page, 50, 50, 400, 280);
    await page.keyboard.up('Control');

    await expect
      .poll(async () => {
        const sel = await getSelection(page);
        return sel.length === 2 && sel.includes(id1) && sel.includes(id2);
      })
      .toBe(true);
  });

  test('single click selects each object type', async ({ page }) => {
    const clickableTypes = [
      { type: 'note', properties: { content: 'N' }, width: 100, height: 100 },
      { type: 'shape', properties: { kind: 'circle' }, width: 80, height: 80 },
      { type: 'text', properties: { content: 'T', fontSize: 18 }, width: 120, height: 40 },
      { type: 'frame', properties: { title: 'F' }, width: 150, height: 100 },
    ];
    for (const cfg of clickableTypes) {
      await clearBoard(page);
      const id = await createObject(page, cfg, { x: 350, y: 250 });
      await clickObject(page, id);
      await expect.poll(() => getSelection(page)).toEqual([id]);
    }
  });

  test('group move changes position of all selected', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 100, height: 100 }, { x: 220, y: 220 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'diamond' }, width: 100, height: 100 }, { x: 380, y: 240 });

    await setSelection(page, [id1, id2]);
    const before1 = await getObject(page, id1);
    const before2 = await getObject(page, id2);

    const center1 = await getObjectCanvasCenter(page, id1);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    await page.mouse.move(canvasBox.x + center1.x, canvasBox.y + center1.y);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center1.x + 50, canvasBox.y + center1.y + 30);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const o1 = await getObject(page, id1);
        const o2 = await getObject(page, id2);
        const dx1 = Math.round((o1?.position?.x ?? 0) - (before1?.position?.x ?? 0));
        const dy1 = Math.round((o1?.position?.y ?? 0) - (before1?.position?.y ?? 0));
        const dx2 = Math.round((o2?.position?.x ?? 0) - (before2?.position?.x ?? 0));
        const dy2 = Math.round((o2?.position?.y ?? 0) - (before2?.position?.y ?? 0));
        return dx1 === dx2 && dy1 === dy2 && Math.abs(dx1) >= 40;
      })
      .toBe(true);
  });

  test('group rotate changes rotation of all selected', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 80, height: 80 }, { x: 300, y: 200 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'circle' }, width: 60, height: 60 }, { x: 420, y: 210 });

    await setSelection(page, [id1, id2]);
    const rotateHandle = page.locator('.mb-rotate-handle[data-id="__group__"]');
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const center1 = await getObjectCanvasCenter(page, id1);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + center1.x + 80, canvasBox.y + center1.y - 50);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const o1 = await getObject(page, id1);
        const o2 = await getObject(page, id2);
        const r1 = (o1?.transform?.rotation ?? 0) * (180 / Math.PI);
        const r2 = (o2?.transform?.rotation ?? 0) * (180 / Math.PI);
        return Math.abs(r1 - r2) < 1 && Math.abs(r1) > 5;
      })
      .toBe(true);
  });

  test('group resize changes width/height of all selected', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 100, height: 80 }, { x: 280, y: 200 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'square' }, width: 80, height: 80 }, { x: 420, y: 210 });

    await setSelection(page, [id1, id2]);
    const resizeHandle = page.locator('.mb-handle[data-id="__group__"][data-dir="se"]');
    await expect(resizeHandle).toBeVisible();
    const handleBox = await resizeHandle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 40, handleBox.y + handleBox.height / 2 + 30);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const o1 = await getObject(page, id1);
        const o2 = await getObject(page, id2);
        return (o1?.width ?? 0) > 100 && (o2?.width ?? 0) > 80;
      })
      .toBe(true);
  });

  test('group delete removes all selected, one Undo restores (GroupDeleteCommand)', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 100, height: 100 }, { x: 250, y: 220 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'circle' }, width: 80, height: 80 }, { x: 400, y: 240 });

    await setSelection(page, [id1, id2]);
    expect(await page.evaluate(() => (window.moodboard.exportBoard().objects || []).length)).toBe(2);

    await triggerDelete(page);

    await expect
      .poll(async () => (await getBoard(page)).objects.length)
      .toBe(0);

    await triggerUndo(page);

    await expect
      .poll(async () => (await getBoard(page)).objects.length)
      .toBe(2);

    expect(await getObject(page, id1)).toBeTruthy();
    expect(await getObject(page, id2)).toBeTruthy();
  });

  test('Shift+click adds object to selection', async ({ page }) => {
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 100, height: 100 }, { x: 200, y: 200 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'square' }, width: 80, height: 80 }, { x: 380, y: 220 });

    await clickObject(page, id1);
    await expect.poll(() => getSelection(page)).toEqual([id1]);

    await page.keyboard.down('Shift');
    await clickObject(page, id2);
    await page.keyboard.up('Shift');

    await expect
      .poll(async () => {
        const sel = await getSelection(page);
        return sel.length === 2 && sel.includes(id1) && sel.includes(id2);
      })
      .toBe(true);
  });

  test('Ctrl+A selects all objects on board', async ({ page }) => {
    await clearBoard(page);
    const id1 = await createObject(page, { type: 'note', properties: {}, width: 80, height: 80 }, { x: 150, y: 150 });
    const id2 = await createObject(page, { type: 'shape', properties: { kind: 'circle' }, width: 60, height: 60 }, { x: 300, y: 160 });
    const id3 = await createObject(page, { type: 'text', properties: { content: 'T' }, width: 100, height: 40 }, { x: 420, y: 170 });

    await triggerSelectAll(page);

    await expect
      .poll(async () => {
        const sel = await getSelection(page);
        return sel.length === 3 && sel.includes(id1) && sel.includes(id2) && sel.includes(id3);
      })
      .toBe(true);
  });
});
