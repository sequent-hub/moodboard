/**
 * Baseline-тесты: PlacementTool должен корректно добавлять и удалять
 * обработчик mousemove при activate/deactivate.
 * Проблема: addEventListener/removeEventListener с .bind(this) создаёт разные
 * ссылки на функцию — handler не удаляется, утечка памяти.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/assets/icons/i-cursor.svg?raw', () => ({
  default: '<svg width="32px" height="64px"></svg>'
}));

vi.mock('pixi.js', () => ({
  Container: vi.fn(() => ({
    addChild: vi.fn(),
    removeChild: vi.fn(),
    destroy: vi.fn(),
    children: [],
    alpha: 1,
    x: 0,
    y: 0,
    pivot: { x: 0, y: 0, set: vi.fn() }
  })),
  Graphics: vi.fn(() => ({ /* ... */ })),
  Texture: { fromURL: vi.fn().mockResolvedValue({ width: 64, height: 64 }) }
}));

import { PlacementTool } from '../../src/tools/object-tools/PlacementTool.js';

function createMockEventBus() {
  const handlers = {};
  return {
    on: vi.fn((event, handler) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    emit: vi.fn()
  };
}

function createMockApp() {
  return {
    view: {
      style: { cursor: '' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 }))
    },
    renderer: {
      events: { cursorStyles: { pointer: 'pointer', default: 'default' } }
    }
  };
}

describe('PlacementTool mousemove handler cleanup', () => {
  let eventBus;
  let tool;
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = createMockEventBus();
    tool = new PlacementTool(eventBus);
    app = createMockApp();
  });

  it('activate добавляет mousemove listener на app.view', () => {
    tool.activate(app);

    expect(app.view.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
  });

  it('deactivate удаляет mousemove listener той же ссылкой, что и addEventListener', () => {
    tool.activate(app);
    const addedHandler = app.view.addEventListener.mock.calls.find((c) => c[0] === 'mousemove')?.[1];
    expect(addedHandler).toBeDefined();

    tool.deactivate(app);

    expect(app.view.removeEventListener).toHaveBeenCalledWith('mousemove', addedHandler);
  });

  it('повторный activate/deactivate не накапливает listeners (один add = один remove)', () => {
    tool.activate(app);
    tool.deactivate(app);
    tool.activate(app);
    tool.deactivate(app);

    expect(app.view.addEventListener).toHaveBeenCalledTimes(2);
    expect(app.view.removeEventListener).toHaveBeenCalledTimes(2);
    const addCalls = app.view.addEventListener.mock.calls.filter((c) => c[0] === 'mousemove');
    const removeCalls = app.view.removeEventListener.mock.calls.filter((c) => c[0] === 'mousemove');
    expect(addCalls.length).toBe(2);
    expect(removeCalls.length).toBe(2);
    expect(removeCalls[0][1]).toBe(addCalls[0][1]);
    expect(removeCalls[1][1]).toBe(addCalls[1][1]);
  });
});
