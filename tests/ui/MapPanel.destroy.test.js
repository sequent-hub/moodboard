/**
 * Baseline-тесты: MapPanel.destroy() должен корректно очищать ресурсы:
 * document.removeEventListener(mousedown), вызов hidePopup при открытом popup,
 * window.removeEventListener(resize), document mousemove/mouseup, cancelAnimationFrame.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import { MapPanel } from '../../src/ui/MapPanel.js';

const mockCtx = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  fillStyle: '',
  fillRect: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  strokeRect: vi.fn(),
};

function createEventBus() {
  const handlers = new Map();
  return {
    on: vi.fn(),
    emit: vi.fn((event, data) => {
      if (event === Events.UI.MinimapGetData && data) {
        data.world = { x: 0, y: 0, scale: 1 };
        data.view = { width: 800, height: 600 };
        data.objects = [];
      }
      if (event === Events.Tool.GetSelection && data) {
        data.selection = [];
      }
    }),
    off: vi.fn(),
    _handlers: handlers,
  };
}

function mockCanvasGetContext() {
  return vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx);
}

describe('MapPanel destroy', () => {
  let container;
  let mapbar;
  let eventBus;
  let documentAddSpy;
  let documentRemoveSpy;
  let windowAddSpy;
  let windowRemoveSpy;
  let rafSpy;
  let cancelRafSpy;

  let getContextSpy;
  let getBoundingClientRectSpy;

  beforeEach(() => {
    getContextSpy = mockCanvasGetContext();
    getBoundingClientRectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, width: 200, height: 150, top: 0, left: 0, right: 200, bottom: 150,
    });
    documentAddSpy = vi.spyOn(document, 'addEventListener');
    documentRemoveSpy = vi.spyOn(document, 'removeEventListener');
    windowAddSpy = vi.spyOn(window, 'addEventListener');
    windowRemoveSpy = vi.spyOn(window, 'removeEventListener');
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(() => cb(0), 0);
    });
    cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame');
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    eventBus = createEventBus();
    mapbar = new MapPanel(container, eventBus);
  });

  afterEach(() => {
    mapbar?.destroy?.();
    container?.remove();
    getContextSpy?.mockRestore?.();
    getBoundingClientRectSpy?.mockRestore?.();
    documentAddSpy?.mockRestore?.();
    documentRemoveSpy?.mockRestore?.();
    windowAddSpy?.mockRestore?.();
    windowRemoveSpy?.mockRestore?.();
    rafSpy?.mockRestore?.();
    cancelRafSpy?.mockRestore?.();
    vi.restoreAllMocks();
  });

  it('destroy removes element from DOM', () => {
    expect(container.querySelector('.moodboard-mapbar')).toBeTruthy();
    mapbar.destroy();
    expect(container.querySelector('.moodboard-mapbar')).toBeNull();
    expect(mapbar.element).toBeNull();
  });

  it('destroy calls document.removeEventListener(mousedown) with same handler as addEventListener', () => {
    const addMousedownCalls = documentAddSpy.mock.calls.filter((c) => c[0] === 'mousedown');
    expect(addMousedownCalls.length).toBeGreaterThanOrEqual(1);
    const addedHandler = addMousedownCalls[0][1];

    mapbar.destroy();

    const removeMousedownCalls = documentRemoveSpy.mock.calls.filter((c) => c[0] === 'mousedown');
    expect(removeMousedownCalls.length).toBeGreaterThanOrEqual(1);
    expect(removeMousedownCalls.some((c) => c[1] === addedHandler)).toBe(true);
  });

  it('destroy with popup open removes window resize and document mousemove/mouseup listeners', () => {
    const btn = mapbar.element.querySelector('.moodboard-mapbar__button');
    btn.click();
    expect(mapbar.popupEl).toBeTruthy();

    const resizeAdded = windowAddSpy.mock.calls.filter((c) => c[0] === 'resize');
    const moveAdded = documentAddSpy.mock.calls.filter((c) => c[0] === 'mousemove');
    const upAdded = documentAddSpy.mock.calls.filter((c) => c[0] === 'mouseup');
    expect(resizeAdded.length).toBeGreaterThanOrEqual(1);
    expect(moveAdded.length).toBeGreaterThanOrEqual(1);
    expect(upAdded.length).toBeGreaterThanOrEqual(1);

    mapbar.destroy();

    const resizeRemoved = windowRemoveSpy.mock.calls.filter((c) => c[0] === 'resize');
    const moveRemoved = documentRemoveSpy.mock.calls.filter((c) => c[0] === 'mousemove');
    const upRemoved = documentRemoveSpy.mock.calls.filter((c) => c[0] === 'mouseup');
    expect(resizeRemoved.length).toBeGreaterThanOrEqual(1);
    expect(moveRemoved.length).toBeGreaterThanOrEqual(1);
    expect(upRemoved.length).toBeGreaterThanOrEqual(1);
    expect(resizeRemoved[0][1]).toBe(resizeAdded[0][1]);
  });

  it('destroy with popup open cancels requestAnimationFrame', () => {
    const btn = mapbar.element.querySelector('.moodboard-mapbar__button');
    btn.click();
    expect(mapbar.popupEl).toBeTruthy();
    expect(rafSpy).toHaveBeenCalled();

    mapbar.destroy();

    expect(cancelRafSpy).toHaveBeenCalled();
  });

  it('destroy is idempotent', () => {
    mapbar.destroy();
    expect(() => mapbar.destroy()).not.toThrow();
  });
});
