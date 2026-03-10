/**
 * Baseline-тесты: Toolbar.destroy() должен корректно очищать ресурсы,
 * в том числе удалять document-level listener (клик вне попапов).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../src/core/events/Events.js';

vi.mock('../../src/utils/iconLoader.js', () => ({
  IconLoader: class {
    async init() {}
    async loadAllIcons() {
      return {
        image: '<svg></svg>',
        shapes: '<svg></svg>',
        pencil: '<svg></svg>',
        emoji: '<svg></svg>',
        frame: '<svg></svg>'
      };
    }
  }
}));

vi.mock('../../src/utils/inlinePngEmojis.js', () => ({
  getInlinePngEmojiUrl: () => 'data:image/png;base64,iVBORw0KGgo='
}));

import { Toolbar } from '../../src/ui/Toolbar.js';

function createEventBus() {
  const handlers = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(handler);
    }),
    emit: vi.fn(),
    off: vi.fn((event, handler) => {
      if (handlers.has(event)) {
        const list = handlers.get(event);
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    }),
    removeAllListeners: vi.fn((event) => {
      if (event) handlers.delete(event);
      else handlers.clear();
    }),
    _handlers: handlers
  };
}

async function flushToolbarInit() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Toolbar destroy', () => {
  let container;
  let toolbar;
  let eventBus;
  let documentAddSpy;
  let documentRemoveSpy;

  beforeEach(async () => {
    documentAddSpy = vi.spyOn(document, 'addEventListener');
    documentRemoveSpy = vi.spyOn(document, 'removeEventListener');
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = createEventBus();
    toolbar = new Toolbar(container, eventBus);
    await flushToolbarInit();
  });

  afterEach(() => {
    toolbar?.destroy?.();
    container?.remove();
    documentAddSpy?.mockRestore?.();
    documentRemoveSpy?.mockRestore?.();
    vi.restoreAllMocks();
  });

  it('destroy вызывает document.removeEventListener(click) с тем же handler, что addEventListener', () => {
    const addClickCalls = documentAddSpy.mock.calls.filter((c) => c[0] === 'click');
    expect(addClickCalls.length).toBeGreaterThanOrEqual(1);
    const addedHandler = addClickCalls[0][1];

    toolbar.destroy();

    const removeClickCalls = documentRemoveSpy.mock.calls.filter((c) => c[0] === 'click');
    expect(removeClickCalls.length).toBeGreaterThanOrEqual(1);
    expect(removeClickCalls[0][1]).toBe(addedHandler);
  });

  it('destroy вызывает eventBus.removeAllListeners для UpdateHistoryButtons', () => {
    toolbar.destroy();
    expect(eventBus.removeAllListeners).toHaveBeenCalledWith(Events.UI.UpdateHistoryButtons);
  });

  it('destroy отписывается от Events.Tool.Activated (через off или removeAllListeners)', () => {
    const toolActivatedCalls = eventBus.on.mock.calls.filter((c) => c[0] === Events.Tool.Activated);
    expect(toolActivatedCalls.length).toBeGreaterThanOrEqual(1);

    toolbar.destroy();

    const offCalls = eventBus.off.mock.calls;
    const removeCalls = eventBus.removeAllListeners.mock.calls;
    const toolActivatedRemoved =
      offCalls.some((c) => c[0] === Events.Tool.Activated) ||
      removeCalls.some((c) => c[0] === Events.Tool.Activated || c.length === 0);
    expect(toolActivatedRemoved).toBe(true);
  });
});
