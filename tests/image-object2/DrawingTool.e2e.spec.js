/**
 * E2E-тесты инструмента «Рисование» (draw).
 * Покрывают: popup, курсор карандаша, варианты карандаша и маркера,
 * ластик (выбор, иконка), ластик стирает карандаш и маркер.
 */
import { test, expect } from '@playwright/test';

const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';

// Ожидаемые значения для карандаша (из ToolbarPopupsController)
const PENCIL_PRESETS = [
  { btnClass: 'moodboard-draw__btn--size-thin-black', strokeWidth: 2, strokeColorHex: 0x111827 },
  { btnClass: 'moodboard-draw__btn--size-medium-red', strokeWidth: 4, strokeColorHex: 0xef4444 },
  { btnClass: 'moodboard-draw__btn--size-thick-green', strokeWidth: 6, strokeColorHex: 0x16a34a }
];

// Маркер: yellow, green, pink (фактические цвета в UI)
const MARKER_PRESETS = [
  { btnClass: 'moodboard-draw__btn--marker-yellow', strokeColorHex: 0xfacc15 },
  { btnClass: 'moodboard-draw__btn--marker-green', strokeColorHex: 0x22c55e },
  { btnClass: 'moodboard-draw__btn--marker-pink', strokeColorHex: 0xec4899 }
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

async function getObjectCount(page) {
  return page.evaluate(() => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).length;
  });
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

/** Рисует штрих от (fromX, fromY) до (toX, toY) в координатах canvas. */
async function drawStroke(page, fromX, fromY, toX, toY, steps = 8) {
  const canvas = page.locator('.moodboard-workspace__canvas canvas');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const x0 = box.x + fromX;
  const y0 = box.y + fromY;
  const x1 = box.x + toX;
  const y1 = box.y + toY;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
  }
  await page.mouse.up();
}

/** Стирает ластиком через центр drawing-объекта. center в canvas-локальных координатах. */
async function eraseThroughObjectCenter(page, objectId) {
  const center = await getObjectCanvasCenter(page, objectId);
  expect(center).toBeTruthy();
  await eraseStroke(page, center.x - 40, center.y, center.x + 40, center.y);
}

