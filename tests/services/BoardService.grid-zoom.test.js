/**
 * BoardService: синхронизация сетки с world при зуме.
 * refreshGridViewport должен синхронизировать gridLayer (x, y, scale) с world.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { BoardService } from '../../src/services/BoardService.js';

describe('BoardService: grid zoom sync', () => {
  let eventBus;
  let pixi;
  let boardService;

  beforeEach(async () => {
    eventBus = new EventBus();
    pixi = {
      worldLayer: { x: 0, y: 0, scale: { x: 1, set(v) { this.x = v; } } },
      gridLayer: { x: 0, y: 0, scale: { x: 1, set(v) { this.x = v; this.y = v; } } },
      app: { view: { clientWidth: 800, clientHeight: 600 } },
      setGrid: vi.fn(),
    };
    boardService = new BoardService(eventBus, pixi);
    await boardService.init(() => ({ width: 800, height: 600 }));
  });

  it('refreshGridViewport syncs gridLayer position with world', () => {
    const grid = {
      enabled: true,
      type: 'line',
      size: 32,
      getPixiObject: () => ({ x: 0, y: 0 }),
      setVisibleBounds: vi.fn(),
      updateVisual: vi.fn(),
    };
    boardService.grid = grid;
    boardService.pixi.setGrid(grid);

    pixi.worldLayer.x = 100;
    pixi.worldLayer.y = 50;
    pixi.worldLayer.scale.x = 1.5;
    pixi.worldLayer.scale.set(1.5);

    boardService.refreshGridViewport();

    expect(pixi.gridLayer.x).toBe(100);
    expect(pixi.gridLayer.y).toBe(50);
  });

  it('refreshGridViewport syncs gridLayer scale with world', () => {
    const grid = {
      enabled: true,
      type: 'line',
      size: 32,
      getPixiObject: () => ({ x: 0, y: 0 }),
      setVisibleBounds: vi.fn(),
      updateVisual: vi.fn(),
    };
    boardService.grid = grid;

    pixi.worldLayer.scale.x = 2;
    pixi.worldLayer.scale.set(2);

    boardService.refreshGridViewport();

    expect(pixi.gridLayer.scale.x).toBe(2);
  });

  it('refreshGridViewport calls setZoom on DotGrid', () => {
    const setZoom = vi.fn();
    const grid = {
      enabled: true,
      type: 'dot',
      size: 48,
      _getEffectiveSize: () => 48,
      setZoom,
      setVisibleBounds: vi.fn(),
      updateVisual: vi.fn(),
      getPixiObject: () => ({ x: 0, y: 0 }),
    };
    boardService.grid = grid;

    pixi.worldLayer.scale.x = 1.5;
    pixi.worldLayer.scale.set(1.5);

    boardService.refreshGridViewport();

    expect(setZoom).toHaveBeenCalledWith(1.5);
  });

  it('refreshGridViewport computes world-space bounds when scaled', () => {
    const setVisibleBounds = vi.fn();
    const grid = {
      enabled: true,
      type: 'line',
      size: 32,
      setVisibleBounds,
      updateVisual: vi.fn(),
      getPixiObject: () => ({ x: 0, y: 0 }),
    };
    boardService.grid = grid;

    pixi.worldLayer.x = 400;
    pixi.worldLayer.y = 300;
    pixi.worldLayer.scale.x = 2;
    pixi.worldLayer.scale.set(2);

    boardService.refreshGridViewport();

    expect(setVisibleBounds).toHaveBeenCalled();
    const args = setVisibleBounds.mock.calls[0];
    expect(args).toHaveLength(4);
    const [left, top, right, bottom] = args;
    expect(right).toBeGreaterThan(left);
    expect(bottom).toBeGreaterThan(top);
  });

  it('refreshGridViewport does nothing when grid disabled', () => {
    const grid = {
      enabled: false,
      type: 'line',
      setVisibleBounds: vi.fn(),
    };
    boardService.grid = grid;

    boardService.refreshGridViewport();

    expect(grid.setVisibleBounds).not.toHaveBeenCalled();
  });
});
