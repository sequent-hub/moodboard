/**
 * Baseline-тесты: ZoomPanel.destroy() должен корректно очищать ресурсы:
 * document.removeEventListener(mousedown), eventBus.off(ZoomPercent), обнуление ссылок.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { ZoomPanel } from '../../src/ui/ZoomPanel.js';

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

describe('ZoomPanel destroy', () => {
  let container;
  let zoombar;
  let eventBus;
  let documentAddSpy;
  let documentRemoveSpy;

  beforeEach(() => {
    documentAddSpy = vi.spyOn(document, 'addEventListener');
    documentRemoveSpy = vi.spyOn(document, 'removeEventListener');
    container = document.createElement('div');
    document.body.appendChild(container);
    eventBus = createEventBus();
    zoombar = new ZoomPanel(container, eventBus);
  });

  afterEach(() => {
    zoombar?.destroy?.();
    container?.remove();
    documentAddSpy?.mockRestore?.();
    documentRemoveSpy?.mockRestore?.();
    vi.restoreAllMocks();
  });

  it('destroy removes element from DOM', () => {
    expect(container.querySelector('.moodboard-zoombar')).toBeTruthy();
    zoombar.destroy();
    expect(container.querySelector('.moodboard-zoombar')).toBeNull();
    expect(zoombar.element).toBeNull();
  });

  it('destroy calls eventBus.off for ZoomPercent', () => {
    const zoomPercentCalls = eventBus.on.mock.calls.filter((c) => c[0] === Events.UI.ZoomPercent);
    expect(zoomPercentCalls.length).toBe(1);

    zoombar.destroy();

    const offCalls = eventBus.off.mock.calls;
    const zoomPercentOff = offCalls.some((c) => c[0] === Events.UI.ZoomPercent);
    expect(zoomPercentOff).toBe(true);
    expect(offCalls.find((c) => c[0] === Events.UI.ZoomPercent)[1]).toBe(zoomPercentCalls[0][1]);
  });

  it('destroy calls document.removeEventListener(mousedown) with same handler as addEventListener', () => {
    const addMousedownCalls = documentAddSpy.mock.calls.filter((c) => c[0] === 'mousedown');
    expect(addMousedownCalls.length).toBeGreaterThanOrEqual(1);
    const addedHandler = addMousedownCalls[0][1];

    zoombar.destroy();

    const removeMousedownCalls = documentRemoveSpy.mock.calls.filter((c) => c[0] === 'mousedown');
    expect(removeMousedownCalls.length).toBeGreaterThanOrEqual(1);
    expect(removeMousedownCalls.some((c) => c[1] === addedHandler)).toBe(true);
  });

  it('destroy is idempotent', () => {
    zoombar.destroy();
    expect(() => zoombar.destroy()).not.toThrow();
  });

  it('ZoomPercent after destroy does not throw (valueEl nulled)', () => {
    const zoomPercentHandler = eventBus.on.mock.calls.find((c) => c[0] === Events.UI.ZoomPercent)?.[1];
    expect(zoomPercentHandler).toBeTruthy();

    zoombar.destroy();

    expect(() => zoomPercentHandler({ percentage: 150 })).not.toThrow();
  });
});
