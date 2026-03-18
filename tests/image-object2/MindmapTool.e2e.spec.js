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
    expect(mindmapObject).toBeTruthy();
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

  test('mindmap capsule width adapts while typing and keeps horizontal paddings', async ({ page }) => {
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
    const initialWidth = Math.round(mindmapObject.width || 0);
    expect(initialWidth).toBeGreaterThan(0);

    const textEl = page.locator(`.mb-text--mindmap[data-id="${mindmapId}"] .mb-text--mindmap-content`);
    const textContentBox = await textEl.boundingBox();
    expect(textContentBox).toBeTruthy();
    await page.mouse.click(
      textContentBox.x + textContentBox.width * 0.5,
      textContentBox.y + textContentBox.height * 0.5
    );

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();

    await textarea.fill('А');

    await expect
      .poll(async () => {
        const obj = await getMindmapObject(page);
        const width = Math.round(obj?.width || 0);
        return width < initialWidth;
      })
      .toBe(true);

    const widthAfterFirstChar = Math.round((await getMindmapObject(page))?.width || 0);
    expect(widthAfterFirstChar).toBeGreaterThan(0);

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          if (!ta) return null;
          const cs = window.getComputedStyle(ta);
          const pl = parseFloat(cs.paddingLeft || '0');
          const pr = parseFloat(cs.paddingRight || '0');
          if (!Number.isFinite(pl) || !Number.isFinite(pr)) return null;
          return { pl, pr };
        });
      })
      .toMatchObject({
        pl: expect.any(Number),
        pr: expect.any(Number),
      });

    const paddingState = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      if (!ta) return null;
      const cs = window.getComputedStyle(ta);
      return {
        pl: Math.round(parseFloat(cs.paddingLeft || '0')),
        pr: Math.round(parseFloat(cs.paddingRight || '0')),
      };
    });
    expect(paddingState).toBeTruthy();
    expect(paddingState.pl).toBe(paddingState.pr);

    await textarea.fill('Очень длинный текст для проверки резиновой ширины капсулы mindmap');

    await expect
      .poll(async () => {
        const obj = await getMindmapObject(page);
        const width = Math.round(obj?.width || 0);
        return width > widthAfterFirstChar;
      })
      .toBe(true);
  });

  test('mindmap enforces max 50 chars per line and keeps same line breaks in display mode', async ({ page }) => {
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
    expect(mindmapObject).toBeTruthy();
    const mindmapId = mindmapObject.id;

    const textEl = page.locator(`.mb-text--mindmap[data-id="${mindmapId}"] .mb-text--mindmap-content`);
    const textContentBox = await textEl.boundingBox();
    expect(textContentBox).toBeTruthy();
    await page.mouse.click(
      textContentBox.x + textContentBox.width * 0.5,
      textContentBox.y + textContentBox.height * 0.5
    );

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();

    const longLine = '1234567890'.repeat(6); // 60 chars
    await textarea.fill(longLine);

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          if (!ta) return null;
          const lines = String(ta.value || '').split('\n');
          return lines.every((line) => line.length <= 50);
        });
      })
      .toBe(true);

    const editorValue = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      return ta ? String(ta.value || '') : '';
    });
    const editorLines = editorValue.split('\n');
    expect(editorLines.length).toBeGreaterThan(1);
    expect(editorLines.every((line) => line.length <= 50)).toBe(true);

    await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
    await expect(textarea).toHaveCount(0);

    await expect
      .poll(async () => {
        return page.evaluate((objectId) => {
          const board = window.moodboard.exportBoard();
          const obj = (board?.objects || []).find((o) => o.id === objectId);
          const textNode = document.querySelector(`.mb-text--mindmap[data-id="${objectId}"] .mb-text--mindmap-content`);
          if (!obj || !textNode) return null;
          const saved = String(obj.properties?.content || '');
          const shown = String(textNode.textContent || '');
          const savedLines = saved.split('\n');
          const shownLines = shown.split('\n');
          return {
            saved,
            shown,
            savedLinesLen: savedLines.length,
            shownLinesLen: shownLines.length,
            savedValid: savedLines.every((line) => line.length <= 50),
            shownValid: shownLines.every((line) => line.length <= 50),
          };
        }, mindmapId);
      })
      .toMatchObject({
        saved: editorValue,
        shown: editorValue,
        savedLinesLen: editorLines.length,
        shownLinesLen: editorLines.length,
        savedValid: true,
        shownValid: true,
      });
  });

  test('mindmap capsule height grows with each additional line', async ({ page }) => {
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
    expect(mindmapObject).toBeTruthy();
    const mindmapId = mindmapObject.id;
    const initialHeight = Math.round(mindmapObject.height || 0);
    expect(initialHeight).toBeGreaterThan(0);

    const textEl = page.locator(`.mb-text--mindmap[data-id="${mindmapId}"] .mb-text--mindmap-content`);
    const textContentBox = await textEl.boundingBox();
    expect(textContentBox).toBeTruthy();
    await page.mouse.click(
      textContentBox.x + textContentBox.width * 0.5,
      textContentBox.y + textContentBox.height * 0.5
    );

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();

    await textarea.fill('x'.repeat(50)); // 1 line
    const firstLineTop = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      const rect = ta?.getBoundingClientRect();
      return rect ? rect.top : null;
    });
    expect(firstLineTop).not.toBeNull();

    await textarea.fill('x'.repeat(60)); // 2 lines by 50-char rule
    await expect
      .poll(async () => {
        const obj = await getMindmapObject(page);
        return Math.round(obj?.height || 0) > initialHeight;
      })
      .toBe(true);
    const heightTwoLines = Math.round((await getMindmapObject(page))?.height || 0);
    const secondLineTop = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      const rect = ta?.getBoundingClientRect();
      return rect ? rect.top : null;
    });
    expect(secondLineTop).not.toBeNull();
    expect(Math.abs(secondLineTop - firstLineTop)).toBeLessThanOrEqual(1);

    await textarea.fill('x'.repeat(120)); // 3 lines by 50-char rule
    await expect
      .poll(async () => {
        const obj = await getMindmapObject(page);
        return Math.round(obj?.height || 0) > heightTwoLines;
      })
      .toBe(true);
  });

  test('mindmap keeps same font size after leaving edit mode', async ({ page }) => {
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
    expect(mindmapObject).toBeTruthy();
    const mindmapId = mindmapObject.id;

    const textEl = page.locator(`.mb-text--mindmap[data-id="${mindmapId}"] .mb-text--mindmap-content`);
    const textContentBox = await textEl.boundingBox();
    expect(textContentBox).toBeTruthy();
    await page.mouse.click(
      textContentBox.x + textContentBox.width * 0.5,
      textContentBox.y + textContentBox.height * 0.5
    );

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();

    await textarea.fill('1234567890'.repeat(6));

    const editorFontSize = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      if (!ta) return null;
      const cs = window.getComputedStyle(ta);
      return parseFloat(cs.fontSize || '0');
    });
    expect(editorFontSize).toBeTruthy();

    await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
    await expect(textarea).toHaveCount(0);

    await expect
      .poll(async () => {
        return page.evaluate((objectId) => {
          const el = document.querySelector(`.mb-text--mindmap[data-id="${objectId}"]`);
          if (!el) return null;
          const cs = window.getComputedStyle(el);
          return parseFloat(cs.fontSize || '0');
        }, mindmapId);
      })
      .toBeTruthy();

    const staticFontSize = await page.evaluate((objectId) => {
      const el = document.querySelector(`.mb-text--mindmap[data-id="${objectId}"]`);
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return parseFloat(cs.fontSize || '0');
    }, mindmapId);
    expect(staticFontSize).toBeTruthy();
    expect(Math.abs(staticFontSize - editorFontSize)).toBeLessThanOrEqual(1);
  });

  test('mindmap keeps multiline text visible when switching to edit mode', async ({ page }) => {
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

    const textEl = page.locator('.mb-text--mindmap-content').first();
    const textContentBox = await textEl.boundingBox();
    expect(textContentBox).toBeTruthy();
    await page.mouse.click(
      textContentBox.x + textContentBox.width * 0.5,
      textContentBox.y + textContentBox.height * 0.5
    );

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();
    await textarea.fill('1234567890'.repeat(6)); // force 2 lines by 50-char rule

    const metricsBeforeClose = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      if (!ta) return null;
      const lineCount = String(ta.value || '').split('\n').length;
      return {
        lineCount,
        scrollHeight: ta.scrollHeight,
      };
    });
    expect(metricsBeforeClose).toBeTruthy();
    expect(metricsBeforeClose.lineCount).toBeGreaterThan(1);

    await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
    await expect(textarea).toHaveCount(0);

    const textContentBox2 = await textEl.boundingBox();
    expect(textContentBox2).toBeTruthy();
    await page.mouse.click(
      textContentBox2.x + textContentBox2.width * 0.5,
      textContentBox2.y + textContentBox2.height * 0.5
    );
    await expect(textarea).toBeVisible();

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          if (!ta) return null;
          const lineCount = String(ta.value || '').split('\n').length;
          return {
            lineCount,
            clientHeight: ta.clientHeight,
            scrollHeight: ta.scrollHeight,
          };
        });
      })
      .toMatchObject({
        lineCount: expect.any(Number),
        clientHeight: expect.any(Number),
        scrollHeight: expect.any(Number),
      });

    const metricsOnReopen = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      if (!ta) return null;
      return {
        lineCount: String(ta.value || '').split('\n').length,
        clientHeight: ta.clientHeight,
        scrollHeight: ta.scrollHeight,
      };
    });
    expect(metricsOnReopen).toBeTruthy();
    expect(metricsOnReopen.lineCount).toBeGreaterThan(1);
    expect(metricsOnReopen.clientHeight).toBeGreaterThanOrEqual(metricsOnReopen.scrollHeight - 1);
  });

  test('mindmap repeated edits do not accumulate extra height jump', async ({ page }) => {
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

    const textEl = page.locator('.mb-text--mindmap-content').first();
    const clickText = async () => {
      const box = await textEl.boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    };
    const closeEditor = async () => {
      await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
      await expect(page.locator('.moodboard-text-input')).toHaveCount(0);
    };

    await clickText();
    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();
    await textarea.fill('1234567890'.repeat(6)); // 2 lines
    await closeEditor();

    const h2 = Math.round((await getMindmapObject(page))?.height || 0);
    expect(h2).toBeGreaterThan(0);

    await clickText();
    await expect(textarea).toBeVisible();
    await textarea.type('A'); // should add one line step
    const h3 = Math.round((await getMindmapObject(page))?.height || 0);
    const d1 = h3 - h2;
    expect(d1).toBeGreaterThanOrEqual(0);
    expect(d1).toBeLessThanOrEqual(30);
    await closeEditor();

    await clickText();
    await expect(textarea).toBeVisible();
    await textarea.type('B'); // should add one more line step, not double jump
    const h4 = Math.round((await getMindmapObject(page))?.height || 0);
    const d2 = h4 - h3;
    expect(d2).toBeGreaterThanOrEqual(0);
    expect(d2).toBeLessThanOrEqual(30);
  });

  test('mindmap places caret by click for non-empty text and at start for placeholder', async ({ page }) => {
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

    const textEl = page.locator('.mb-text--mindmap-content').first();
    const textBox = await textEl.boundingBox();
    expect(textBox).toBeTruthy();

    // Placeholder case: caret must stay at start.
    await page.mouse.click(textBox.x + textBox.width * 0.5, textBox.y + textBox.height * 0.5);
    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          return ta ? ta.selectionStart : null;
        });
      })
      .toBe(0);

    // Save non-empty single-line text.
    await textarea.fill('0123456789');
    await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20);
    await expect(textarea).toHaveCount(0);

    const textBox2 = await textEl.boundingBox();
    expect(textBox2).toBeTruthy();

    // Click near end: caret should be near end, not zero.
    await page.mouse.click(textBox2.x + textBox2.width * 0.92, textBox2.y + textBox2.height * 0.5);
    await expect(textarea).toBeVisible();
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          if (!ta) return null;
          return ta.selectionStart;
        });
      })
      .toBeGreaterThanOrEqual(7);
    const nearEndCaret = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      if (!ta) return null;
      return { caret: ta.selectionStart, len: ta.value.length };
    });
    expect(nearEndCaret).toBeTruthy();
    expect(nearEndCaret.len).toBe(10);
    expect(nearEndCaret.caret).toBeGreaterThan(0);
    expect(nearEndCaret.caret).toBeGreaterThanOrEqual(7);

    await page.mouse.click(canvasBox.x + 24, canvasBox.y + 24);
    await expect(textarea).toHaveCount(0);

    // Click near start: caret should move close to start.
    const textBox3 = await textEl.boundingBox();
    expect(textBox3).toBeTruthy();
    await page.mouse.click(textBox3.x + textBox3.width * 0.08, textBox3.y + textBox3.height * 0.5);
    await expect(textarea).toBeVisible();
    const nearStartLimit = nearEndCaret ? Math.max(0, nearEndCaret.caret - 4) : 3;
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const ta = document.querySelector('.moodboard-text-input');
          if (!ta) return null;
          return ta.selectionStart;
        });
      })
      .toBeLessThanOrEqual(nearStartLimit);
    const nearStartCaret = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      if (!ta) return null;
      return { caret: ta.selectionStart, len: ta.value.length };
    });
    expect(nearStartCaret).toBeTruthy();
    expect(nearStartCaret.len).toBe(10);
    expect(nearStartCaret.caret).toBeLessThanOrEqual(3);
  });

  test('mindmap mid-line edits reflow text without one-char cascade lines', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);

    const textEl = page.locator('.mb-text--mindmap-content').first();
    const textBox = await textEl.boundingBox();
    expect(textBox).toBeTruthy();
    await page.mouse.click(textBox.x + textBox.width * 0.5, textBox.y + textBox.height * 0.5);

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();
    await textarea.fill('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890'); // 62 chars
    await page.mouse.click(canvasBox.x + 24, canvasBox.y + 24);
    await expect(textarea).toHaveCount(0);

    const textBox2 = await textEl.boundingBox();
    expect(textBox2).toBeTruthy();
    await page.mouse.click(textBox2.x + textBox2.width * 0.22, textBox2.y + textBox2.height * 0.5);
    await expect(textarea).toBeVisible();
    await page.keyboard.type('XYZ');

    const state = await page.evaluate(() => {
      const ta = document.querySelector('.moodboard-text-input');
      if (!ta) return null;
      const value = String(ta.value || '');
      const lines = value.split('\n');
      const plain = value.replace(/\n/g, '');
      return {
        lines,
        lineCount: lines.length,
        plainLen: plain.length,
        maxLine: Math.max(...lines.map((l) => l.length)),
        minLine: Math.min(...lines.map((l) => l.length)),
      };
    });
    expect(state).toBeTruthy();
    expect(state.maxLine).toBeLessThanOrEqual(50);
    expect(state.lineCount).toBe(Math.ceil(state.plainLen / 50));
    expect(state.minLine).toBeGreaterThan(1);
  });
});
