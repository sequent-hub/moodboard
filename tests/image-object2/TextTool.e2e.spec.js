/**
 * E2E-тесты инструмента «Текст» (text-add).
 * Проверяют добавление текста на доску, редактирование, панель свойств и трансформации.
 * Отдельные тесты проверяют историю команд: каждое действие можно отменить (Ctrl+Z) и восстановить (Ctrl+Y).
 */
import { test, expect } from '@playwright/test';

const TOOL_GET_SELECTION = 'tool:get:selection';
const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';

// Опции шрифтов/размеров/цветов из TextPropertiesPanelMapper (подмножество для тестов)
const FONT_OPTIONS = [
  'Roboto, Arial, sans-serif',
  'Oswald, Arial, sans-serif',
  '"Playfair Display", Georgia, serif',
  'Caveat, "Comic Sans MS", cursive'
];
const FONT_SIZE_OPTIONS = [12, 18, 24, 32];
const TEXT_COLOR_PRESETS = ['#000000', '#FF2D55', '#34C759'];
const BACKGROUND_PRESETS = ['transparent', '#ffff99', '#ff9999'];

/** Создаёт объект на доске через API moodboard.createObject. */
async function createObject(page, type, position, properties = {}) {
  return page.evaluate(
    ({ objectType, objectPosition, objectProperties }) => {
      return window.moodboard.createObject(objectType, objectPosition, objectProperties).id;
    },
    { objectType: type, objectPosition: position, objectProperties: properties }
  );
}

/** Возвращает данные объекта по id из экспорта доски (window.moodboard.exportBoard). */
async function getObjectById(page, id) {
  return page.evaluate((objectId) => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).find((obj) => obj.id === objectId) || null;
  }, id);
}

/** Получает текущее выделение через событие tool:get:selection. */
async function getSelection(page) {
  return page.evaluate((eventName) => {
    const req = { selection: [] };
    window.moodboard.coreMoodboard.eventBus.emit(eventName, req);
    return req.selection || [];
  }, TOOL_GET_SELECTION);
}

/** Возвращает координаты центра объекта в экранных координатах (для кликов по canvas). */
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

/** Одиночный клик по центру объекта на canvas. */
async function clickObject(page, id) {
  const center = await getObjectCanvasCenter(page, id);
  expect(center).toBeTruthy();
  const canvas = page.locator('.moodboard-workspace__canvas canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();
  await page.mouse.click(canvasBox.x + center.x, canvasBox.y + center.y);
}

/** Двойной клик по центру объекта (открывает редактор текста/записки). */
async function doubleClickObject(page, id) {
  const center = await getObjectCanvasCenter(page, id);
  expect(center).toBeTruthy();
  const canvas = page.locator('.moodboard-workspace__canvas canvas');
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();
  await page.mouse.dblclick(canvasBox.x + center.x, canvasBox.y + center.y);
}

/** Устанавливает выделение через selectTool.setSelection и обновляет ручки ресайза. */
async function setSelection(page, ids) {
  await page.evaluate((objectIds) => {
    const selectTool = window.moodboard.coreMoodboard.selectTool;
    selectTool.setSelection(objectIds);
    selectTool.updateResizeHandles();
  }, ids);
}

/**
 * Выполняет Undo (отмена последнего действия) через событие keyboard:undo.
 * Используется вместо Ctrl+Z для надёжности в headless.
 */
async function triggerUndo(page) {
  await page.evaluate((eventName) => {
    window.moodboard.coreMoodboard.eventBus.emit(eventName);
  }, EVENTS_KEYBOARD_UNDO);
}

/**
 * Выполняет Redo (восстановление отменённого действия) через событие keyboard:redo.
 * Используется вместо Ctrl+Y для надёжности в headless.
 */
async function triggerRedo(page) {
  await page.evaluate((eventName) => {
    window.moodboard.coreMoodboard.eventBus.emit(eventName);
  }, EVENTS_KEYBOARD_REDO);
}

/** Возвращает количество объектов на доске. */
async function getObjectCount(page) {
  return page.evaluate(() => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).length;
  });
}

