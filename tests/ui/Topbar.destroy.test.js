/**
 * Baseline-тесты: Topbar.destroy() должен корректно очищать ресурсы:
 * eventBus.off для GridCurrent и PaintPick, document click listener при открытом popover.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

const mockIcons = {
  'grid-line': '<svg></svg>',
  'grid-dot': '<svg></svg>',
  'grid-cross': '<svg></svg>',
  'grid-off': '<svg></svg>',
  paint: '<svg></svg>',
};

vi.mock('../../src/utils/topbarIconLoader.js', () => ({
  TopbarIconLoader: class MockTopbarIconLoader {
    constructor() {
      this.icons = {};
    }
    async loadAllIcons() {
      return mockIcons;
    }
  }
}));

import { Topbar } from '../../src/ui/Topbar.js';

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
    _handlers: handlers,
  };
}

async function flushTopbarInit() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Topbar destroy', () => {
  let container;
  let topbar;
  let eventBus;
  let documentAddSpy;
  let documentRemoveSpy;

  beforeEach(async () => {
    documentAddSpy = vi.spyOn(document, 'addEventListener');
    documentRemoveSpy = vi.spyOn(document, 'removeEventListener');
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = createEventBus();
    topbar = new Topbar(container, eventBus);
    await flushTopbarInit();
  });

  afterEach(() => {
    topbar?.destroy?.();
    container?.remove();
    documentAddSpy?.mockRestore?.();
    documentRemoveSpy?.mockRestore?.();
    vi.restoreAllMocks();
  });

  it('destroy removes element from DOM', async () => {
    expect(container.querySelector('.moodboard-topbar')).toBeTruthy();
    topbar.destroy();
    expect(container.querySelector('.moodboard-topbar')).toBeNull();
    expect(topbar.element).toBeNull();
  });

  it('destroy calls eventBus.off for GridCurrent and PaintPick', async () => {
    const gridCurrentCalls = eventBus.on.mock.calls.filter((c) => c[0] === Events.UI.GridCurrent);
    const paintPickCalls = eventBus.on.mock.calls.filter((c) => c[0] === Events.UI.PaintPick);
    expect(gridCurrentCalls.length).toBeGreaterThanOrEqual(1);
    expect(paintPickCalls.length).toBeGreaterThanOrEqual(1);

    topbar.destroy();

    const offCalls = eventBus.off.mock.calls;
    const gridCurrentOff = offCalls.some((c) => c[0] === Events.UI.GridCurrent);
    const paintPickOff = offCalls.some((c) => c[0] === Events.UI.PaintPick);
    expect(gridCurrentOff).toBe(true);
    expect(paintPickOff).toBe(true);
  });

  it('destroy with popover open calls document.removeEventListener for outside-click handler', async () => {
    const paintBtn = topbar.element.querySelector('.moodboard-topbar__button--paint');
    expect(paintBtn).toBeTruthy();
    paintBtn.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(topbar._paintPopover).toBeTruthy();

    const addClickCalls = documentAddSpy.mock.calls.filter((c) => c[0] === 'click');
    expect(addClickCalls.length).toBeGreaterThanOrEqual(1);
    const addedHandler = addClickCalls[addClickCalls.length - 1][1];

    topbar.destroy();

    const removeClickCalls = documentRemoveSpy.mock.calls.filter((c) => c[0] === 'click');
    expect(removeClickCalls.length).toBeGreaterThanOrEqual(1);
    expect(removeClickCalls.some((c) => c[1] === addedHandler)).toBe(true);
  });

  it('destroy is idempotent (second call does not throw)', async () => {
    topbar.destroy();
    expect(() => topbar.destroy()).not.toThrow();
  });
});