/** Стирает ластиком: проводит от (fromX, fromY) до (toX, toY) в canvas-локальных координатах. */
async function eraseStroke(page, fromX, fromY, toX, toY, steps = 8) {
  return drawStroke(page, fromX, fromY, toX, toY, steps);
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

async function getActiveToolName(page) {
  return page.evaluate(() => {
    const core = window.moodboard?.coreMoodboard;
    return core?.toolManager?.getActiveTool?.()?.name || null;
  });
}

async function ensureDrawPopupVisible(page) {
  const popup = page.locator('.moodboard-toolbar__popup--draw');
  if (!(await popup.isVisible())) {
    await page.click('.moodboard-toolbar__button--pencil');
  }
  await expect(popup).toBeVisible();
  return popup;
}

async function getVisiblePresetActiveCount(page) {
  return page.evaluate(() => {
    const popup = document.querySelector('.moodboard-toolbar__popup--draw');
    if (!popup) return 0;
    const rows = popup.querySelectorAll('.moodboard-draw__row');
    const presetRow = rows[1];
    if (!presetRow) return 0;
    return presetRow.querySelectorAll('.moodboard-draw__btn--active').length;
  });
}

/** Открывает popup рисования и выбирает инструмент. */
async function openDrawPopupAndSelectTool(page, toolClass) {
  await ensureDrawPopupVisible(page);
  await page.click(`.moodboard-draw__grid .${toolClass}`);
}

/** Выбирает карандаш, потом preset. */
async function selectPencilPreset(page, presetBtnClass) {
  await ensureDrawPopupVisible(page);
  await page.click(`.moodboard-draw__grid .moodboard-draw__btn--pencil-tool`);
  await page.click(`.moodboard-draw__grid .${presetBtnClass}`);
}

/** Выбирает маркер, потом preset. */
async function selectMarkerPreset(page, presetBtnClass) {
  await ensureDrawPopupVisible(page);
  await page.click(`.moodboard-draw__grid .moodboard-draw__btn--marker-tool`);
  await page.click(`.moodboard-draw__grid .${presetBtnClass}`);
}

test.describe('DrawingTool E2E (draw instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('popup appears on pencil button click and contains pencil, marker, eraser', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--pencil');
    const popup = page.locator('.moodboard-toolbar__popup--draw');
    await expect(popup).toBeVisible();
    const grid = popup.locator('.moodboard-draw__grid');
    await expect(grid).toBeVisible();
    await expect(grid.locator('.moodboard-draw__btn--pencil-tool')).toBeVisible();
    await expect(grid.locator('.moodboard-draw__btn--marker-tool')).toBeVisible();
    await expect(grid.locator('.moodboard-draw__btn--eraser-tool')).toBeVisible();
    // Второй ряд — presets карандаша (по умолчанию выбран карандаш)
    await expect(grid.locator('.moodboard-draw__btn--size-thin-black')).toBeVisible();
  });

  test('draw popup stays open after canvas click while draw tool is active', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--pencil');
    const popup = page.locator('.moodboard-toolbar__popup--draw');
    await expect(popup).toBeVisible();

    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    await canvas.click();

    const activeToolAfterCanvasClick = await getActiveToolName(page);
    expect(activeToolAfterCanvasClick).toBe('draw');
    await expect(popup).toBeVisible();
  });

  test('draw popup closes on Escape when draw gets canceled', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--pencil');
    const popup = page.locator('.moodboard-toolbar__popup--draw');
    await expect(popup).toBeVisible();

    await page.keyboard.press('Escape');

    const activeToolAfterEscape = await getActiveToolName(page);
    expect(activeToolAfterEscape).toBe('select');
    await expect(popup).toBeHidden();
  });

  test('draw popup closes when selecting another tool', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--pencil');
    const popup = page.locator('.moodboard-toolbar__popup--draw');
    await expect(popup).toBeVisible();

    await page.click('.moodboard-toolbar__button--select');

    const activeToolAfterSelect = await getActiveToolName(page);
    expect(activeToolAfterSelect).toBe('select');
    await expect(popup).toBeHidden();
  });

  test('draw presets keep single active button in visible preset row', async ({ page }) => {
    await ensureDrawPopupVisible(page);

    await page.click('.moodboard-draw__grid .moodboard-draw__btn--pencil-tool');
    await page.click('.moodboard-draw__grid .moodboard-draw__btn--size-thin-black');
    expect(await getVisiblePresetActiveCount(page)).toBe(1);

    await page.click('.moodboard-draw__grid .moodboard-draw__btn--size-medium-red');
    expect(await getVisiblePresetActiveCount(page)).toBe(1);

    await page.click('.moodboard-draw__grid .moodboard-draw__btn--marker-tool');
    await page.click('.moodboard-draw__grid .moodboard-draw__btn--marker-yellow');
    expect(await getVisiblePresetActiveCount(page)).toBe(1);

    await page.click('.moodboard-draw__grid .moodboard-draw__btn--marker-pink');
    expect(await getVisiblePresetActiveCount(page)).toBe(1);
  });

  test('cursor changes to pencil when draw tool is active', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--pencil');
    await expect(page.locator('.moodboard-toolbar__popup--draw')).toBeVisible();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    await canvas.click();
    const cursor = await page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      const tm = core?.toolManager;
      const drawTool = tm?.tools?.get?.('draw') ?? tm?.registry?.get?.('draw');
      const app = drawTool?.app;
      return app?.view?.style?.cursor || '';
    });
    expect(cursor).toBeTruthy();
    expect(cursor).toMatch(/url\(|crosshair/i);
  });

  test('pencil thin-black: creates drawing with strokeWidth 2 and black color', async ({ page }) => {
    await selectPencilPreset(page, 'moodboard-draw__btn--size-thin-black');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const box = await canvas.boundingBox();
    const cx = Math.round(box.width / 2);
    const cy = Math.round(box.height / 2);
    await drawStroke(page, cx - 30, cy, cx + 30, cy);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const drawing = (board?.objects || []).find((o) => o.type === 'drawing');
        return (
          drawing &&
          drawing.properties?.mode === 'pencil' &&
          drawing.properties?.strokeWidth === 2 &&
          drawing.properties?.strokeColor === 0x111827
        );
      })
      .toBe(true);
  });

  test('pencil medium-red and thick-green: correct strokeWidth and strokeColor', async ({ page }) => {
    for (const preset of [PENCIL_PRESETS[1], PENCIL_PRESETS[2]]) {
      await selectPencilPreset(page, preset.btnClass);
      const canvas = page.locator('.moodboard-workspace__canvas canvas');
      const box = await canvas.boundingBox();
      const cx = Math.round(box.width / 2);
      const cy = Math.round(box.height / 2);
      await drawStroke(page, cx - 25, cy, cx + 25, cy);

      await expect
        .poll(async () => {
          const board = await page.evaluate(() => window.moodboard.exportBoard());
          const drawing = (board?.objects || []).find(
            (o) =>
              o.type === 'drawing' &&
              o.properties?.strokeWidth === preset.strokeWidth &&
              o.properties?.strokeColor === preset.strokeColorHex
          );
          return !!drawing;
        })
        .toBe(true);
    }
  });

  test('marker variants: yellow, green, pink create drawing with correct strokeColor', async ({ page }) => {
    for (const preset of MARKER_PRESETS) {
      await selectMarkerPreset(page, preset.btnClass);
      const canvas = page.locator('.moodboard-workspace__canvas canvas');
      const box = await canvas.boundingBox();
      const cx = Math.round(box.width / 2);
      const cy = Math.round(box.height / 2);
      await drawStroke(page, cx - 20, cy, cx + 20, cy);

      await expect
        .poll(async () => {
          const board = await page.evaluate(() => window.moodboard.exportBoard());
          const drawing = (board?.objects || []).find(
            (o) =>
              o.type === 'drawing' &&
              o.properties?.mode === 'marker' &&
              o.properties?.strokeColor === preset.strokeColorHex
          );
          return !!drawing;
        })
        .toBe(true);
    }
  });

  test('eraser: selection and icon visible', async ({ page }) => {
    await openDrawPopupAndSelectTool(page, 'moodboard-draw__btn--eraser-tool');
    const eraserBtn = page.locator('.moodboard-draw__btn--eraser-tool');
    await expect(eraserBtn).toHaveClass(/moodboard-draw__btn--active/);
    await expect(eraserBtn.locator('.draw-icon svg')).toBeVisible();
  });

  test('eraser erases pencil drawing', async ({ page }) => {
    const drawingId = await createObject(
      page,
      'drawing',
      { x: 320, y: 220 },
      {
        mode: 'pencil',
        strokeWidth: 4,
        strokeColor: 0x111827,
        points: [
          { x: 0, y: 20 },
          { x: 100, y: 20 }
        ],
        baseWidth: 100,
        baseHeight: 40,
        width: 100,
        height: 40
      }
    );
    const countBefore = await getObjectCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(1);

    await openDrawPopupAndSelectTool(page, 'moodboard-draw__btn--eraser-tool');
    await eraseThroughObjectCenter(page, drawingId);

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, drawingId);
        return obj === null;
      }, { timeout: 5000 })
      .toBe(true);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore - 1);
  });

  test('eraser erases marker drawing', async ({ page }) => {
    const drawingId = await createObject(
      page,
      'drawing',
      { x: 340, y: 240 },
      {
        mode: 'marker',
        strokeWidth: 8,
        strokeColor: 0x22c55e,
        points: [
          { x: 0, y: 30 },
          { x: 80, y: 30 }
        ],
        baseWidth: 80,
        baseHeight: 60,
        width: 80,
        height: 60
      }
    );
    const countBefore = await getObjectCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(1);

    await openDrawPopupAndSelectTool(page, 'moodboard-draw__btn--eraser-tool');
    await eraseThroughObjectCenter(page, drawingId);

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, drawingId);
        return obj === null;
      }, { timeout: 5000 })
      .toBe(true);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore - 1);
  });
});
