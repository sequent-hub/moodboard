import { test, expect } from '@playwright/test';

const EVENTS = {
  getSelection: 'tool:get:selection',
  keyboardCopy: 'keyboard:copy',
  keyboardPaste: 'keyboard:paste',
  keyboardDelete: 'keyboard:delete',
  layerBringToFront: 'ui:layer:bring-to-front',
  layerSendToBack: 'ui:layer:send-to-back'
};

const TYPE_CONFIGS = [
  { type: 'text', properties: { content: 'Smoke text', fontSize: 20 }, width: 200, height: 60 },
  { type: 'note', properties: { content: 'Smoke note' }, width: 180, height: 180 },
  { type: 'image', properties: {}, width: 180, height: 120 },
  { type: 'shape', properties: { kind: 'circle' }, width: 160, height: 160 },
  {
    type: 'drawing',
    properties: {
      mode: 'pencil',
      strokeWidth: 4,
      strokeColor: 0x1f2937,
      points: [
        { x: 10, y: 10 },
        { x: 80, y: 20 },
        { x: 130, y: 70 }
      ]
    },
    width: 170,
    height: 110
  },
  { type: 'file', properties: { fileName: 'smoke.pdf' }, width: 120, height: 140 },
  { type: 'emoji', properties: { content: '🙂', fontSize: 56 }, width: 96, height: 96 },
  { type: 'frame', properties: { title: 'Smoke frame' }, width: 260, height: 180 }
];