test.describe('TextTool E2E (text-add instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('text is added to the board via text-add button', async ({ page }) => {
    // 1. Активируем инструмент «Добавить текст» — переключаемся в режим размещения
    await page.click('.moodboard-toolbar__button--text-add');

    // 2. Кликаем в центр холста — PlacementTool создаёт текстовый объект и открывает редактор
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    const clickX = canvasBox.x + canvasBox.width / 2;
    const clickY = canvasBox.y + canvasBox.height / 2;
    await page.mouse.click(clickX, clickY);

    // 3. Ждём появления textarea (editOnCreate), вводим текст и подтверждаем Enter
    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('Test text on board');
    await textarea.press('Enter');

    // 4. Проверяем, что объект появился на доске с корректным содержимым
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const textObj = (board?.objects || []).find((o) => o.type === 'text');
        return textObj?.properties?.content;
      })
      .toBe('Test text on board');
  });

  test('text is editable (double-click opens editor, changes persist)', async ({ page }) => {
    // 1. Создаём текст программно и выделяем его
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Before edit', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    // 2. Двойной клик открывает inline-редактор (TextInlineEditorController)
    await doubleClickObject(page, textId);

    // 3. Меняем текст в textarea и подтверждаем Enter
    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('After edit');
    await textarea.press('Enter');

    // 4. Проверяем, что содержимое сохранилось в properties.content
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.content;
      })
      .toBe('After edit');
  });

  test('resize handles change text width', async ({ page }) => {
    // 1. Создаём текст, выделяем его — появляются ручки ресайза
    const textId = await createObject(
      page,
      'text',
      { x: 300, y: 200 },
      { content: 'Resizable', fontSize: 18, width: 150, height: 50 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    // 2. Тянем ручку юго-восточного угла (SE) — ширина должна увеличиться
    const before = await getObjectById(page, textId);
    const handle = page.locator(`.mb-handle[data-id="${textId}"][data-dir="se"]`);
    await expect(handle).toBeVisible();
    const box = await handle.boundingBox();

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20);
    await page.mouse.up();

    // 3. Проверяем, что ширина объекта увеличилась
    await expect
      .poll(async () => {
        const after = await getObjectById(page, textId);
        return after.width > before.width;
      })
      .toBe(true);
  });

  test('font family changes in properties panel', async ({ page }) => {
    // 1. Создаём текст и выделяем — показывается панель свойств TextPropertiesPanel
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Font test', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    const panel = page.locator('.text-properties-panel');
    await expect(panel).toBeVisible({ timeout: 2000 });
    const fontSelect = panel.locator('.font-select');
    await expect(fontSelect).toBeVisible();

    // 2. Меняем шрифт в выпадающем списке .font-select
    const newFont = '"Playfair Display", Georgia, serif';
    await fontSelect.selectOption({ value: newFont });

    // 3. Проверяем, что fontFamily записался в объект
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.fontFamily;
      })
      .toBe(newFont);
  });

  test('all fonts switch in properties panel', async ({ page }) => {
    // 1. Создаём текст и выделяем
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Fonts', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    const fontSelect = page.locator('.text-properties-panel .font-select');
    await expect(fontSelect).toBeVisible({ timeout: 2000 });

    // 2. Переключаем каждый шрифт из списка и проверяем, что он применился
    for (const fontValue of FONT_OPTIONS) {
      await fontSelect.selectOption({ value: fontValue });
      await expect
        .poll(async () => {
          const obj = await getObjectById(page, textId);
          return obj?.properties?.fontFamily;
        })
        .toBe(fontValue);
    }
  });

  test('font size changes in properties panel', async ({ page }) => {
    // 1. Создаём текст и выделяем — панель с .font-size-select
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Size test', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    const sizeSelect = page.locator('.text-properties-panel .font-size-select');
    await expect(sizeSelect).toBeVisible({ timeout: 2000 });

    // 2. Выбираем размер 24px и проверяем fontSize в объекте
    await sizeSelect.selectOption({ value: '24' });
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.fontSize;
      })
      .toBe(24);
  });

  test('all font sizes change in properties panel', async ({ page }) => {
    // 1. Создаём текст и выделяем
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Sizes', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    const sizeSelect = page.locator('.text-properties-panel .font-size-select');
    await expect(sizeSelect).toBeVisible({ timeout: 2000 });

    // 2. Переключаем все размеры (12, 18, 24, 32) и проверяем каждый
    for (const size of FONT_SIZE_OPTIONS) {
      await sizeSelect.selectOption({ value: String(size) });
      await expect
        .poll(async () => {
          const obj = await getObjectById(page, textId);
          return obj?.fontSize;
        })
        .toBe(size);
    }
  });

  test('text color changes in properties panel', async ({ page }) => {
    // 1. Создаём текст и выделяем — показывается панель свойств
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Color', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    // 2. Кликаем по кнопке цвета — открывается выпадающий список пресетов
    const colorButton = page.locator('.text-properties-panel .current-color-button');
    await expect(colorButton).toBeVisible({ timeout: 2000 });
    await colorButton.click();

    // 3. Выбираем красный пресет #FF2D55
    const presetButton = page.locator('.text-properties-panel [data-color-value="#FF2D55"]').first();
    await expect(presetButton).toBeVisible();
    await presetButton.click();

    // 4. Проверяем, что цвет (color) сохранился в объекте (верхний уровень или properties)
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.color || obj?.properties?.color;
      })
      .toBe('#FF2D55');
  });

  test('background color changes in properties panel', async ({ page }) => {
    // 1. Создаём текст и выделяем
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Background', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    // 2. Кликаем по кнопке фона — открывается выпадающий список
    const bgButton = page.locator('.text-properties-panel .current-bgcolor-button');
    await expect(bgButton).toBeVisible({ timeout: 2000 });
    await bgButton.click();

    // 3. Выбираем жёлтый фон «Желтый» (#ffff99)
    const yellowPreset = page.locator('.text-properties-panel [data-color-value="#ffff99"]').first();
    await expect(yellowPreset).toBeVisible();
    await yellowPreset.click();

    // 4. Проверяем, что backgroundColor сохранился в объекте
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.backgroundColor ?? obj?.properties?.backgroundColor;
      })
      .toBe('#ffff99');
  });

  test('text can be rotated with rotate handle', async ({ page }) => {
    // 1. Создаём текст и выделяем — появляется ручка поворота .mb-rotate-handle
    const textId = await createObject(
      page,
      'text',
      { x: 360, y: 210 },
      { content: 'Rotate me', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await expect.poll(() => getSelection(page)).toEqual([textId]);

    // 2. Запоминаем начальный угол и тянем ручку поворота вверх-вправо
    const before = await getObjectById(page, textId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${textId}"]`);
    await expect(rotateHandle).toBeVisible();

    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, textId);

    const fromX = handleBox.x + handleBox.width / 2;
    const fromY = handleBox.y + handleBox.height / 2;
    const toX = canvasBox.x + center.x + 80;
    const toY = canvasBox.y + center.y - 60;

    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY);
    await page.mouse.up();

    // 3. Проверяем, что угол поворота (transform.rotation) изменился
    await expect
      .poll(async () => {
        const after = await getObjectById(page, textId);
        const beforeRot = before.transform?.rotation || 0;
        const afterRot = after.transform?.rotation || 0;
        return Math.abs(afterRot - beforeRot);
      })
      .toBeGreaterThan(0.1);
  });

  // === Тесты истории команд (Undo/Redo) ===
  // Проверяем, что действия можно отменить (Ctrl+Z) и восстановить (Ctrl+Y).
  // Тесты с test.skip — для действий, где команды в HistoryManager ещё не реализованы.

  test('undo/redo: добавление текста на доску можно отменить и восстановить', async ({ page }) => {
    // 1. Добавляем текст через text-add (CreateObjectCommand в истории)
    await page.click('.moodboard-toolbar__button--text-add');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('Undo test');
    await textarea.press('Enter');

    // 2. Проверяем, что объект создан
    await expect.poll(() => getObjectCount(page)).toBe(1);

    // 3. Undo — команда CreateObject отменяется, объект удаляется
    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(0);

    // 4. Redo — CreateObject выполняется повторно, объект восстанавливается
    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(1);
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const textObj = (board?.objects || []).find((o) => o.type === 'text');
        return textObj?.properties?.content;
      })
      .toBe('Undo test');
  });

  test('undo/redo: редактирование текста можно отменить и восстановить', async ({ page }) => {
    // 1. Создаём текст и редактируем его
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Original', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    await doubleClickObject(page, textId);
    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible({ timeout: 3000 });
    await textarea.fill('Edited');
    await textarea.press('Enter');

    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.content;
      })
      .toBe('Edited');

    // 2. Undo — содержимое должно вернуться к «Original»
    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.content;
      })
      .toBe('Original');

    // 3. Redo — снова «Edited»
    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.content;
      })
      .toBe('Edited');
  });

  test('undo/redo: ресайз текста можно отменить и восстановить', async ({ page }) => {
    // 1. Создаём текст и ресайзим (ResizeObjectCommand в истории)
    const textId = await createObject(
      page,
      'text',
      { x: 300, y: 200 },
      { content: 'Resize', fontSize: 18, width: 150, height: 50 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    const before = await getObjectById(page, textId);
    const handle = page.locator(`.mb-handle[data-id="${textId}"][data-dir="se"]`);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20);
    await page.mouse.up();

    const afterResize = await getObjectById(page, textId);
    expect(afterResize.width).toBeGreaterThan(before.width);

    // 2. Undo — ResizeObject отменяется, ширина возвращается к исходной
    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return Math.round(obj?.width || 0);
      })
      .toBe(before.width);

    // 3. Redo — ResizeObject выполняется повторно, ширина восстанавливается
    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.width;
      })
      .toBe(afterResize.width);
  });

  test('undo/redo: смена шрифта в панели свойств можно отменить и восстановить', async ({ page }) => {
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Font', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    const defaultFont = 'Roboto, Arial, sans-serif';
    const newFont = 'Caveat, "Comic Sans MS", cursive';

    const fontSelect = page.locator('.text-properties-panel .font-select');
    await expect(fontSelect).toBeVisible({ timeout: 2000 });
    await fontSelect.selectOption({ value: newFont });
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.fontFamily;
      })
      .toBe(newFont);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.fontFamily;
      })
      .toBe(defaultFont);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.properties?.fontFamily;
      })
      .toBe(newFont);
  });

  test('undo/redo: смена размера шрифта можно отменить и восстановить', async ({ page }) => {
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Size', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    const sizeSelect = page.locator('.text-properties-panel .font-size-select');
    await expect(sizeSelect).toBeVisible({ timeout: 2000 });
    await sizeSelect.selectOption({ value: '24' });
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.fontSize;
      })
      .toBe(24);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.fontSize;
      })
      .toBe(18);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.fontSize;
      })
      .toBe(24);
  });

  test('undo/redo: смена цвета текста можно отменить и восстановить', async ({ page }) => {
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Color', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    const colorButton = page.locator('.text-properties-panel .current-color-button');
    await colorButton.click();
    await page.locator('.text-properties-panel [data-color-value="#FF2D55"]').first().click();
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.color || obj?.properties?.color;
      })
      .toBe('#FF2D55');

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.color || obj?.properties?.color;
      })
      .toBe('#000000');

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.color || obj?.properties?.color;
      })
      .toBe('#FF2D55');
  });

  test('undo/redo: смена фона текста можно отменить и восстановить', async ({ page }) => {
    const textId = await createObject(
      page,
      'text',
      { x: 320, y: 220 },
      { content: 'Bg', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    const bgButton = page.locator('.text-properties-panel .current-bgcolor-button');
    await bgButton.click();
    await page.locator('.text-properties-panel [data-color-value="#ffff99"]').first().click();
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.backgroundColor ?? obj?.properties?.backgroundColor;
      })
      .toBe('#ffff99');

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.backgroundColor ?? obj?.properties?.backgroundColor;
      })
      .toBe('transparent');

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return obj?.backgroundColor ?? obj?.properties?.backgroundColor;
      })
      .toBe('#ffff99');
  });

  test('undo/redo: поворот текста можно отменить и восстановить', async ({ page }) => {
    // 1. Создаём текст и поворачиваем (RotateObjectCommand в истории)
    const textId = await createObject(
      page,
      'text',
      { x: 360, y: 210 },
      { content: 'Rotate', fontSize: 18, width: 180, height: 60 }
    );
    await page.click('.moodboard-toolbar__button--select');
    await setSelection(page, [textId]);
    const before = await getObjectById(page, textId);
    const rotateHandle = page.locator(`.mb-rotate-handle[data-id="${textId}"]`);
    await expect(rotateHandle).toBeVisible();
    const handleBox = await rotateHandle.boundingBox();
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    const center = await getObjectCanvasCenter(page, textId);

    // Тянем ручку поворота вверх-вправо (как в SelectTool.basic-mechanics)
    const fromX = handleBox.x + handleBox.width / 2;
    const fromY = handleBox.y + handleBox.height / 2;
    const toX = canvasBox.x + center.x + 130;
    const toY = canvasBox.y + center.y - 80;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(toX, toY);
    await page.mouse.up();

    // Ждём, пока rotation попадёт в state (RotateObjectCommand подгружается асинхронно)
    const beforeRot = before.transform?.rotation ?? 0;
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        const r = obj?.transform?.rotation ?? 0;
        return Math.abs(r - beforeRot);
      })
      .toBeGreaterThan(0.1);

    const afterRotate = await getObjectById(page, textId);
    const afterRot = afterRotate.transform?.rotation ?? 0;

    // 4. Undo — RotateObject отменяется, угол возвращается к исходному
    await triggerUndo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return Math.abs((obj?.transform?.rotation || 0) - beforeRot);
      })
      .toBeLessThan(0.01);

    // 5. Redo — RotateObject выполняется повторно, угол восстанавливается
    await triggerRedo(page);
    await expect
      .poll(async () => {
        const obj = await getObjectById(page, textId);
        return Math.abs((obj?.transform?.rotation || 0) - afterRot);
      })
      .toBeLessThan(0.01);
  });
});
