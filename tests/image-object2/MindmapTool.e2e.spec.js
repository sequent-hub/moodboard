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
    await page.keyboard.press('Escape');
    await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);
    await expect
      .poll(async () => {
        return page.evaluate(() => document.querySelectorAll('.moodboard-text-input').length);
      })
      .toBe(0);

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

    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`).click();

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

    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`).click();

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

  test('mindmap left child keeps right edge anchor while width changes', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(1);

    await page.mouse.click(5, 5);
    await expect(page.locator('.moodboard-text-input')).toHaveCount(0);

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

    const leftBtn = page.locator('.mb-mindmap-side-btn[data-side="left"]');
    await expect(leftBtn).toBeVisible();
    await leftBtn.click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(2);

    const childBefore = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const child = (board?.objects || []).find((o) => {
        if (o.type !== 'mindmap' || o.id === rootId) return false;
        const meta = o.properties?.mindmap || {};
        return meta.role === 'child' && meta.side === 'left';
      });
      if (!child) return null;
      const x = Math.round(child.position?.x || 0);
      const width = Math.round(child.width || 0);
      return { id: child.id, x, width, right: x + width };
    }, root.id);
    expect(childBefore).toBeTruthy();

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();
    await textarea.fill('W'.repeat(50));

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const child = (board?.objects || []).find((o) => o.id === childBefore.id);
        if (!child) return false;
        return Math.round(child.width || 0) > childBefore.width;
      })
      .toBe(true);

    const childAfter = await page.evaluate((childId) => {
      const board = window.moodboard.exportBoard();
      const child = (board?.objects || []).find((o) => o.id === childId);
      if (!child) return null;
      const x = Math.round(child.position?.x || 0);
      const width = Math.round(child.width || 0);
      return { x, width, right: x + width };
    }, childBefore.id);
    expect(childAfter).toBeTruthy();
    expect(childAfter.x).toBeLessThan(childBefore.x);
    expect(Math.abs(childAfter.right - childBefore.right)).toBeLessThanOrEqual(2);
  });

  test('mindmap bottom clone on left branch keeps right edge anchor while width changes', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(1);

    await page.mouse.click(5, 5);
    await expect(page.locator('.moodboard-text-input')).toHaveCount(0);

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
    const clickBottomForNode = async (nodeId) => {
      await expect
        .poll(async () => {
          return page.evaluate((id) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return btn.getAttribute('data-id');
          }, nodeId);
        }, { timeout: 10000 })
        .toBe(nodeId);
    };
    await selectNode(root.id);
    const leftBtn = page.locator('.mb-mindmap-side-btn[data-side="left"]');
    await expect(leftBtn).toBeVisible();
    await leftBtn.click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(2);

    const firstChild = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || []).find((o) => {
        if (o.type !== 'mindmap' || o.id === rootId) return false;
        const meta = o.properties?.mindmap || {};
        return meta.role === 'child' && meta.side === 'left' && meta.parentId === rootId;
      }) || null;
    }, root.id);
    expect(firstChild?.id).toBeTruthy();

    await selectNode(firstChild.id);
    const bottomBtn = page.locator('.mb-mindmap-side-btn[data-side="bottom"]');
    await expect(bottomBtn).toBeVisible();

    const beforeBottomIds = await page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || []).filter((o) => o.type === 'mindmap').map((o) => o.id);
    });
    await bottomBtn.click();

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
      })
      .toBe(3);

    const bottomCloneBefore = await page.evaluate(({ rootId, firstChildId, knownIds }) => {
      const known = new Set(knownIds);
      const board = window.moodboard.exportBoard();
      const clone = (board?.objects || []).find((o) => {
        if (o.type !== 'mindmap' || o.id === rootId || o.id === firstChildId || known.has(o.id)) return false;
        const meta = o.properties?.mindmap || {};
        return meta.role === 'child' && meta.side === 'left';
      });
      if (!clone) return null;
      const meta = clone.properties?.mindmap || {};
      const x = Math.round(clone.position?.x || 0);
      const width = Math.round(clone.width || 0);
      return {
        id: clone.id,
        x,
        width,
        right: x + width,
        parentId: meta.parentId || null,
      };
    }, { rootId: root.id, firstChildId: firstChild.id, knownIds: beforeBottomIds });
    expect(bottomCloneBefore).toBeTruthy();
    expect(bottomCloneBefore.parentId).toBe(root.id);

    const textarea = page.locator('.moodboard-text-input');
    await expect(textarea).toBeVisible();
    await textarea.fill('Z');

    const bottomCloneAfterShort = await page.evaluate((cloneId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === cloneId);
      if (!node) return null;
      const x = Math.round(node.position?.x || 0);
      const width = Math.round(node.width || 0);
      return { x, width, right: x + width };
    }, bottomCloneBefore.id);
    expect(bottomCloneAfterShort).toBeTruthy();

    await textarea.fill('QWERTYUIOPASDFGHJKLZXCVBNM1234567890QWERTYUIOPAS');

    await expect
      .poll(async () => {
        const board = await page.evaluate(() => window.moodboard.exportBoard());
        const node = (board?.objects || []).find((o) => o.id === bottomCloneBefore.id);
        if (!node) return false;
        return Math.round(node.width || 0) > bottomCloneAfterShort.width;
      })
      .toBe(true);

    const bottomCloneAfterLong = await page.evaluate((cloneId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === cloneId);
      if (!node) return null;
      const x = Math.round(node.position?.x || 0);
      const width = Math.round(node.width || 0);
      return { x, width, right: x + width };
    }, bottomCloneBefore.id);
    expect(bottomCloneAfterLong).toBeTruthy();
    expect(bottomCloneAfterLong.x).toBeLessThan(bottomCloneAfterShort.x);
    expect(Math.abs(bottomCloneAfterLong.right - bottomCloneAfterShort.right)).toBeLessThanOrEqual(2);
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
      await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);
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
    await page.keyboard.press('Escape');
    await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);
    await expect
      .poll(async () => {
        return page.evaluate(() => document.querySelectorAll('.moodboard-text-input').length);
      })
      .toBe(0);

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
    await page.keyboard.press('Escape');
    await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);
    await expect
      .poll(async () => {
        return page.evaluate(() => document.querySelectorAll('.moodboard-text-input').length);
      })
      .toBe(0);

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

    const rightBtn = page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${rootObject.id}"]`);
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
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${rootObject.id}"]`)).toHaveCount(0);
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
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${rootObject.id}"]`)).toHaveCount(0);

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
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="left"][data-id="${firstChild.id}"]`)).toHaveCount(0);
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${firstChild.id}"]`)).toBeVisible();
    const downBtn = page.locator(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${firstChild.id}"]`);
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
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${nestedChild.id}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${nestedChild.id}"]`).click();

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
    await expect
      .poll(async () => {
        return page.evaluate((childId) => {
          const layer = window.moodboardMindmapConnectionLayer;
          const core = window.moodboard?.coreMoodboard;
          if (!layer || !core) return false;
          const getSegmentEnd = () => {
            const seg = (layer._lastSegments || []).find((s) => s.childId === childId) || null;
            if (!seg) return null;
            return { x: Number(seg.end?.x || 0), y: Number(seg.end?.y || 0) };
          };
          const before = getSegmentEnd();
          if (!before) return false;
          const board = window.moodboard.exportBoard();
          const node = (board?.objects || []).find((o) => o.id === childId);
          if (!node) return false;
          core.updateObjectPositionDirect(childId, {
            x: (node.position?.x || 0) + 23,
            y: (node.position?.y || 0) + 17,
          }, { snap: false });
          core.eventBus.emit('tool:drag:update', { object: childId });
          if (typeof layer.updateAll === 'function') {
            layer.updateAll();
          }
          const after = getSegmentEnd();
          if (!after) return false;
          return after.x !== before.x || after.y !== before.y;
        }, firstChild.id);
      }, { timeout: 10000 })
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

  test('mindmap bottom insert keeps new sibling immediately after source', async ({ page }) => {
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
    const clickBottomForNode = async (nodeId) => {
      await expect
        .poll(async () => {
          return page.evaluate((id) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return btn.getAttribute('data-id');
          }, nodeId);
        }, { timeout: 10000 })
        .toBe(nodeId);
    };

    // Build branch: root -> childA -> two bottom siblings (3 nodes total on root/right).
    await selectNode(root.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const childAId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId);
      return node?.id || null;
    }, root.id);
    expect(childAId).toBeTruthy();

    await selectNode(childAId);
    await clickBottomForNode(childAId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);

    await selectNode(childAId);
    await clickBottomForNode(childAId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(4);

    // Pick middle sibling and click bottom. New node must be exactly next sibling.
    const before = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const branch = (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .filter((o) => {
          const m = o.properties?.mindmap || {};
          return m.role === 'child' && m.parentId === rootId && m.side === 'right';
        })
        .sort((a, b) => {
          const ao = Number.isFinite(a?.properties?.mindmap?.branchOrder) ? Number(a.properties.mindmap.branchOrder) : null;
          const bo = Number.isFinite(b?.properties?.mindmap?.branchOrder) ? Number(b.properties.mindmap.branchOrder) : null;
          if (ao !== null && bo !== null && ao !== bo) return ao - bo;
          if (ao !== null && bo === null) return -1;
          if (ao === null && bo !== null) return 1;
          return (a.position?.y || 0) - (b.position?.y || 0);
        })
        .map((o) => o.id);
      return branch;
    }, root.id);
    expect(before.length).toBe(3);
    const sourceId = before[1];
    const knownIds = new Set(before);

    await selectNode(sourceId);
    await clickBottomForNode(sourceId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(5);

    await expect
      .poll(async () => {
        return page.evaluate(({ rootId, sourceId, existing }) => {
          const known = new Set(existing);
          const board = window.moodboard.exportBoard();
          const branch = (board?.objects || [])
            .filter((o) => o.type === 'mindmap')
            .filter((o) => {
              const m = o.properties?.mindmap || {};
              return m.role === 'child' && m.parentId === rootId && m.side === 'right';
            })
            .sort((a, b) => {
              const ao = Number.isFinite(a?.properties?.mindmap?.branchOrder) ? Number(a.properties.mindmap.branchOrder) : null;
              const bo = Number.isFinite(b?.properties?.mindmap?.branchOrder) ? Number(b.properties.mindmap.branchOrder) : null;
              if (ao !== null && bo !== null && ao !== bo) return ao - bo;
              if (ao !== null && bo === null) return -1;
              if (ao === null && bo !== null) return 1;
              return (a.position?.y || 0) - (b.position?.y || 0);
            })
            .map((o) => o.id);
          const sourceIndex = branch.indexOf(sourceId);
          if (sourceIndex < 0 || sourceIndex + 1 >= branch.length) return false;
          const insertedId = branch[sourceIndex + 1];
          if (known.has(insertedId)) return false;
          return true;
        }, { rootId: root.id, sourceId, existing: Array.from(knownIds) });
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

  test('mindmap nested subgroup increases sibling spacing without overlaps', async ({ page }) => {
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

    // Build 3 siblings on root right branch.
    await selectNode(root.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const firstChildId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const child = nodes.find((o) => o.id !== rootId);
      return child?.id || null;
    }, root.id);
    expect(firstChildId).toBeTruthy();

    await selectNode(firstChildId);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);

    await selectNode(firstChildId);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(4);

    const before = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const siblings = nodes
        .filter((o) => {
          const m = o.properties?.mindmap || {};
          return m.role === 'child' && m.parentId === rootId && m.side === 'right';
        })
        .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0))
        .map((o) => ({
          id: o.id,
          top: Math.round(o.position?.y || 0),
          bottom: Math.round((o.position?.y || 0) + (o.height || o.properties?.height || 0)),
          centerY: Math.round((o.position?.y || 0) + ((o.height || o.properties?.height || 0) / 2)),
        }));
      return siblings;
    }, root.id);
    expect(before?.length).toBe(3);

    const middle = before[1];
    expect(middle?.id).toBeTruthy();

    // Add subgroup under middle sibling: +right and then bottom clone.
    await selectNode(middle.id);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="right"]')).toBeVisible();
    const beforeSubgroupIds = await page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || []).filter((o) => o.type === 'mindmap').map((o) => o.id);
    });
    await page.locator('.mb-mindmap-side-btn[data-side="right"]').click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(5);

    const subgroupChildId = await page.evaluate(({ rootId, beforeIds }) => {
      const known = new Set(beforeIds);
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const rootSiblingIds = new Set(
        nodes
          .filter((o) => {
            const m = o.properties?.mindmap || {};
            return m.role === 'child' && m.parentId === rootId && m.side === 'right';
          })
          .map((o) => o.id)
      );
      const child = nodes.find((o) => {
        if (known.has(o.id)) return false;
        const m = o.properties?.mindmap || {};
        return m.role === 'child' && rootSiblingIds.has(m.parentId) && m.side === 'right';
      });
      return child?.id || null;
    }, { rootId: root.id, beforeIds: beforeSubgroupIds });
    expect(subgroupChildId).toBeTruthy();

    await selectNode(subgroupChildId);
    await expect(page.locator('.mb-mindmap-side-btn[data-side="bottom"]')).toBeVisible();
    await page.locator('.mb-mindmap-side-btn[data-side="bottom"]').click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(6);

    await expect
      .poll(async () => {
        return page.evaluate((rootId) => {
          const board = window.moodboard.exportBoard();
          const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
          const byId = new Map(nodes.map((n) => [n.id, n]));
          const childrenByParent = new Map();
          nodes.forEach((n) => {
            const m = n.properties?.mindmap || {};
            if (m.role !== 'child' || !m.parentId) return;
            if (!childrenByParent.has(m.parentId)) childrenByParent.set(m.parentId, []);
            childrenByParent.get(m.parentId).push(n.id);
          });

          const collectEnvelope = (id, out) => {
            const node = byId.get(id);
            if (!node) return;
            const top = Math.round(node.position?.y || 0);
            const bottom = Math.round((node.position?.y || 0) + (node.height || node.properties?.height || 0));
            out.minY = Math.min(out.minY, top);
            out.maxY = Math.max(out.maxY, bottom);
            const kids = childrenByParent.get(id) || [];
            kids.forEach((kid) => collectEnvelope(kid, out));
          };

          const rootNode = byId.get(rootId);
          if (!rootNode) return false;
          const siblings = nodes
            .filter((o) => {
              const m = o.properties?.mindmap || {};
              return m.role === 'child' && m.parentId === rootId && m.side === 'right';
            })
            .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0));
          if (siblings.length < 3) return false;

          const envelopes = siblings.map((s) => {
            const env = { id: s.id, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY };
            collectEnvelope(s.id, env);
            return env;
          });

          for (let i = 1; i < envelopes.length; i += 1) {
            const prev = envelopes[i - 1];
            const next = envelopes[i];
            if (Math.round(next.minY - prev.maxY) < 1) return false;
          }

          const top = Math.min(...envelopes.map((e) => e.minY));
          const bottom = Math.max(...envelopes.map((e) => e.maxY));
          const branchCenterY = Math.round((top + bottom) / 2);
          const rootCenterY = Math.round((rootNode.position?.y || 0) + ((rootNode.height || rootNode.properties?.height || 0) / 2));
          const centerDelta = Math.abs(branchCenterY - rootCenterY);
          return centerDelta <= 2;
        }, root.id);
      })
      .toBe(true);
  });

  test('mindmap dragging root moves whole compound tree', async ({ page }) => {
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
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`).click();

    const child = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || []).find((o) => {
        if (o.type !== 'mindmap' || o.id === rootId) return false;
        const m = o.properties?.mindmap || {};
        return m.role === 'child' && m.parentId === rootId && m.side === 'right';
      }) || null;
    }, root.id);
    expect(child?.id).toBeTruthy();
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
      const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="right"][data-id="${childId}"]`);
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    }, child.id);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);

    const getNodePos = async (id) => page.evaluate((nodeId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === nodeId);
      if (!node) return null;
      return {
        x: Math.round(node.position?.x || 0),
        y: Math.round(node.position?.y || 0),
      };
    }, id);
    const beforeAll = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .filter((o) => {
          const meta = o.properties?.mindmap || {};
          return meta.compoundId === rootId;
        })
        .map((o) => ({
          id: o.id,
          x: Math.round(o.position?.x || 0),
          y: Math.round(o.position?.y || 0),
        }));
    }, root.id);
    expect(beforeAll.length).toBeGreaterThanOrEqual(3);

    await page.evaluate(({ id, dx, dy }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === id);
      if (!node) return;
      core.eventBus.emit('tool:drag:start', { object: id });
      core.eventBus.emit('tool:drag:update', {
        object: id,
        position: {
          x: Math.round((node.position?.x || 0) + dx),
          y: Math.round((node.position?.y || 0) + dy),
        },
      });
    }, { id: root.id, dx: 120, dy: 70 });

    await expect
      .poll(async () => {
        return page.evaluate(({ before, dx, dy }) => {
          const board = window.moodboard.exportBoard();
          return before.every((prev) => {
            const node = (board?.objects || []).find((o) => o.id === prev.id);
            if (!node) return false;
            const x = Math.round(node.position?.x || 0);
            const y = Math.round(node.position?.y || 0);
            return Math.abs(x - (prev.x + dx)) <= 2 && Math.abs(y - (prev.y + dy)) <= 2;
          });
        }, { before: beforeAll, dx: 120, dy: 70 });
      }, { timeout: 10000 })
      .toBe(true);
    await page.evaluate((id) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('tool:drag:end', { object: id });
    }, root.id);
  });

  test('mindmap dragging child moves only its subtree', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.5);

    const root = await getMindmapObject(page);
    expect(root?.id).toBeTruthy();

    const closeEditor = async () => {
      await page.keyboard.press('Escape');
      await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);
      await expect
        .poll(async () => {
          return page.evaluate(() => document.querySelectorAll('.moodboard-text-input').length);
        })
        .toBeLessThanOrEqual(1);
    };
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
    const clickBottomForNode = async (nodeId) => {
      await closeEditor();
      await selectNode(nodeId);
      await expect
        .poll(async () => {
          return page.evaluate((id) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
            return btn.getAttribute('data-id');
          }, nodeId);
        }, { timeout: 10000 })
        .toBe(nodeId);
    };

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
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`).click();

    const firstChildId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const child = nodes.find((o) => o.id !== rootId);
      return child?.id || null;
    }, root.id);
    expect(firstChildId).toBeTruthy();
    await clickBottomForNode(firstChildId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);
    await clickBottomForNode(firstChildId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(4);

    const branch = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .filter((o) => {
          const m = o.properties?.mindmap || {};
          return m.role === 'child' && m.parentId === rootId && m.side === 'right';
        })
        .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0))
        .map((o) => ({ id: o.id, x: Math.round(o.position?.x || 0), y: Math.round(o.position?.y || 0) }));
    }, root.id);
    expect(branch.length).toBe(3);
    const draggedId = branch[0].id;
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
      const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="right"][data-id="${childId}"]`);
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    }, draggedId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(5);

    const before = await page.evaluate(({ rootId, childId }) => {
      const board = window.moodboard.exportBoard();
      const byId = new Map((board?.objects || []).filter((o) => o.type === 'mindmap').map((o) => [o.id, o]));
      const childrenByParent = new Map();
      (board?.objects || []).forEach((o) => {
        if (!o || o.type !== 'mindmap') return;
        const m = o.properties?.mindmap || {};
        if (m.role !== 'child' || !m.parentId) return;
        if (!childrenByParent.has(m.parentId)) childrenByParent.set(m.parentId, []);
        childrenByParent.get(m.parentId).push(o.id);
      });
      const queue = [childId];
      const subtree = [];
      const seen = new Set();
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next || seen.has(next)) continue;
        seen.add(next);
        subtree.push(next);
        const nested = childrenByParent.get(next) || [];
        nested.forEach((id) => queue.push(id));
      }
      const siblings = (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .filter((o) => {
          const m = o.properties?.mindmap || {};
          return m.role === 'child' && m.parentId === rootId && m.side === 'right';
        })
        .map((o) => o.id)
        .filter((id) => id !== childId);
      const rootNode = byId.get(rootId);
      const subtreePos = subtree.map((id) => {
        const node = byId.get(id);
        return { id, x: Math.round(node?.position?.x || 0), y: Math.round(node?.position?.y || 0) };
      });
      const siblingPos = siblings.map((id) => {
        const node = byId.get(id);
        return { id, x: Math.round(node?.position?.x || 0), y: Math.round(node?.position?.y || 0) };
      });
      return {
        subtreePos,
        siblingPos,
        rootPos: { x: Math.round(rootNode?.position?.x || 0), y: Math.round(rootNode?.position?.y || 0) },
      };
    }, { rootId: root.id, childId: draggedId });
    expect(before.subtreePos.length).toBeGreaterThanOrEqual(2);

    await page.evaluate(({ id, dx, dy }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === id);
      if (!node) return;
      core.eventBus.emit('tool:drag:start', { object: id });
      core.eventBus.emit('tool:drag:update', {
        object: id,
        position: {
          x: Math.round((node.position?.x || 0) + dx),
          y: Math.round((node.position?.y || 0) + dy),
        },
      });
    }, { id: draggedId, dx: 140, dy: 0 });

    await expect
      .poll(async () => {
        return page.evaluate(({ rootId, expected }) => {
          const board = window.moodboard.exportBoard();
          const byId = new Map((board?.objects || []).filter((o) => o.type === 'mindmap').map((o) => [o.id, o]));
          const rootNode = byId.get(rootId);
          if (!rootNode) return false;
          const rootStable = Math.abs(Math.round(rootNode.position?.x || 0) - expected.rootPos.x) <= 1
            && Math.abs(Math.round(rootNode.position?.y || 0) - expected.rootPos.y) <= 1;
          if (!rootStable) return false;
          const subtreeMoved = expected.subtreePos.every((prev) => {
            const node = byId.get(prev.id);
            if (!node) return false;
            return node && Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y);
          });
          if (!subtreeMoved) return false;
          const anchorPrev = expected.subtreePos[0];
          const anchorNow = anchorPrev ? byId.get(anchorPrev.id) : null;
          if (!anchorPrev || !anchorNow) return false;
          const dx = Math.round(anchorNow.position?.x || 0) - anchorPrev.x;
          const dy = Math.round(anchorNow.position?.y || 0) - anchorPrev.y;
          if (Math.abs(dx) < 80 && Math.abs(dy) < 20) return false;
          const subtreeUniformShift = expected.subtreePos.every((prev) => {
            const node = byId.get(prev.id);
            if (!node) return false;
            const x = Math.round(node.position?.x || 0);
            const y = Math.round(node.position?.y || 0);
            return Math.abs((x - prev.x) - dx) <= 2 && Math.abs((y - prev.y) - dy) <= 2;
          });
          if (!subtreeUniformShift) return false;
          return expected.siblingPos.every((prev) => {
            const node = byId.get(prev.id);
            if (!node) return false;
            const x = Math.round(node.position?.x || 0);
            const y = Math.round(node.position?.y || 0);
            return Math.abs(x - prev.x) <= 1 && Math.abs(y - prev.y) <= 1;
          });
        }, { rootId: root.id, expected: before });
      })
      .toBe(true);
    await page.evaluate((id) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('tool:drag:end', { object: id });
    }, draggedId);
  });

  test('mindmap root real mouse drag moves tree before mouseup', async ({ page }) => {
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
    const clickSideForNode = async (nodeId, side) => {
      await selectNode(nodeId);
      await expect
        .poll(async () => {
          return page.evaluate(({ id, nextSide }) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="${nextSide}"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
            return btn.getAttribute('data-id');
          }, { id: nodeId, nextSide: side });
        }, { timeout: 10000 })
        .toBe(nodeId);
    };

    await clickSideForNode(root.id, 'right');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const childId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId);
      return node?.id || null;
    }, root.id);
    expect(childId).toBeTruthy();

    await clickSideForNode(childId, 'right');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);

    await page.keyboard.press('Escape');
    await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);

    const before = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .filter((o) => {
          const m = o.properties?.mindmap || {};
          return m.compoundId === rootId;
        })
        .map((o) => ({
          id: o.id,
          x: Math.round(o.position?.x || 0),
          y: Math.round(o.position?.y || 0),
        }));
    }, root.id);
    expect(before.length).toBeGreaterThanOrEqual(3);

    const mouseStart = await page.evaluate((rootId) => {
      const el = document.querySelector(`.mb-text--mindmap[data-id="${rootId}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
      };
    }, root.id);
    expect(mouseStart).toBeTruthy();

    await page.mouse.move(mouseStart.x, mouseStart.y);
    await page.mouse.down();
    await page.mouse.move(mouseStart.x + 110, mouseStart.y + 60, { steps: 8 });

    await expect
      .poll(async () => {
        return page.evaluate(({ rootId, beforePos }) => {
          const board = window.moodboard.exportBoard();
          const current = (board?.objects || [])
            .filter((o) => o.type === 'mindmap')
            .filter((o) => (o.properties?.mindmap?.compoundId || o.id) === rootId)
            .map((o) => ({
              id: o.id,
              x: Math.round(o.position?.x || 0),
              y: Math.round(o.position?.y || 0),
            }));
          if (current.length !== beforePos.length) return false;
          const byBefore = new Map(beforePos.map((item) => [item.id, item]));
          const rootBefore = byBefore.get(rootId);
          const rootNow = current.find((item) => item.id === rootId);
          if (!rootBefore || !rootNow) return false;
          const dx = rootNow.x - rootBefore.x;
          const dy = rootNow.y - rootBefore.y;
          if (Math.abs(dx) < 30 || Math.abs(dy) < 20) return false;
          return current.every((item) => {
            const prev = byBefore.get(item.id);
            if (!prev) return false;
            const itemDx = item.x - prev.x;
            const itemDy = item.y - prev.y;
            return Math.abs(itemDx - dx) <= 2 && Math.abs(itemDy - dy) <= 2;
          });
        }, { rootId: root.id, beforePos: before });
      }, { timeout: 10000 })
      .toBe(true);

    await page.mouse.up();
  });

  test('mindmap child real mouse drag moves only subtree before mouseup', async ({ page }) => {
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
    const clickSideForNode = async (nodeId, side) => {
      await selectNode(nodeId);
      await expect
        .poll(async () => {
          return page.evaluate(({ id, nextSide }) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="${nextSide}"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
            return btn.getAttribute('data-id');
          }, { id: nodeId, nextSide: side });
        }, { timeout: 10000 })
        .toBe(nodeId);
    };

    await clickSideForNode(root.id, 'right');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const firstChildId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId);
      return node?.id || null;
    }, root.id);
    expect(firstChildId).toBeTruthy();

    await clickSideForNode(firstChildId, 'bottom');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);
    await clickSideForNode(firstChildId, 'bottom');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(4);

    const branch = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .filter((o) => {
          const m = o.properties?.mindmap || {};
          return m.role === 'child' && m.parentId === rootId && m.side === 'right';
        })
        .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0))
        .map((o) => ({ id: o.id }));
    }, root.id);
    expect(branch.length).toBe(3);
    const draggedId = branch[0].id;

    await clickSideForNode(draggedId, 'right');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(5);

    await page.keyboard.press('Escape');
    await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);

    const before = await page.evaluate(({ rootId, childId }) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const byId = new Map(nodes.map((o) => [o.id, o]));
      const childrenByParent = new Map();
      nodes.forEach((o) => {
        const m = o.properties?.mindmap || {};
        if (m.role !== 'child' || !m.parentId) return;
        if (!childrenByParent.has(m.parentId)) childrenByParent.set(m.parentId, []);
        childrenByParent.get(m.parentId).push(o.id);
      });
      const queue = [childId];
      const subtree = [];
      const seen = new Set();
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next || seen.has(next)) continue;
        seen.add(next);
        subtree.push(next);
        const nested = childrenByParent.get(next) || [];
        nested.forEach((id) => queue.push(id));
      }
      const siblings = nodes
        .filter((o) => {
          const m = o.properties?.mindmap || {};
          return m.role === 'child' && m.parentId === rootId && m.side === 'right';
        })
        .map((o) => o.id)
        .filter((id) => id !== childId);
      const rootNode = byId.get(rootId);
      return {
        rootPos: { x: Math.round(rootNode?.position?.x || 0), y: Math.round(rootNode?.position?.y || 0) },
        subtree: subtree.map((id) => {
          const node = byId.get(id);
          return { id, x: Math.round(node?.position?.x || 0), y: Math.round(node?.position?.y || 0) };
        }),
        siblings: siblings.map((id) => {
          const node = byId.get(id);
          return { id, x: Math.round(node?.position?.x || 0), y: Math.round(node?.position?.y || 0) };
        }),
      };
    }, { rootId: root.id, childId: draggedId });
    expect(before.subtree.length).toBeGreaterThanOrEqual(2);

    const mouseStart = await page.evaluate((nodeId) => {
      const el = document.querySelector(`.mb-text--mindmap[data-id="${nodeId}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
      };
    }, draggedId);
    expect(mouseStart).toBeTruthy();

    await page.mouse.move(mouseStart.x, mouseStart.y);
    await page.mouse.down();
    await page.mouse.move(mouseStart.x + 120, mouseStart.y + 40, { steps: 8 });

    await expect
      .poll(async () => {
        return page.evaluate(({ rootId, expected }) => {
          const board = window.moodboard.exportBoard();
          const byId = new Map((board?.objects || []).filter((o) => o.type === 'mindmap').map((o) => [o.id, o]));
          const rootNode = byId.get(rootId);
          if (!rootNode) return false;
          const rootStable = Math.abs(Math.round(rootNode.position?.x || 0) - expected.rootPos.x) <= 2
            && Math.abs(Math.round(rootNode.position?.y || 0) - expected.rootPos.y) <= 2;
          if (!rootStable) return false;
          const anchorPrev = expected.subtree[0];
          const anchorNow = anchorPrev ? byId.get(anchorPrev.id) : null;
          if (!anchorPrev || !anchorNow) return false;
          const dx = Math.round(anchorNow.position?.x || 0) - anchorPrev.x;
          const dy = Math.round(anchorNow.position?.y || 0) - anchorPrev.y;
          if (Math.abs(dx) < 40 || Math.abs(dy) < 10) return false;
          const subtreeMoved = expected.subtree.every((prev) => {
            const node = byId.get(prev.id);
            if (!node) return false;
            const x = Math.round(node.position?.x || 0);
            const y = Math.round(node.position?.y || 0);
            return Math.abs((x - prev.x) - dx) <= 2 && Math.abs((y - prev.y) - dy) <= 2;
          });
          if (!subtreeMoved) return false;
          return expected.siblings.every((prev) => {
            const node = byId.get(prev.id);
            if (!node) return false;
            const x = Math.round(node.position?.x || 0);
            const y = Math.round(node.position?.y || 0);
            return Math.abs(x - prev.x) <= 2 && Math.abs(y - prev.y) <= 2;
          });
        }, { rootId: root.id, expected: before });
      }, { timeout: 10000 })
      .toBe(true);

    await page.mouse.up();
  });

  test('mindmap drag into branch gap reorders sibling position', async ({ page }) => {
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
    const clickBottomForNode = async (nodeId) => {
      await selectNode(nodeId);
      await expect
        .poll(async () => {
          return page.evaluate((id) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
            return btn.getAttribute('data-id');
          }, nodeId);
        }, { timeout: 10000 })
        .toBe(nodeId);
    };
    const getRightBranchOrdered = async () => {
      return page.evaluate((rootId) => {
        const board = window.moodboard.exportBoard();
        const branch = (board?.objects || [])
          .filter((o) => o.type === 'mindmap')
          .filter((o) => {
            const m = o.properties?.mindmap || {};
            return m.role === 'child' && m.parentId === rootId && m.side === 'right';
          })
          .sort((a, b) => {
            const ao = Number.isFinite(a?.properties?.mindmap?.branchOrder) ? Number(a.properties.mindmap.branchOrder) : null;
            const bo = Number.isFinite(b?.properties?.mindmap?.branchOrder) ? Number(b.properties.mindmap.branchOrder) : null;
            if (ao !== null && bo !== null && ao !== bo) return ao - bo;
            if (ao !== null && bo === null) return -1;
            if (ao === null && bo !== null) return 1;
            return (a.position?.y || 0) - (b.position?.y || 0);
          })
          .map((o) => ({
            id: o.id,
            x: Math.round(o.position?.x || 0),
            y: Math.round(o.position?.y || 0),
            order: Number.isFinite(o?.properties?.mindmap?.branchOrder) ? Number(o.properties.mindmap.branchOrder) : null,
          }));
        return branch;
      }, root.id);
    };

    await selectNode(root.id);
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`).click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const firstChildId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const child = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId);
      return child?.id || null;
    }, root.id);
    expect(firstChildId).toBeTruthy();

    await clickBottomForNode(firstChildId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);
    await clickBottomForNode(firstChildId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(4);

    const before = await getRightBranchOrdered();
    expect(before.length).toBe(3);
    const sourceId = before[2].id;
    const targetGapY = Math.round((before[0].y + before[1].y) / 2);

    await page.evaluate(({ id, y }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === id);
      if (!node) return;
      core.eventBus.emit('tool:group:drag:start', { objects: [id] });
      core.updateObjectPositionDirect(id, { x: Math.round(node.position?.x || 0), y: Math.round(y) }, { snap: false });
      core.eventBus.emit('tool:group:drag:end', { objects: [id] });
    }, { id: sourceId, y: targetGapY });

    await expect
      .poll(async () => {
        const after = await getRightBranchOrdered();
        if (after.length !== 3) return false;
        const idx = after.findIndex((node) => node.id === sourceId);
        if (idx !== 1) return false;
        return after.every((node, order) => node.order === order);
      }, { timeout: 10000 })
      .toBe(true);
  });

  test('mindmap nested reorder with subtree drag payload updates sibling order', async ({ page }) => {
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
    const clickSideForNode = async (nodeId, side) => {
      await selectNode(nodeId);
      await expect
        .poll(async () => {
          return page.evaluate(({ id, nextSide }) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="${nextSide}"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
            return btn.getAttribute('data-id');
          }, { id: nodeId, nextSide: side });
        }, { timeout: 10000 })
        .toBe(nodeId);
    };

    await clickSideForNode(root.id, 'right');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const childAId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const child = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId);
      return child?.id || null;
    }, root.id);
    expect(childAId).toBeTruthy();

    await clickSideForNode(childAId, 'right');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);

    const nestedRootId = await page.evaluate(({ rootId, childId }) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId && o.id !== childId);
      return node?.id || null;
    }, { rootId: root.id, childId: childAId });
    expect(nestedRootId).toBeTruthy();

    await clickSideForNode(nestedRootId, 'bottom');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(4);
    await clickSideForNode(nestedRootId, 'bottom');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(5);

    const branchMeta = await page.evaluate((nodeId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === nodeId);
      const m = node?.properties?.mindmap || {};
      return { parentId: m.parentId || null, side: m.side || null };
    }, nestedRootId);
    expect(branchMeta.parentId).toBeTruthy();
    expect(branchMeta.side).toBe('right');

    const getBranch = async () => {
      return page.evaluate(({ parentId, side }) => {
        const board = window.moodboard.exportBoard();
        return (board?.objects || [])
          .filter((o) => o.type === 'mindmap')
          .filter((o) => {
            const m = o.properties?.mindmap || {};
            return m.role === 'child' && m.parentId === parentId && m.side === side;
          })
          .sort((a, b) => {
            const ao = Number.isFinite(a?.properties?.mindmap?.branchOrder) ? Number(a.properties.mindmap.branchOrder) : null;
            const bo = Number.isFinite(b?.properties?.mindmap?.branchOrder) ? Number(b.properties.mindmap.branchOrder) : null;
            if (ao !== null && bo !== null && ao !== bo) return ao - bo;
            if (ao !== null && bo === null) return -1;
            if (ao === null && bo !== null) return 1;
            return (a.position?.y || 0) - (b.position?.y || 0);
          })
          .map((o) => ({
            id: o.id,
            x: Math.round(o.position?.x || 0),
            y: Math.round(o.position?.y || 0),
            order: Number.isFinite(o?.properties?.mindmap?.branchOrder) ? Number(o.properties.mindmap.branchOrder) : null,
          }));
      }, branchMeta);
    };

    const before = await getBranch();
    expect(before.length).toBe(3);
    const sourceId = before[2].id;
    const targetGapY = Math.round((before[0].y + before[1].y) / 2);
    const expectedMiddleY = before[1].y;

    await clickSideForNode(sourceId, 'right');
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(6);

    const sourceDescendantId = await page.evaluate((parentId) => {
      const board = window.moodboard.exportBoard();
      const child = (board?.objects || []).find((o) => o.type === 'mindmap' && o.properties?.mindmap?.parentId === parentId);
      return child?.id || null;
    }, sourceId);
    expect(sourceDescendantId).toBeTruthy();

    await page.evaluate(({ id, y, descendantId }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === id);
      if (!node) return;
      const dragIds = descendantId ? [id, descendantId] : [id];
      core.eventBus.emit('tool:group:drag:start', { objects: dragIds });
      core.updateObjectPositionDirect(id, { x: Math.round(node.position?.x || 0), y: Math.round(y) }, { snap: false });
      core.eventBus.emit('tool:group:drag:end', { objects: dragIds });
    }, { id: sourceId, y: targetGapY, descendantId: sourceDescendantId });

    await expect
      .poll(async () => {
        const after = await getBranch();
        if (after.length !== 3) return false;
        const idx = after.findIndex((node) => node.id === sourceId);
        if (idx !== 1) return false;
        if (!after.every((node, order) => node.order === order)) return false;
        const source = after.find((node) => node.id === sourceId);
        if (!source) return false;
        return Math.abs(source.y - expectedMiddleY) <= 1;
      }, { timeout: 10000 })
      .toBe(true);
  });

  test('mindmap drop on another node reparents dragged node as child', async ({ page }) => {
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
    const clickBottomForNode = async (nodeId) => {
      await selectNode(nodeId);
      await expect
        .poll(async () => {
          return page.evaluate((id) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
            return btn.getAttribute('data-id');
          }, nodeId);
        }, { timeout: 10000 })
        .toBe(nodeId);
    };

    await selectNode(root.id);
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`).click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const childAId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId);
      return node?.id || null;
    }, root.id);
    expect(childAId).toBeTruthy();

    await clickBottomForNode(childAId);
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);

    const before = await page.evaluate(({ rootId, childId }) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const dragged = nodes.find((o) => o.id !== rootId && o.id !== childId) || null;
      const target = nodes.find((o) => o.id === childId) || null;
      return {
        dragged: dragged ? {
          id: dragged.id,
          parentId: dragged.properties?.mindmap?.parentId || null,
          x: Math.round(dragged.position?.x || 0),
          y: Math.round(dragged.position?.y || 0),
          width: Math.round(dragged.width || dragged.properties?.width || 0),
          height: Math.round(dragged.height || dragged.properties?.height || 0),
        } : null,
        target: target ? {
          id: target.id,
          x: Math.round(target.position?.x || 0),
          y: Math.round(target.position?.y || 0),
          width: Math.round(target.width || target.properties?.width || 0),
          height: Math.round(target.height || target.properties?.height || 0),
        } : null,
      };
    }, { rootId: root.id, childId: childAId });
    expect(before?.dragged?.id).toBeTruthy();
    expect(before?.target?.id).toBeTruthy();
    expect(before.dragged.parentId).toBe(root.id);

    const dropPos = {
      x: Math.round(
        before.target.x
        + Math.round(before.target.width / 2)
        - Math.round((before.dragged.width || 0) / 2)
      ),
      y: Math.round(
        before.target.y
        + Math.round(before.target.height / 2)
        - Math.round((before.dragged.height || 0) / 2)
      ),
    };
    await page.evaluate(({ draggedId, pos }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('tool:group:drag:start', { objects: [draggedId] });
      core.updateObjectPositionDirect(draggedId, { x: pos.x, y: pos.y }, { snap: false });
      core.eventBus.emit('tool:group:drag:end', { objects: [draggedId] });
    }, { draggedId: before.dragged.id, pos: dropPos });

    await expect
      .poll(async () => {
        return page.evaluate(({ draggedId, targetId }) => {
          const board = window.moodboard.exportBoard();
          const dragged = (board?.objects || []).find((o) => o.id === draggedId);
          if (!dragged) return false;
          const meta = dragged.properties?.mindmap || {};
          if (meta.parentId !== targetId || meta.role !== 'child') return false;
          const seg = (window.moodboardMindmapConnectionLayer?._lastSegments || []).find((s) => s.childId === draggedId) || null;
          return !!seg && seg.parentId === targetId;
        }, { draggedId: before.dragged.id, targetId: before.target.id });
      }, { timeout: 10000 })
      .toBe(true);
  });

  test('mindmap reparent across compounds updates subtree compoundId', async ({ page }) => {
    await page.click('.moodboard-toolbar__button--mindmap');
    const canvas = page.locator('.moodboard-workspace__canvas canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.5);

    const closeEditor = async () => {
      await page.keyboard.press('Escape');
      await page.mouse.click(canvasBox.x + canvasBox.width - 8, canvasBox.y + 8);
      await expect
        .poll(async () => page.evaluate(() => document.querySelectorAll('.moodboard-text-input').length))
        .toBe(0);
    };
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
    const clickBottomForNode = async (nodeId) => {
      await closeEditor();
      await selectNode(nodeId);
      await expect
        .poll(async () => {
          return page.evaluate((id) => {
            const core = window.moodboard?.coreMoodboard;
            if (core) {
              core.eventBus.emit('keyboard:tool-select', { tool: 'select' });
              const tm = core.toolManager;
              const selectTool = tm?.tools?.get?.('select') || tm?.registry?.get?.('select');
              if (selectTool) {
                selectTool.setSelection([id]);
                if (typeof selectTool.updateResizeHandles === 'function') {
                  selectTool.updateResizeHandles();
                }
              }
            }
            const btn = document.querySelector(`.mb-mindmap-side-btn[data-side="bottom"][data-id="${id}"]`);
            if (!btn) return null;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
            return btn.getAttribute('data-id');
          }, nodeId);
        }, { timeout: 10000 })
        .toBe(nodeId);
    };

    const rootA = await getMindmapObject(page);
    expect(rootA?.id).toBeTruthy();

    await closeEditor();
    await selectNode(rootA.id);
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${rootA.id}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${rootA.id}"]`).click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(2);

    const childAId = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.type === 'mindmap' && o.id !== rootId);
      return node?.id || null;
    }, rootA.id);
    expect(childAId).toBeTruthy();

    await closeEditor();
    await selectNode(childAId);
    await expect(page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${childAId}"]`)).toBeVisible();
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${childAId}"]`).click();
    await expect.poll(async () => {
      const board = await page.evaluate(() => window.moodboard.exportBoard());
      return (board?.objects || []).filter((o) => o.type === 'mindmap').length;
    }).toBe(3);

    const beforeCreateRootB = await page.evaluate(({ rootId, childId }) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const grand = nodes.find((o) => {
        if (o.id === rootId || o.id === childId) return false;
        const m = o.properties?.mindmap || {};
        return m.parentId === childId;
      }) || null;
      const root = nodes.find((o) => o.id === rootId) || null;
      const child = nodes.find((o) => o.id === childId) || null;
      return {
        grandId: grand?.id || null,
        rootCompound: root?.properties?.mindmap?.compoundId || null,
        childCompound: child?.properties?.mindmap?.compoundId || null,
      };
    }, { rootId: rootA.id, childId: childAId });
    expect(beforeCreateRootB.grandId).toBeTruthy();
    expect(beforeCreateRootB.rootCompound).toBeTruthy();
    expect(beforeCreateRootB.childCompound).toBe(beforeCreateRootB.rootCompound);

    await closeEditor();
    await page.click('.moodboard-toolbar__button--mindmap');
    await page.mouse.click(canvasBox.x + canvasBox.width * 0.75, canvasBox.y + canvasBox.height * 0.5);
    await closeEditor();

    const roots = await page.evaluate(() => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || [])
        .filter((o) => o.type === 'mindmap')
        .filter((o) => (o.properties?.mindmap?.role || null) === 'root')
        .map((o) => ({
          id: o.id,
          x: Math.round(o.position?.x || 0),
          y: Math.round(o.position?.y || 0),
          width: Math.round(o.width || o.properties?.width || 0),
          height: Math.round(o.height || o.properties?.height || 0),
          compoundId: o.properties?.mindmap?.compoundId || null,
        }));
    });
    expect(roots.length).toBe(2);
    const rootB = roots.find((r) => r.id !== rootA.id);
    expect(rootB?.id).toBeTruthy();

    const childAState = await page.evaluate((id) => {
      const board = window.moodboard.exportBoard();
      const node = (board?.objects || []).find((o) => o.id === id);
      if (!node) return null;
      return {
        x: Math.round(node.position?.x || 0),
        y: Math.round(node.position?.y || 0),
        width: Math.round(node.width || node.properties?.width || 0),
        height: Math.round(node.height || node.properties?.height || 0),
      };
    }, childAId);
    expect(childAState).toBeTruthy();

    const dropPos = {
      x: Math.round(
        rootB.x
        + Math.round((rootB.width || 0) / 2)
        - Math.round((childAState.width || 0) / 2)
      ),
      y: Math.round(
        rootB.y
        + Math.round((rootB.height || 0) / 2)
        - Math.round((childAState.height || 0) / 2)
      ),
    };
    await page.evaluate(({ draggedId, pos }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('tool:group:drag:start', { objects: [draggedId] });
      core.updateObjectPositionDirect(draggedId, { x: pos.x, y: pos.y }, { snap: false });
      core.eventBus.emit('tool:group:drag:end', { objects: [draggedId] });
    }, { draggedId: childAId, pos: dropPos });

    await expect
      .poll(async () => {
        return page.evaluate(({ draggedId, grandId, targetRootId }) => {
          const board = window.moodboard.exportBoard();
          const dragged = (board?.objects || []).find((o) => o.id === draggedId);
          const grand = (board?.objects || []).find((o) => o.id === grandId);
          const targetRoot = (board?.objects || []).find((o) => o.id === targetRootId);
          if (!dragged || !grand || !targetRoot) return false;
          const draggedMeta = dragged.properties?.mindmap || {};
          const grandMeta = grand.properties?.mindmap || {};
          const targetCompound = targetRoot.properties?.mindmap?.compoundId || null;
          if (!targetCompound) return false;
          const seg = (window.moodboardMindmapConnectionLayer?._lastSegments || []).find((s) => s.childId === draggedId) || null;
          return (
            draggedMeta.parentId === targetRootId &&
            draggedMeta.compoundId === targetCompound &&
            grandMeta.compoundId === targetCompound &&
            !!seg &&
            seg.parentId === targetRootId
          );
        }, { draggedId: childAId, grandId: beforeCreateRootB.grandId, targetRootId: rootB.id });
      }, { timeout: 10000 })
      .toBe(true);
  });

  test('mindmap full-tree drag keeps moved position and structure', async ({ page }) => {
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
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${root.id}"]`).click();

    const child = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      return (board?.objects || []).find((o) => {
        if (o.type !== 'mindmap' || o.id === rootId) return false;
        const m = o.properties?.mindmap || {};
        return m.role === 'child' && m.parentId === rootId && m.side === 'right';
      }) || null;
    }, root.id);
    expect(child?.id).toBeTruthy();

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
    }, child.id);
    await page.locator(`.mb-mindmap-side-btn[data-side="right"][data-id="${child.id}"]`).click();

    const before = await page.evaluate((rootId) => {
      const board = window.moodboard.exportBoard();
      const nodes = (board?.objects || []).filter((o) => o.type === 'mindmap');
      const rootNode = nodes.find((o) => o.id === rootId);
      const rootMeta = rootNode?.properties?.mindmap || {};
      const compoundId = rootMeta.compoundId || rootId;
      const treeNodes = nodes.filter((o) => (o.properties?.mindmap?.compoundId || o.id) === compoundId);
      const map = {};
      treeNodes.forEach((n) => {
        map[n.id] = { x: Math.round(n.position?.x || 0), y: Math.round(n.position?.y || 0) };
      });
      const firstChild = treeNodes.find((n) => (n.properties?.mindmap?.parentId || null) === rootId) || null;
      return {
        ids: treeNodes.map((n) => n.id),
        rootId,
        map,
        childId: firstChild?.id || null,
      };
    }, root.id);
    expect(before?.ids?.length).toBeGreaterThan(1);
    expect(before?.childId).toBeTruthy();

    const dx = 130;
    const dy = 80;
    await page.evaluate(({ ids, map, dx: offsetX, dy: offsetY }) => {
      const core = window.moodboard?.coreMoodboard;
      if (!core) return;
      core.eventBus.emit('tool:group:drag:start', { objects: ids });
      ids.forEach((id) => {
        const pos = map[id];
        if (!pos) return;
        core.updateObjectPositionDirect(id, { x: pos.x + offsetX, y: pos.y + offsetY }, { snap: false });
      });
      core.eventBus.emit('tool:group:drag:end', { objects: ids });
    }, { ids: before.ids, map: before.map, dx, dy });

    await expect
      .poll(async () => {
        return page.evaluate(({ rootId, childId, beforeMap, dx: offsetX, dy: offsetY }) => {
          const board = window.moodboard.exportBoard();
          const rootNode = (board?.objects || []).find((o) => o.id === rootId);
          const childNode = (board?.objects || []).find((o) => o.id === childId);
          if (!rootNode || !childNode) return false;
          const rootBefore = beforeMap[rootId];
          const childBefore = beforeMap[childId];
          if (!rootBefore || !childBefore) return false;
          const rootX = Math.round(rootNode.position?.x || 0);
          const rootY = Math.round(rootNode.position?.y || 0);
          const childX = Math.round(childNode.position?.x || 0);
          const childY = Math.round(childNode.position?.y || 0);
          const movedRoot = Math.abs(rootX - (rootBefore.x + offsetX)) <= 1 && Math.abs(rootY - (rootBefore.y + offsetY)) <= 1;
          const beforeDeltaX = childBefore.x - rootBefore.x;
          const beforeDeltaY = childBefore.y - rootBefore.y;
          const afterDeltaX = childX - rootX;
          const afterDeltaY = childY - rootY;
          const keptStructure = Math.abs(afterDeltaX - beforeDeltaX) <= 1 && Math.abs(afterDeltaY - beforeDeltaY) <= 1;
          return movedRoot && keptStructure;
        }, { rootId: before.rootId, childId: before.childId, beforeMap: before.map, dx, dy });
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
