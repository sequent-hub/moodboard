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

  test('mindmap auto-focuses editor on create and closes on outside click', async ({ page }) => {
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
    await expect(textBoxEl).toHaveCount(1);
    await expect(textEl).toBeHidden();
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

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();
    await expect(page.locator('.mb-mindmap-side-btn[data-side="left"]')).toBeVisible();
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();

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

  test('mindmap child edit mode keeps add buttons visible', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, root.id);

    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();

    const child = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      return nodes.find((o) => o.id !== rootId) || null;
    }, root.id);
    expect(child?.id).toBeTruthy();

    const childText = page.locator(`.mb-text--mindmap[data-id="${child.id}"] .mb-text--mindmap-content`);
    const childTextBox = await childText.boundingBox();
    expect(childTextBox).toBeTruthy();
    await page.mouse.click(
      childTextBox.x + childTextBox.width * 0.5,
      childTextBox.y + childTextBox.height * 0.5
    );

    await expect(page.locator('.moodboard-text-input')).toBeVisible();
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();

    const childBeforeType = await page.evaluate((childId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === childId) || null;
      const ta = document.querySelector('.moodboard-text-input');
      const rect = ta?.getBoundingClientRect();
      return {
        height: Math.round(Number(node?.height || node?.properties?.height || 0)),
        top: rect ? rect.top : null,
      };
    }, child.id);
    expect(childBeforeType?.height).toBeGreaterThan(0);
    expect(childBeforeType?.top).not.toBeNull();

    await page.locator('.moodboard-text-input').fill('A');

    await expect
      .poll(async () => {
        return page.evaluate(({ childId, beforeTop, beforeHeight }) => {
          const board = window.moodboard.exportBoard();
          const node = (board?.objects || []).find((o) => o.id === childId) || null;
          const currentHeight = Math.round(Number(node?.height || node?.properties?.height || 0));
          const ta = document.querySelector('.moodboard-text-input');
          const rect = ta?.getBoundingClientRect();
          if (!rect || currentHeight <= 0) return false;
          const topDelta = Math.abs(rect.top - beforeTop);
          const heightDelta = Math.abs(currentHeight - beforeHeight);
          return topDelta <= 1 && heightDelta <= 1;
        }, {
          childId: child.id,
          beforeTop: childBeforeType.top,
          beforeHeight: childBeforeType.height,
        });
      })
      .toBe(true);
  });

  test('mindmap active editor follows child after bottom-branch relayout', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, root.id);

    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();

    const child = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      return nodes.find((o) => o.id !== rootId) || null;
    }, root.id);
    expect(child?.id).toBeTruthy();

    const childText = page.locator(`.mb-text--mindmap[data-id="${child.id}"] .mb-text--mindmap-content`);
    const childTextBox = await childText.boundingBox();
    expect(childTextBox).toBeTruthy();
    await page.mouse.click(
      childTextBox.x + childTextBox.width * 0.5,
      childTextBox.y + childTextBox.height * 0.5
    );
    await expect(page.locator('.moodboard-text-input')).toBeVisible();
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();

    const getEditorDelta = async () => page.evaluate((childId) => {
      const wrapper = document.querySelector('.moodboard-text-editor');
      const staticEl = document.querySelector(`.mb-text--mindmap[data-id="${childId}"]`);
      if (!wrapper || !staticEl) return null;
      const w = wrapper.getBoundingClientRect();
      const s = staticEl.getBoundingClientRect();
      return {
        dx: Math.abs(w.left - s.left),
        dy: Math.abs(w.top - s.top),
      };
    }, child.id);

    const before = await getEditorDelta();
    expect(before).toBeTruthy();
    expect(before.dx).toBeLessThanOrEqual(1);
    expect(before.dy).toBeLessThanOrEqual(1);

    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(3);

    await expect
      .poll(async () => {
        const delta = await getEditorDelta();
        if (!delta) return false;
        return delta.dx <= 1 && delta.dy <= 1;
      })
      .toBe(true);
  });

  test('mindmap text keeps horizontal alignment inside capsule on zoom', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const mindmap = await expect
      .poll(async () => getMindmapObject(page))
      .toMatchObject({ id: expect.any(String) });
    const object = await getMindmapObject(page);
    expect(object?.id).toBeTruthy();

    const getRatio = async () => page.evaluate((objectId) => {
      const host = document.querySelector(`.mb-text--mindmap[data-id="${objectId}"]`);
      const content = document.querySelector(`.mb-text--mindmap[data-id="${objectId}"] .mb-text--mindmap-content`);
      const core = window.moodboard?.coreMoodboard;
      if (!host || !content || !core) return null;
      const hostRect = host.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const worldScale = core?.pixi?.worldLayer?.scale?.x || 1;
      if (!hostRect.width) return null;
      return {
        ratio: (contentRect.left - hostRect.left) / hostRect.width,
        worldScale,
      };
    }, object.id);

    const before = await getRatio();
    expect(before).toBeTruthy();

    await page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('ui:zoom:in');
      core.eventBus.emit('ui:zoom:in');
    });

    await expect
      .poll(async () => {
        const next = await getRatio();
        if (!next || !before) return false;
        return next.worldScale > before.worldScale;
      })
      .toBe(true);

    const after = await getRatio();
    expect(after).toBeTruthy();
    expect(Math.abs(after.ratio - before.ratio)).toBeLessThanOrEqual(0.03);
  });

  test('mindmap child text keeps horizontal alignment inside capsule on zoom', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, root.id);

    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const childNode = nodes.find((o) => o.id !== rootId) || null;
          return childNode?.id || null;
        }, root.id);
      })
      .toEqual(expect.any(String));
    const child = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const childNode = nodes.find((o) => o.id !== rootId) || null;
      return childNode?.id || null;
    }, root.id);
    expect(child).toBeTruthy();

    const getChildRatio = async () => page.evaluate((childId) => {
      const host = document.querySelector(`.mb-text--mindmap[data-id="${childId}"]`);
      const content = document.querySelector(`.mb-text--mindmap[data-id="${childId}"] .mb-text--mindmap-content`);
      const core = window.moodboard?.coreMoodboard;
      if (!host || !content || !core) return null;
      const hostRect = host.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const worldScale = core?.pixi?.worldLayer?.scale?.x || 1;
      if (!hostRect.width) return null;
      return {
        ratio: (contentRect.left - hostRect.left) / hostRect.width,
        worldScale,
      };
    }, child);

    await expect
      .poll(async () => {
        const ratio = await getChildRatio();
        return ratio ? true : false;
      })
      .toBe(true);
    const before = await getChildRatio();
    expect(before).toBeTruthy();

    await page.evaluate(() => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('ui:zoom:in');
      core.eventBus.emit('ui:zoom:in');
    });

    await expect
      .poll(async () => {
        const next = await getChildRatio();
        if (!next || !before) return false;
        return next.worldScale > before.worldScale;
      })
      .toBe(true);

    const after = await getChildRatio();
    expect(after).toBeTruthy();
    expect(Math.abs(after.ratio - before.ratio)).toBeLessThanOrEqual(0.03);
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
      await page.mouse.click(5, 5);
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

  test('mindmap allows drag from text and click-to-edit on text', async ({ page }) => {
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

    // Drag starting from text.
    await page.mouse.move(textBox.x + textBox.width * 0.5, textBox.y + textBox.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(textBox.x + textBox.width * 0.5 + 60, textBox.y + textBox.height * 0.5 + 25);
    await page.mouse.up();

    // Simple click on text opens editor.
    const textBox2 = await textEl.boundingBox();
    expect(textBox2).toBeTruthy();
    await page.mouse.click(textBox2.x + textBox2.width * 0.5, textBox2.y + textBox2.height * 0.5);
    await expect(page.locator('.moodboard-text-input')).toBeVisible();
  });

  test('mindmap side plus creates child with compound metadata and supports undo/redo', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await expect
      .poll(async () => getMindmapObject(page))
      .toMatchObject({ id: expect.any(String) });
    const rootObject = await getMindmapObject(page);
    expect(rootObject?.id).toBeTruthy();

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, rootObject.id);

    const rightBtn = page.locator('.mb-mindmap-side-btn[data-side="right"]');
    await expect(rightBtn).toBeVisible();
    await rightBtn.click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(2);

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const rootNode = nodes.find((o) => o.id === rootId);
          const childNode = nodes.find((o) => o.id !== rootId);
          if (!rootNode || !childNode) return false;
          const rootMeta = rootNode.properties?.mindmap || {};
          const childMeta = childNode.properties?.mindmap || {};
          return (
            rootMeta.role === 'root' &&
            childMeta.role === 'child' &&
            childMeta.parentId === rootId &&
            typeof childMeta.compoundId === 'string' &&
            childMeta.compoundId.length > 0 &&
            childMeta.compoundId === rootMeta.compoundId
          );
        }, rootObject.id);
      })
      .toBe(true);

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const rootNode = nodes.find((o) => o.id === rootId);
          const childNode = nodes.find((o) => o.id !== rootId);
          if (!rootNode || !childNode) return false;
          const rootPaddingX = Number(rootNode.properties?.paddingX || 0);
          const rootPaddingY = Number(rootNode.properties?.paddingY || 0);
          const childPaddingX = Number(childNode.properties?.paddingX || 0);
          const childPaddingY = Number(childNode.properties?.paddingY || 0);
          const rootWidth = Number(rootNode.properties?.width || rootNode.width || 0);
          const rootHeight = Number(rootNode.properties?.height || rootNode.height || 0);
          const childWidth = Number(childNode.properties?.width || childNode.width || 0);
          const childHeight = Number(childNode.properties?.height || childNode.height || 0);
          const childStroke = Number(childNode.properties?.strokeColor || 0);
          const childFill = Number(childNode.properties?.fillColor || 0);
          const childFillAlpha = Number(childNode.properties?.fillAlpha || 0);
          return (
            childWidth < rootWidth &&
            childHeight < rootHeight &&
            childPaddingX > 0 &&
            childPaddingX === Math.round(rootPaddingX / 2) &&
            childPaddingY > 0 &&
            childPaddingY === Math.round(rootPaddingY / 2) &&
            childStroke === 0x16A34A &&
            childFill === 0x16A34A &&
            childFillAlpha > 0 &&
            childFillAlpha < 1
          );
        }, rootObject.id);
      })
      .toBe(true);

    await triggerUndo(page);
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(1);

    await triggerRedo(page);
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(2);
  });

  test('mindmap keeps root anchor and hides root plus after root text resize', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.5);

    const rootObject = await getMindmapObject(page);
    expect(rootObject?.id).toBeTruthy();

    const clickPoint = await page.evaluate(() => {
      const el = document.querySelector('.mb-text--mindmap .mb-text--mindmap-content');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
    });
    expect(clickPoint).toBeTruthy();
    await page.mouse.click(clickPoint.x, clickPoint.y);
    await expect(page.locator('.moodboard-text-input')).toBeVisible();
    await page.keyboard.type('ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ');
    await page.mouse.click(5, 5);
    await expect(page.locator('.moodboard-text-input')).toHaveCount(0);

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, rootObject.id);

    const rightBtn = page.locator('.mb-mindmap-side-btn[data-side="right"]');
    await expect(rightBtn).toBeVisible();
    await rightBtn.click();

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const rootNode = nodes.find((o) => o.id === rootId);
          const childNode = nodes.find((o) => o.id !== rootId);
          const seg = (window.moodboardMindmapConnectionLayer?._lastSegments || [])
            .find((s) => s.childId === childNode?.id);
          if (!rootNode || !childNode || !seg) return false;
          const rootRight = Math.round((rootNode.position?.x || 0) + (rootNode.width || rootNode.properties?.width || 0));
          return seg.parentId === rootId && Math.abs(seg.start.x - rootRight) <= 2;
        }, rootObject.id);
      })
      .toBe(true);

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, rootObject.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toHaveCount(0);
  });

  test('mindmap child bottom chevron creates nested child from same level style', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.48, canvasBox.y + canvasBox.height * 0.48);

    const rootObject = await getMindmapObject(page);
    expect(rootObject?.id).toBeTruthy();

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, rootObject.id);

    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(2);

    const firstChild = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      return nodes.find((o) => o.id !== rootId && o.properties?.mindmap?.parentId === rootId) || null;
    }, rootObject.id);
    expect(firstChild?.id).toBeTruthy();

    // After connecting root->right child, right plus for root must be hidden.
    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, rootObject.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toHaveCount(0);

    await page.evaluate((childId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([childId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, firstChild.id);

    // Child has incoming line from left, so left plus is hidden.
    await expect(page.locator('.mb-mindmap-side-btn[data-side="left"]')).toHaveCount(0);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    const downBtn = page.locator('.mb-mindmap-side-btn[data-side="bottom"]');
    await expect(downBtn).toBeVisible();
    await downBtn.click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(3);

    await expect
      .poll(async () => {
        return page.evaluate(({ rootId, firstChildId }) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const rootNode = nodes.find((o) => o.id === rootId);
          const levelNode = nodes.find((o) => o.id === firstChildId);
          const nestedNode = nodes.find((o) => o.id !== rootId && o.id !== firstChildId);
          if (!rootNode || !levelNode || !nestedNode) return false;
          const rootMeta = rootNode.properties?.mindmap || {};
          const levelMeta = levelNode.properties?.mindmap || {};
          const nestedMeta = nestedNode.properties?.mindmap || {};
          return (
            nestedMeta.role === 'child' &&
            nestedMeta.parentId === levelMeta.parentId &&
            nestedMeta.compoundId === levelMeta.compoundId &&
            nestedMeta.side === levelMeta.side &&
            nestedMeta.branchRootId === levelMeta.parentId &&
            rootMeta.role === 'root' &&
            Number(nestedNode.properties?.width || nestedNode.width || 0) === Number(levelNode.properties?.width || levelNode.width || 0) &&
            Number(nestedNode.properties?.height || nestedNode.height || 0) === Number(levelNode.properties?.height || levelNode.height || 0) &&
            Number(nestedNode.properties?.paddingX || 0) === Number(levelNode.properties?.paddingX || 0) &&
            Number(nestedNode.properties?.paddingY || 0) === Number(levelNode.properties?.paddingY || 0) &&
            (nestedNode.properties?.content || '') === ''
          );
        }, { rootId: rootObject.id, firstChildId: firstChild.id });
      })
      .toBe(true);

    // Bottom side remains available because this action does not occupy bottom side.
    await page.evaluate((childId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([childId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, firstChild.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();

    const nestedChild = await page.evaluate(({ rootId, firstChildId }) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      return nodes.find((o) => o.id !== rootId && o.id !== firstChildId) || null;
    }, { rootId: rootObject.id, firstChildId: firstChild.id });
    expect(nestedChild?.id).toBeTruthy();

    await page.evaluate((childId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([childId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, nestedChild.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(4);

    await expect
      .poll(async () => {
        return page.evaluate(({ rootId, firstChildId, nestedChildId }) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const nested = nodes.find((o) => o.id === nestedChildId);
          if (!nested) return false;
          const nestedMeta = nested.properties?.mindmap || {};
          const newest = nodes.find((o) => o.id !== rootId && o.id !== firstChildId && o.id !== nestedChildId && o.id !== null);
          if (!newest || !nestedMeta) return false;
          const meta = newest.properties?.mindmap || {};
          return (
            meta.parentId === nestedMeta.parentId &&
            meta.branchRootId === nestedMeta.parentId &&
            meta.parentId !== nestedChildId
          );
        }, { rootId: rootObject.id, firstChildId: firstChild.id, nestedChildId: nestedChild.id });
      })
      .toBe(true);

    // Connection remains attached and updates when node moves.
    const lineBefore = await page.evaluate((childId) => {
      const layer = window.moodboardMindmapConnectionLayer;
      if (!layer) return null;
      const segment = (layer._lastSegments || []).find((s) => s.childId === childId) || null;
      return segment ? { x: segment.end.x, y: segment.end.y } : null;
    }, firstChild.id);
    expect(lineBefore).toBeTruthy();
    await page.evaluate((childId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === childId);
      if (!node) return;
      core.updateObjectPositionDirect(childId, {
        x: (node.position?.x || 0) + 70,
        y: (node.position?.y || 0) + 35,
      }, { snap: false });
      core.eventBus.emit('tool:drag:update', { object: childId });
      const layer = window.moodboardMindmapConnectionLayer;
      if (layer && typeof layer.updateAll === 'function') {
        layer.updateAll();
      }
    }, firstChild.id);
    await expect
      .poll(async () => {
        return page.evaluate(({ childId, prev }) => {
          const layer = window.moodboardMindmapConnectionLayer;
          if (!layer) return false;
          const segment = (layer._lastSegments || []).find((s) => s.childId === childId) || null;
          if (!segment) return false;
          return segment.end.x !== prev.x || segment.end.y !== prev.y;
        }, { childId: firstChild.id, prev: lineBefore });
      })
      .toBe(true);
  });

  test('mindmap deep branching keeps bottom clones on local parent level', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await expect
      .poll(async () => getMindmapObject(page))
      .toMatchObject({ id: expect.any(String) });
    const rootNode = await getMindmapObject(page);
    expect(rootNode?.id).toBeTruthy();

    const selectNode = async (nodeId) => {
      await page.evaluate((id) => {
        const core = window.moodboard?.coreMoodboard;
        if (!core) return;
        core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
        const tm = core.toolManager;
        const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
        if (!selectTool) return;
        selectTool.setSelection([id]);
        if (typeof selectTool.updateResizeHandles === 'function') {
          selectTool.updateResizeHandles();
        }
      }, nodeId);
    };

    const getMindmapNodes = async () => page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .map((o) => ({
          id: o.id,
          position: { x: o.position?.x || 0, y: o.position?.y || 0 },
          mindmap: { ...(o.properties?.mindmap || {}) },
        }));
    });

    // root --(+right)--> childA
    await selectNode(rootNode.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();
    await expect.poll(async () => (await getMindmapNodes()).length).toBe(2);
    const nodesAfterA = await getMindmapNodes();
    const childA = nodesAfterA.find((n) => n.id !== rootNode.id);
    expect(childA?.id).toBeTruthy();
    expect(childA.mindmap?.parentId).toBe(rootNode.id);

    // childA --(+right)--> childB
    await selectNode(childA.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    const beforeB = await getMindmapNodes();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();
    await expect.poll(async () => (await getMindmapNodes()).length).toBe(3);
    const afterB = await getMindmapNodes();
    const beforeBIds = new Set(beforeB.map((n) => n.id));
    const childB = afterB.find((n) => !beforeBIds.has(n.id));
    expect(childB?.id).toBeTruthy();
    expect(childB.mindmap?.parentId).toBe(childA.id);

    // childB --(bottom)--> siblingB1 with same parent as childB
    await selectNode(childB.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    const beforeD = await getMindmapNodes();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect.poll(async () => (await getMindmapNodes()).length).toBe(4);
    const afterD = await getMindmapNodes();
    const beforeDIds = new Set(beforeD.map((n) => n.id));
    const siblingB1 = afterD.find((n) => !beforeDIds.has(n.id));
    expect(siblingB1?.id).toBeTruthy();
    expect(siblingB1.mindmap?.parentId).toBe(childB.mindmap?.parentId);
    expect(siblingB1.mindmap?.parentId).not.toBe(childB.id);

    // siblingB1 --(bottom)--> siblingB2 still on same local parent level
    await selectNode(siblingB1.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    const beforeE = await getMindmapNodes();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect.poll(async () => (await getMindmapNodes()).length).toBe(5);
    const afterE = await getMindmapNodes();
    const beforeEIds = new Set(beforeE.map((n) => n.id));
    const siblingB2 = afterE.find((n) => !beforeEIds.has(n.id));
    expect(siblingB2?.id).toBeTruthy();
    expect(siblingB2.mindmap?.parentId).toBe(siblingB1.mindmap?.parentId);
    expect(siblingB2.mindmap?.parentId).toBe(childA.id);
    expect(siblingB2.mindmap?.parentId).not.toBe(siblingB1.id);

    await expect
      .poll(async () => {
        return page.evaluate(({ firstId, secondId, expectedParentId }) => {
          const segments = window.moodboardMindmapConnectionLayer?._lastSegments || [];
          const first = segments.find((s) => s.childId === firstId) || null;
          const second = segments.find((s) => s.childId === secondId) || null;
          if (!first || !second) return false;
          return first.parentId === expectedParentId && second.parentId === expectedParentId;
        }, { firstId: siblingB1.id, secondId: siblingB2.id, expectedParentId: childA.id });
      })
      .toBe(true);
  });

  test('mindmap branch siblings align by edge and keep equal vertical spacing', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    const selectNode = async (nodeId) => {
      await page.evaluate((id) => {
        const core = window.moodboard?.coreMoodboard;
        if (!core) return;
        core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
        const tm = core.toolManager;
        const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
        if (!selectTool) return;
        selectTool.setSelection([id]);
        if (typeof selectTool.updateResizeHandles === 'function') {
          selectTool.updateResizeHandles();
        }
      }, nodeId);
    };

    await selectNode(root.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const child = nodes.find((o) => o.id !== rootId) || null;
          return child?.id || null;
        }, root.id);
      })
      .toEqual(expect.any(String));

    const childId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const child = nodes.find((o) => o.id !== rootId) || null;
      return child?.id || null;
    }, root.id);
    expect(childId).toBeTruthy();

    await selectNode(childId);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(3);

    await selectNode(childId);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(4);

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const rootNode = nodes.find((o) => o.id === rootId);
          if (!rootNode) return false;
          const branchNodes = nodes
            .filter((o) => {
              const m = o.properties?.mindmap || {};
              return m.role === 'child' && m.parentId === rootId && m.side === 'right';
            })
            .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0));
          if (branchNodes.length < 3) return false;
          const lefts = branchNodes.map((n) => Math.round(n.position?.x || 0));
          const leftSpread = Math.max(...lefts) - Math.min(...lefts);
          const dGaps = [];
          for (let i = 1; i < branchNodes.length; i += 1) {
            const prev = branchNodes[i - 1];
            const next = branchNodes[i];
            const prevBottom = Math.round((prev.position?.y || 0) + (prev.height || prev.properties?.height || 0));
            const nextTop = Math.round(next.position?.y || 0);
            dGaps.push(nextTop - prevBottom);
          }
          const gapSpread = Math.max(...dGaps) - Math.min(...dGaps);
          const branchTop = Math.min(...branchNodes.map((n) => Math.round(n.position?.y || 0)));
          const branchBottom = Math.max(
            ...branchNodes.map((n) => Math.round((n.position?.y || 0) + (n.height || n.properties?.height || 0)))
          );
          const branchCenterY = Math.round((branchTop + branchBottom) / 2);
          const rootCenterY = Math.round((rootNode.position?.y || 0) + ((rootNode.height || rootNode.properties?.height || 0) / 2));
          const centerDelta = Math.abs(branchCenterY - rootCenterY);
          return leftSpread <= 1 && gapSpread <= 1 && centerDelta <= 1;
        }, root.id);
      })
      .toBe(true);
  });

  test('mindmap mixed plus-and-bottom keeps operation semantics on next level', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const rootNode = await expect
      .poll(async () => getMindmapObject(page))
      .toMatchObject({ id: expect.any(String) });
    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    const selectNode = async (nodeId) => {
      await page.evaluate((id) => {
        const core = window.moodboard?.coreMoodboard;
        if (!core) return;
        core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
        const tm = core.toolManager;
        const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
        if (!selectTool) return;
        selectTool.setSelection([id]);
        if (typeof selectTool.updateResizeHandles === 'function') {
          selectTool.updateResizeHandles();
        }
      }, nodeId);
    };

    const getNodes = async () => page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .map((o) => ({
          id: o.id,
          mindmap: { ...(o.properties?.mindmap || {}) },
        }));
    });

    // root --(+right)--> childA
    await selectNode(root.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    const beforeA = await getNodes();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();
    await expect.poll(async () => (await getNodes()).length).toBe(beforeA.length + 1);
    const afterA = await getNodes();
    const beforeAIds = new Set(beforeA.map((n) => n.id));
    const childA = afterA.find((n) => !beforeAIds.has(n.id));
    expect(childA?.id).toBeTruthy();
    expect(childA.mindmap?.parentId).toBe(root.id);
    expect(childA.mindmap?.side).toBe('right');

    // childA --(bottom)--> siblingA2 (same parent as childA)
    await selectNode(childA.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    const beforeB = await getNodes();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect.poll(async () => (await getNodes()).length).toBe(beforeB.length + 1);
    const afterB = await getNodes();
    const beforeBIds = new Set(beforeB.map((n) => n.id));
    const siblingA2 = afterB.find((n) => !beforeBIds.has(n.id));
    expect(siblingA2?.id).toBeTruthy();
    expect(siblingA2.mindmap?.parentId).toBe(root.id);
    expect(siblingA2.mindmap?.parentId).not.toBe(childA.id);
    expect(siblingA2.mindmap?.side).toBe('right');

    // siblingA2 --(+right)--> childC (plus must create child of selected node)
    await selectNode(siblingA2.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    const beforeC = await getNodes();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();
    await expect.poll(async () => (await getNodes()).length).toBe(beforeC.length + 1);
    const afterC = await getNodes();
    const beforeCIds = new Set(beforeC.map((n) => n.id));
    const childC = afterC.find((n) => !beforeCIds.has(n.id));
    expect(childC?.id).toBeTruthy();
    expect(childC.mindmap?.parentId).toBe(siblingA2.id);
    expect(childC.mindmap?.parentId).not.toBe(root.id);
    expect(childC.mindmap?.side).toBe('right');

    await expect
      .poll(async () => {
        return page.evaluate(({ siblingId, childId, rootId, siblingFromBottomId }) => {
          const segments = window.moodboardMindmapConnectionLayer?._lastSegments || [];
          const bottomSeg = segments.find((s) => s.childId === siblingFromBottomId) || null;
          const plusSeg = segments.find((s) => s.childId === childId) || null;
          if (!bottomSeg || !plusSeg) return false;
          return (
            bottomSeg.parentId === rootId &&
            plusSeg.parentId === siblingId &&
            plusSeg.parentId !== rootId
          );
        }, {
          siblingId: siblingA2.id,
          childId: childC.id,
          rootId: root.id,
          siblingFromBottomId: siblingA2.id,
        });
      })
      .toBe(true);
  });

  test('mindmap-only group selection keeps outline without resize handles', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, root.id);

    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const childNode = nodes.find((o) => o.id !== rootId) || null;
          return childNode?.id || null;
        }, root.id);
      })
      .toEqual(expect.any(String));

    const child = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      return nodes.find((o) => o.id !== rootId) || null;
    }, root.id);
    expect(child?.id).toBeTruthy();

    await page.evaluate(({ rootId, childId }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId, childId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, { rootId: root.id, childId: child.id });

    await expect(page.locator('.mb-handles-box')).toBeVisible();
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const box = document.querySelector('.mb-handles-box');
          if (!box) return null;
          const countVisible = (selector) => (
            Array.from(box.querySelectorAll(selector))
              .filter((el) => window.getComputedStyle(el).display !== 'none')
              .length
          );
          return {
            corners: countVisible('[data-dir]'),
            edges: countVisible('[data-edge]'),
            rotate: countVisible('[data-handle="rotate"]'),
          };
        });
      })
      .toEqual({
        corners: 0,
        edges: 0,
        rotate: 0,
      });
  });

  test('mindmap compound metadata survives export/load roundtrip', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.52, canvasBox.y + canvasBox.height * 0.52);

    const rootObject = await expect
      .poll(async () => getMindmapObject(page))
      .toMatchObject({ id: expect.any(String) });
    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    await page.evaluate((rootId) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
      const tm = core.toolManager;
      const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
      if (!selectTool) return;
      selectTool.setSelection([rootId]);
      if (typeof selectTool.updateResizeHandles === 'function') {
        selectTool.updateResizeHandles();
      }
    }, root.id);

    const rightBtn = page.locator('.mb-mindmap-side-btn[data-side="right"]');
    await expect(rightBtn).toBeVisible();
    await rightBtn.click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(2);

    await page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const rootNode = nodes.find((o) => o.properties?.mindmap?.role === 'root');
      const childNode = nodes.find((o) => o.properties?.mindmap?.role === 'child');
      if (!rootNode || !childNode) return;
      window.moodboard.coreMoodboard.eventBus.emit('object:content:change', {
        objectId: rootNode.id,
        oldContent: rootNode.properties?.content || '',
        newContent: 'Root compound text',
      });
      window.moodboard.coreMoodboard.eventBus.emit('object:content:change', {
        objectId: childNode.id,
        oldContent: childNode.properties?.content || '',
        newContent: 'Child compound text',
      });
    });

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const values = nodes.map((o) => o.properties?.content || '');
          return values.includes('Root compound text') && values.includes('Child compound text');
        });
      })
      .toBe(true);

    const beforeLoad = await page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .map((o) => ({
          id: o.id,
          x: o.position?.x || 0,
          y: o.position?.y || 0,
          content: o.properties?.content || '',
          compoundId: o.properties?.mindmap?.compoundId || null,
          role: o.properties?.mindmap?.role || null,
          parentId: o.properties?.mindmap?.parentId || null,
        }));
      return { snapshot: board, nodes };
    });
    expect(beforeLoad.nodes).toHaveLength(2);

    await page.evaluate((payload) => {
      window.moodboard.dataManager.loadData(payload.snapshot);
    }, beforeLoad);

    await expect
      .poll(async () => {
        return page.evaluate((expectedNodes) => {
          const board = window.moodboard.exportBoard();
          const loadedNodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          if (loadedNodes.length !== expectedNodes.length) return false;
          return expectedNodes.every((expected) => {
            const node = loadedNodes.find((o) => o.id === expected.id);
            if (!node) return false;
            return (
              (node.position?.x || 0) === expected.x &&
              (node.position?.y || 0) === expected.y &&
              (node.properties?.content || '') === expected.content &&
              (node.properties?.mindmap?.compoundId || null) === expected.compoundId &&
              (node.properties?.mindmap?.role || null) === expected.role &&
              (node.properties?.mindmap?.parentId || null) === expected.parentId
            );
          });
        }, beforeLoad.nodes);
      })
      .toBe(true);
  });
});
