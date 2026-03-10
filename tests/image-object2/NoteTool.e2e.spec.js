/**
 * E2E-тесты инструмента «Записка» (note-add).
 * Проверяют добавление записки на доску, редактирование, панель свойств и трансформации.
 * Отдельные тесты проверяют историю команд: undo/redo для каждого действия.
 */
import { test, expect } from '@playwright/test';

const TOOL_GET_SELECTION = 'tool:get:selection';
const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';

// Шрифты из NotePropertiesPanel (значения option)
const NOTE_FONT_OPTIONS = [
  'Caveat, Arial, cursive',
  'Roboto, Arial, sans-serif',
  'Oswald, Arial, sans-serif',
  'Playfair Display, Georgia, serif',
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

async function doubleClickObject(page, id) {
  const center = await getObjectCanvasCenter(page, id);
  expect(center).toBeTruthy();
  const canvas = page.locator('.moodboard-workspace__canvas canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();
  await page.mouse.dblclick(canvasBox.x + center.x, canvasBox.y + center.y);
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

test.describe('NoteTool E2E (note-add instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('note is added to the board via note-add button', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--note');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);

    // Записка создаётся сразу с дефолтным текстом (без editOnCreate, в отличие от текста)
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const noteObj = (board?.objects || []).find((o) => o.type === 'note');
        return noteObj?.properties?.content;
      })
      .toBe('Новая записка');
  });

  test('note is editable (double-click opens editor, changes persist)', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Before edit', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    await expect.poll(() => getSelection(page)).toEqual([noteId]);

    await doubleClickObject(page, noteId);

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('After edit');
    await textarea.press('Enter');

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.content;
      })
      .toBe('After edit');
  });

  test('note edit cancel (Escape) preserves original content', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Original', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    await doubleClickObject(page, noteId);

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('Modified but cancelled');
    await textarea.press('Escape');

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.content;
      })
      .toBe('Original');
  });

  test('resize handles change note size', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 300, y: 200 },
      { content: 'Resizable', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    await expect.poll(() => getSelection(page)).toEqual([noteId]);

    const before = await getObjectById(page, noteId);
    const handle = page.locator(`.mb-handle[data-id="${noteId}"][data-dir="se"]`);
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await getObjectById(page, noteId);
        return after.width > before.width && after.height > before.height;
      })
      .toBe(true);
  });

  test('font family changes in properties panel', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Font test', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    await expect.poll(() => getSelection(page)).toEqual([noteId]);

    const panel = page.locator('.note-properties-panel');
    await expect(panel).toBeVisible({ timeout: 2000 });
    const fontSelect = panel.locator('.font-select');
    await expect(fontSelect).toBeVisible();

    const newFont = 'Roboto, Arial, sans-serif';
    await fontSelect.selectOption({ value: newFont });

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontFamily;
      })
      .toBe(newFont);
  });

  test('all fonts switch in properties panel', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Fonts', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);

    const fontSelect = page.locator('.note-properties-panel .font-select');
    await expect(fontSelect).toBeVisible({ timeout: 2000 });

    for (const fontValue of NOTE_FONT_OPTIONS) {
      await fontSelect.selectOption({ value: fontValue });
      await expect
        .poll(async () => {
          const obj = await getObjectById(page, noteId);
          return obj?.properties?.fontFamily;
        })
        .toBe(fontValue);
    }
  });

  test('font size changes in properties panel', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Size test', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);

    const sizeInput = page.locator('.note-properties-panel .font-size-input');
    await expect(sizeInput).toBeVisible({ timeout: 2000 });
    await sizeInput.fill('24');
    await sizeInput.blur();

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontSize;
      })
      .toBe(24);
  });

  test('font size boundary (8, 32) persists', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Size', fontSize: 16, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);

    const sizeInput = page.locator('.note-properties-panel .font-size-input');
    await expect(sizeInput).toBeVisible({ timeout: 2000 });
    await sizeInput.fill('8');
    await sizeInput.blur();
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontSize;
      })
      .toBe(8);

    await sizeInput.fill('32');
    await sizeInput.blur();
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontSize;
      })
      .toBe(32);
  });

  test('text color changes in properties panel', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Color', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);

    const textColorButton = page.locator('.note-properties-panel').locator('button').nth(1);
    await textColorButton.click();

    const presetButton = page.locator('.note-properties-panel [data-color-value="#D32F2F"]').first();
    await expect(presetButton).toBeVisible({ timeout: 2000 });
    await presetButton.click();

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        const tc = obj?.properties?.textColor;
        return typeof tc === 'number' && tc === 0xd32f2f;
      })
      .toBe(true);
  });

  test('background color changes in properties panel', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Background', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);

    const bgButton = page.locator('.note-properties-panel').locator('button').first();
    await bgButton.click();

    const presetButton = page.locator('.note-properties-panel [data-color-value="#E3F2FD"]').first();
    await expect(presetButton).toBeVisible({ timeout: 2000 });
    await presetButton.click();

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        const bg = obj?.properties?.backgroundColor;
        return typeof bg === 'number' && bg === 0xe3f2fd;
      })
      .toBe(true);
  });

  test('note can be rotated with rotate handle', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 360, y: 210 },
      { content: 'Rotate me', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    await expect.poll(() => getSelection(page)).toEqual([noteId]);

    const before = await getObjectById(page, noteId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${noteId}"]`);
    await expect(rotateHandle).toBeVisible();

    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, noteId);

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
        const after = await getObjectById(page, noteId);
        const beforeRot = before.transform?.rotation || 0;
        const afterRot = after.transform?.rotation || 0;
        return Math.abs(afterRot - beforeRot);
      })
      .toBeGreaterThan(0.1);
  });

  // === Undo/Redo ===
  test('undo/redo: добавление записки можно отменить и восстановить', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--note');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);

    await expect.poll(() => getObjectCount(page)).toBe(1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(0);

    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(1);
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const noteObj = (board?.objects || []).find((o) => o.type === 'note');
        return noteObj?.properties?.content;
      })
      .toBe('Новая записка');
  });

  test('undo/redo: редактирование текста записки можно отменить и восстановить', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Original', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    await doubleClickObject(page, noteId);
    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('Edited');
    await textarea.press('Enter');

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.content;
      })
      .toBe('Edited');

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.content;
      })
      .toBe('Original');

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.content;
      })
      .toBe('Edited');
  });

  test('undo/redo: ресайз записки можно отменить и восстановить', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 300, y: 200 },
      { content: 'Resize', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    const before = await getObjectById(page, noteId);
    const handle = page.locator(`.mb-handle[data-id="${noteId}"][data-dir="se"]`);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
    await page.mouse.up();

    const afterResize = await getObjectById(page, noteId);
    expect(afterResize.width).toBeGreaterThan(before.width);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return Math.round(obj?.width || 0);
      })
      .toBe(before.width);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.width;
      })
      .toBe(afterResize.width);
  });

  test('undo/redo: поворот записки можно отменить и восстановить', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 360, y: 210 },
      { content: 'Rotate', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    const before = await getObjectById(page, noteId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${noteId}"]`);
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, noteId);

    const fromX = handleBox.x + handleBox.width / 2;
    const fromY = handleBox.y + handleBox.height / 2;
    const toX = canvasBox.x + center.x + 100;
    const toY = canvasBox.y + center.y - 70;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY);
    await page.mouse.up();

    const beforeRot = before.transform?.rotation ?? 0;
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        const r = obj?.transform?.rotation ?? 0;
        return Math.abs(r - beforeRot);
      })
      .toBeGreaterThan(0.1);

    const afterRotate = await getObjectById(page, noteId);
    const afterRot = afterRotate.transform?.rotation ?? 0;

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return Math.abs((obj?.transform?.rotation || 0) - beforeRot);
      })
      .toBeLessThan(0.01);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return Math.abs((obj?.transform?.rotation || 0) - afterRot);
      })
      .toBeLessThan(0.01);
  });

  test('undo/redo: смена шрифта в панели свойств можно отменить и восстановить', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Font', fontSize: 18, fontFamily: 'Caveat, Arial, cursive', width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    const defaultFont = 'Caveat, Arial, cursive';
    const newFont = 'Roboto, Arial, sans-serif';

    const fontSelect = page.locator('.note-properties-panel .font-select');
    await expect(fontSelect).toBeVisible({ timeout: 2000 });
    await fontSelect.selectOption({ value: newFont });
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontFamily;
      })
      .toBe(newFont);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontFamily;
      })
      .toBe(defaultFont);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontFamily;
      })
      .toBe(newFont);
  });

  test('undo/redo: панель свойств синхронизируется после отмены (font size)', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Sync', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    const sizeInput = page.locator('.note-properties-panel .font-size-input');
    await expect(sizeInput).toBeVisible({ timeout: 2000 });
    await sizeInput.fill('24');
    await sizeInput.blur();
    await expect(sizeInput).toHaveValue('24');

    await triggerUndo(page);
    await expect(sizeInput).toHaveValue('18');
  });

  test('undo/redo: смена размера шрифта можно отменить и восстановить', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Size', fontSize: 18, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    const sizeInput = page.locator('.note-properties-panel .font-size-input');
    await expect(sizeInput).toBeVisible({ timeout: 2000 });
    await sizeInput.fill('24');
    await sizeInput.blur();
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontSize;
      })
      .toBe(24);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontSize;
      })
      .toBe(18);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.fontSize;
      })
      .toBe(24);
  });

  test('undo/redo: смена цвета текста можно отменить и восстановить', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Color', fontSize: 18, textColor: 0x1a1a1a, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    const textColorButton = page.locator('.note-properties-panel').locator('button').nth(1);
    await textColorButton.click();
    await page.locator('.note-properties-panel [data-color-value="#D32F2F"]').first().click();
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.textColor === 0xd32f2f;
      })
      .toBe(true);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.textColor === 0x1a1a1a;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.textColor === 0xd32f2f;
      })
      .toBe(true);
  });

  test('undo/redo: смена фона записки можно отменить и восстановить', async ({ page }) => {
    const noteId = await createObject(
      page,
      'note',
      { x: 320, y: 220 },
      { content: 'Bg', fontSize: 18, backgroundColor: 0xfff9c4, width: 200, height: 150 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [noteId]);
    const bgButton = page.locator('.note-properties-panel').locator('button').first();
    await bgButton.click();
    await page.locator('.note-properties-panel [data-color-value="#E3F2FD"]').first().click();
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.backgroundColor === 0xe3f2fd;
      })
      .toBe(true);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.backgroundColor === 0xfff9c4;
      })
      .toBe(true);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, noteId);
        return obj?.properties?.backgroundColor === 0xe3f2fd;
      })
      .toBe(true);
  });
});