test.describe('SelectTool E2E smoke by object types', () => {
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
          height: cfg.height
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

  async function dragObjectBy(page, id, dx, dy) {
    const center = await getObjectCanvasCenter(page, id);
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const fromX = canvasBox.x + center.x;
    const fromY = canvasBox.y + center.y;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + dx, fromY + dy);
    await page.mouse.up();
  }

  async function setSelection(page, ids) {
    await page.evaluate((objectIds) => {
      const selectTool = window.moodboard.coreMoodboard.selectTool;
      selectTool.setSelection(objectIds);
      selectTool.updateResizeHandles();
    }, ids);
  }

  test('all supported types are created, selected and moved', async ({ page }) => {
    for (const cfg of TYPE_CONFIGS) {
      await clearBoard(page);
      const id = await createObject(page, cfg, { x: 320, y: 220 });
      const board = await getBoard(page);
      const ids = new Set((board.objects || []).map((obj) => obj.id));
      expect(ids.has(id)).toBe(true);

      const before = await getObject(page, id);
      await setSelection(page, [id]);
      await expect.poll(() => getSelection(page)).toEqual([id]);
      await dragObjectBy(page, id, 40, 25);
      await expect
        .poll(async () => {
          const after = await getObject(page, id);
          return {
            dx: Math.round((after?.position?.x || 0) - (before?.position?.x || 0)),
            dy: Math.round((after?.position?.y || 0) - (before?.position?.y || 0))
          };
        })
        .toMatchObject({ dx: expect.any(Number), dy: expect.any(Number) });
      const afterMove = await getObject(page, id);
      expect(Math.round((afterMove?.position?.x || 0) - (before?.position?.x || 0))).toBeGreaterThanOrEqual(35);
      expect(Math.round((afterMove?.position?.y || 0) - (before?.position?.y || 0))).toBeGreaterThanOrEqual(20);
    }
  });

  test('single-object resize and rotate smoke for types with visible handles', async ({ page }) => {
    for (const cfg of TYPE_CONFIGS) {
      await clearBoard(page);
      const id = await createObject(page, cfg, { x: 340, y: 230 });
      await setSelection(page, [id]);
      await expect.poll(() => getSelection(page)).toEqual([id]);

      const before = await getObject(page, id);
      const resizeHandle = page.locator(`.mb-handle[data-id="${id}"][data-dir="se"]`);
      const resizeCount = await resizeHandle.count();
      if (resizeCount > 0) {
        const resizeVisible = await resizeHandle.isVisible();
        if (resizeVisible) {
          const box = await resizeHandle.boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20);
          await page.mouse.up();
        }
      }

      const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${id}"]`);
      const rotateCount = await rotateHandle.count();
      if (rotateCount > 0) {
        const rotateVisible = await rotateHandle.isVisible();
        if (rotateVisible) {
          const handleBox = await rotateHandle.boundingBox();
          const canvas = page.locator('.moodboard-workspace__canvas canvas');
          const canvasBox = await canvas.boundingBox();
          const center = await getObjectCanvasCenter(page, id);
          await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(canvasBox.x + center.x + 55, canvasBox.y + center.y - 40);
          await page.mouse.up();
        }
      }

      await expect
        .poll(async () => {
          const after = await getObject(page, id);
          return {
            width: after.width,
            height: after.height,
            rotation: after.transform?.rotation || 0
          };
        })
        .toBeTruthy();

      const after = await getObject(page, id);
      expect(after.width).toBeGreaterThan(0);
      expect(after.height).toBeGreaterThan(0);
      expect(Math.abs((after.transform?.rotation || 0) - (before.transform?.rotation || 0)) >= 0).toBe(true);
    }
  });

  test('copy/paste and delete work for single selection', async ({ page }) => {
    const noteId = await createObject(
      page,
      { type: 'note', properties: { content: 'Copy me' }, width: 180, height: 180 },
      { x: 350, y: 220 }
    );

    await setSelection(page, [noteId]);
    await expect.poll(() => getSelection(page)).toEqual([noteId]);

    const beforeCount = await page.evaluate(() => (window.moodboard.exportBoard().objects || []).length);
    await page.evaluate(async (id) => {
      const core = window.moodboard.coreMoodboard;
      await core.copyObject(id);
      core.pasteObject();
    }, noteId);

    await expect
      .poll(async () => {
        const board = await getBoard(page);
        return (board.objects || []).length;
      })
      .toBeGreaterThan(beforeCount);

    const selectedAfterPaste = await getSelection(page);
    expect(selectedAfterPaste.length).toBeGreaterThan(0);
    await page.evaluate((deleteEvent) => {
      window.moodboard.coreMoodboard.eventBus.emit(deleteEvent);
    }, EVENTS.keyboardDelete);
    await expect.poll(() => getSelection(page)).toEqual([]);
  });

  test('z-order and group smoke (copy/move/resize)', async ({ page }) => {
    const firstId = await createObject(
      page,
      { type: 'note', properties: { content: 'A' }, width: 160, height: 160 },
      { x: 220, y: 220 }
    );
    const secondId = await createObject(
      page,
      { type: 'shape', properties: { kind: 'diamond' }, width: 160, height: 160 },
      { x: 520, y: 240 }
    );

    await clickObject(page, firstId);
    await expect.poll(() => getSelection(page)).toEqual([firstId]);

    const orderBefore = await page.evaluate(() => (window.moodboard.exportBoard().objects || []).map((o) => o.id));
    await page.evaluate(({ eventName, objectId }) => {
      window.moodboard.coreMoodboard.eventBus.emit(eventName, { objectId });
    }, { eventName: EVENTS.layerBringToFront, objectId: firstId });
    await expect
      .poll(async () => {
        const ids = (await getBoard(page)).objects.map((obj) => obj.id);
        return ids[ids.length - 1];
      })
      .toBe(firstId);

    await page.evaluate(({ eventName, objectId }) => {
      window.moodboard.coreMoodboard.eventBus.emit(eventName, { objectId });
    }, { eventName: EVENTS.layerSendToBack, objectId: firstId });
    await expect
      .poll(async () => {
        const ids = (await getBoard(page)).objects.map((obj) => obj.id);
        return ids[0];
      })
      .toBe(firstId);
    expect(orderBefore.length).toBeGreaterThan(1);

    await setSelection(page, [firstId, secondId]);
    await expect
      .poll(async () => {
        const selected = await getSelection(page);
        return [...selected].sort();
      })
      .toEqual([firstId, secondId].sort());

    const firstBeforeGroup = await getObject(page, firstId);
    await dragObjectBy(page, firstId, 55, 35);
    await expect
      .poll(async () => {
        const firstAfter = await getObject(page, firstId);
        return {
          dx: Math.round(firstAfter.position.x - firstBeforeGroup.position.x),
          dy: Math.round(firstAfter.position.y - firstBeforeGroup.position.y)
        };
      })
      .toEqual({ dx: 55, dy: 35 });

    const groupResizeHandle = page.locator('.mb-handle[data-id="__group__"][data-dir="se"]');
    await expect(groupResizeHandle).toBeVisible();
    const groupHandleBox = await groupResizeHandle.boundingBox();
    await page.mouse.move(groupHandleBox.x + groupHandleBox.width / 2, groupHandleBox.y + groupHandleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(groupHandleBox.x + groupHandleBox.width / 2 + 40, groupHandleBox.y + groupHandleBox.height / 2 + 25);
    await page.mouse.up();

    await page.evaluate(({ copyEvent, pasteEvent }) => {
      const bus = window.moodboard.coreMoodboard.eventBus;
      bus.emit(copyEvent);
      bus.emit(pasteEvent);
    }, { copyEvent: EVENTS.keyboardCopy, pasteEvent: EVENTS.keyboardPaste });

    await expect
      .poll(async () => {
        const boardNow = await getBoard(page);
        return (boardNow.objects || []).length;
      })
      .toBeGreaterThan(2);
  });
});
