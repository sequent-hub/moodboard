/**
 * BoardService: при смене типа сетки старый grid.destroy() вызывается (предотвращение утечки).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

const mockLineGrid = vi.fn(() => ({
  type: 'line',
  enabled: true,
  getPixiObject: vi.fn(() => ({ zIndex: 0, x: 0, y: 0 })),
  updateVisual: vi.fn(),
  setEnabled: vi.fn(),
  serialize: vi.fn(() => ({})),
  destroy: vi.fn(),
}));

const mockDotGrid = vi.fn(() => ({
  type: 'dot',
  enabled: true,
  getPixiObject: vi.fn(() => ({ zIndex: 0, x: 0, y: 0 })),
  updateVisual: vi.fn(),
  setEnabled: vi.fn(),
  serialize: vi.fn(() => ({})),
  destroy: vi.fn(),
}));

vi.mock('../../src/grid/GridFactory.js', () => ({
  GridFactory: {
    createGrid: vi.fn((type) => {
      if (type === 'line') return mockLineGrid();
      if (type === 'dot') return mockDotGrid();
      throw new Error(`Unknown type: ${type}`);
    }),
    getDefaultOptions: vi.fn((type) => ({
      enabled: true,
      width: 800,
      height: 600,
    })),
  },
}));

import { EventBus } from '../../src/core/EventBus.js';
import { BoardService } from '../../src/services/BoardService.js';

describe('BoardService: grid destroy при смене типа', () => {
  let eventBus;
  let pixi;
  let boardService;

  beforeEach(async () => {
    vi.clearAllMocks();
    eventBus = new EventBus();
    pixi = { setGrid: vi.fn(), worldLayer: {}, app: { view: { clientWidth: 800, clientHeight: 600 } } };
    boardService = new BoardService(eventBus, pixi);
    await boardService.init(() => ({ width: 800, height: 600 }));
  });

  afterEach(() => {
    boardService = null;
  });

  it('при смене line -> dot старый grid.destroy() вызывается', async () => {
    eventBus.emit(Events.UI.GridChange, { type: 'line' });
    const lineGrid = boardService.grid;
    expect(lineGrid).toBeTruthy();
    expect(lineGrid.destroy).toBeDefined();

    eventBus.emit(Events.UI.GridChange, { type: 'dot' });

    expect(lineGrid.destroy).toHaveBeenCalledTimes(1);
  });
});
