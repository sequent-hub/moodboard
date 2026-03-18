/**
 * E2E-тесты инструмента «Интеллект-карта» (mindmap-add).
 * Проверяют включение режима размещения, добавление объекта и undo/redo.
 */
import { test, expect } from '@playwright/test';

const EVENTS_KEYBOARD_UNDO = 'keyboard:undo';
const EVENTS_KEYBOARD_REDO = 'keyboard:redo';

async function getObjectCount(page) {
  return page.evaluate(() => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).length;
  });
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

async function getMindmapObject(page) {
  return page.evaluate(() => {
    const board = window.moodboard.exportBoard();
    return (board?.objects || []).find((o) => o.type === 'mindmap') || null;
  });
}

test.describe('MindmapTool E2E (mindmap-add instrument)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-moodboard.html');
    await expect(page.locator('.moodboard-toolbar')).toBeVisible();
    await expect(page.locator('.moodboard-workspace__canvas canvas')).toBeVisible();
  });

  test('mindmap button activates place mode and shows ghost', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const tm = window.moodboard?.coreMoodboard?.toolManager;
            const activeTool = tm?.getActiveTool?.();
            const placeTool = tm?.tools?.get?.('place') ?? tm?.registry?.get?.('place');
            return {
              activeToolName: activeTool?.name || null,
              hasGhost: !!placeTool?.ghostContainer,
              pendingType: placeTool?.pending?.type || null
            };
          }),
        { timeout: 5000 }
      )
      .toEqual({
        activeToolName: 'place',
        hasGhost: true,
        pendingType: 'mindmap'
      });
  });

  test('mindmap object is added at click position and supports undo/redo', async ({ page }) => {
    const countBefore = await getObjectCount(page);

    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    const clickLocalX = canvasBox.width / 2;
    const clickLocalY = canvasBox.height / 2;
    await page.mouse.click(canvasBox.x + clickLocalX, canvasBox.y + clickLocalY);

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const core = window.moodboard?.coreMoodboard;
          if (!core) return null;
          const board = window.moodboard.exportBoard();
          const object = (board?.objects || []).find((o) => o.type === 'mindmap');
          if (!object?.id) return null;
          const pixiObject = core.pixi.objects.get(object.id);
          if (!pixiObject) return null;
          const world = core.pixi.worldLayer || core.pixi.app.stage;
          const p = world.toGlobal({ x: pixiObject.x, y: pixiObject.y });
          return { x: p.x, y: p.y };
        });
      })
      .toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number)
      });

    await expect
      .poll(async () => {
        const center = await page.evaluate(() => {
          const core = window.moodboard?.coreMoodboard;
          if (!core) return null;
          const board = window.moodboard.exportBoard();
          const object = (board?.objects || []).find((o) => o.type === 'mindmap');
          if (!object?.id) return null;
          const pixiObject = core.pixi.objects.get(object.id);
          if (!pixiObject) return null;
          const world = core.pixi.worldLayer || core.pixi.app.stage;
          const p = world.toGlobal({ x: pixiObject.x, y: pixiObject.y });
          return { x: p.x, y: p.y };
        });
        if (!center) return null;
        const dx = Math.abs(center.x - clickLocalX);
        const dy = Math.abs(center.y - clickLocalY);
        return dx <= 1 && dy <= 1;
      })
      .toBe(true);

    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);

    await triggerUndo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore);

    await triggerRedo(page);
    await expect.poll(() => getObjectCount(page)).toBe(countBefore + 1);
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).some((o) => o.type === 'mindmap');
      })
      .toBe(true);
  });

  test('mindmap text enters edit mode on click and closes on outside click', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);

    await expect
      .poll(async () => {
        const obj = await getMindmapObject(page);
        return !!obj?.id;
      })
      .toBe(true);
    const mindmapObject = await getMindmapObject(page);
    const mindmapId = mindmapObject.id;
    expect((mindmapObject?.properties?.content || '')).toBe('');

    const textBoxEl = page.locator(`.mb-text--mindmap[data-id="${mindmapId}"]`);
    const textEl = page.locator(`.mb-text--mindmap[data-id="${mindmapId}"] .mb-text--mindmap-content`);
    await expect(textBoxEl).toBeVisible();
    await expect(textEl).toBeVisible();
    await expect(textEl).toHaveText('Напишите что-нибудь');

    const staticTextMetrics = await page.evaluate((objectId) => {
      const el = document.querySelector(`.mb-text--mindmap[data-id="${objectId}"]`);
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        left: parseFloat(el.style.left || '0'),
        top: parseFloat(el.style.top || '0'),
        fontSize: parseFloat(style.fontSize || '0'),
      };
    }, mindmapId);
    expect(staticTextMetrics).toBeTruthy();

    const textBox = await textBoxEl.boundingBox();
    expect(textBox).toBeTruthy();
    await page.mouse.click(
      textBox.x + 2,
      textBox.y + 2
    );
    await expect(page.locator('.moodboard-text-input')).toHaveCount(0);

    const textContentBox = await textEl.boundingBox();
    expect(textContentBox).toBeTruthy();
    await page.mouse.click(
      textContentBox.x + textContentBox.width * 0.5,
      textContentBox.y + textContentBox.height * 0.5
    );

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          if (!ta) return null;
          const value = typeof ta.value === 'string' ? ta.value : '';
          const caret = typeof ta.selectionStart === 'number' ? ta.selectionStart : null;
          if (caret === null) return null;
          return {
            caret,
            len: value.length
          };
        });
      })
      .toMatchObject({
        caret: expect.any(Number),
        len: expect.any(Number),
      });

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          if (!ta) return false;
          const caret = typeof ta.selectionStart === 'number' ? ta.selectionStart : -1;
          return caret === 0;
        });
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const editorMetrics = await page.evaluate(() => {
          const wrapper = document.querySelector('.moodboard-text-editor');
          const textareaEl = document.querySelector('.moodboard-text-input');
          if (!wrapper || !textareaEl) return null;
          const style = window.getComputedStyle(textareaEl);
          return {
            left: parseFloat(wrapper.style.left || '0'),
            top: parseFloat(wrapper.style.top || '0'),
            fontSize: parseFloat(style.fontSize || '0'),
          };
        });
        if (!editorMetrics || !staticTextMetrics) return false;
        const dx = Math.abs(editorMetrics.left - staticTextMetrics.left);
        const dy = Math.abs(editorMetrics.top - staticTextMetrics.top);
        const df = Math.abs(editorMetrics.fontSize - staticTextMetrics.fontSize);
        return dx <= 1 && dy <= 1 && df <= 1;
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const centerMetrics = await page.evaluate(() => {
          const staticEl = document.querySelector('.mb-text--mindmap');
          const textareaEl = document.querySelector('.moodboard-text-input');
          if (!staticEl || !textareaEl) return null;
          const staticRect = staticEl.getBoundingClientRect();
          const textareaRect = textareaEl.getBoundingClientRect();
          return {
            staticCenterY: staticRect.top + staticRect.height / 2,
            editorCenterY: textareaRect.top + textareaRect.height / 2,
          };
        });
        if (!centerMetrics) return false;
        const dyCenter = Math.abs(centerMetrics.staticCenterY - centerMetrics.editorCenterY);
        return dyCenter <= 1;
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const lineMetrics = await page.evaluate(() => {
          const staticEl = document.querySelector('.mb-text--mindmap');
          const textareaEl = document.querySelector('.moodboard-text-input');
          if (!staticEl || !textareaEl) return null;
          const staticRect = staticEl.getBoundingClientRect();
          const textareaRect = textareaEl.getBoundingClientRect();
          const style = window.getComputedStyle(textareaEl);
          const lineHeight = parseFloat(style.lineHeight || '0');
          const paddingTop = parseFloat(style.paddingTop || '0');
          if (!Number.isFinite(lineHeight) || lineHeight <= 0) return null;
          const staticCenterY = staticRect.top + staticRect.height / 2;
          const lineCenterY = textareaRect.top + paddingTop + lineHeight / 2;
          return { staticCenterY, lineCenterY };
        });
        if (!lineMetrics) return false;
        const dy = Math.abs(lineMetrics.staticCenterY - lineMetrics.lineCenterY);
        return dy <= 1;
      })
      .toBe(true);

    await textarea.fill('Обновленный текст');

    // Клик мимо текста закрывает редактор.
    await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
    await expect(textarea).toHaveCount(0);

    await expect
      .poll(async () => {
        const obj = await getMindmapObject(page);
        return obj?.properties?.content || '';
      })
      .toBe('Обновленный текст');
  });
});
