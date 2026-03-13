import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../src/core/EventBus.js';
import { Events } from '../../src/core/events/Events.js';
import { GridFactory } from '../../src/grid/GridFactory.js';
import { BoardService } from '../../src/services/BoardService.js';

function createPixiStub() {
    return {
        worldLayer: {
            x: 0,
            y: 0,
            scale: {
                x: 1,
                y: 1,
                set(v) {
                    this.x = v;
                    this.y = v;
                },
            },
        },
        gridLayer: {
            x: 0,
            y: 0,
            scale: {
                x: 1,
                y: 1,
                set(v) {
                    this.x = v;
                    this.y = v;
                },
            },
        },
        app: { view: { clientWidth: 800, clientHeight: 600 }, stage: {} },
        setGrid: vi.fn(),
    };
}

describe('BoardService screen-grid lifecycle', () => {
    let eventBus;
    let pixi;
    let boardService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        eventBus = new EventBus();
        pixi = createPixiStub();
        boardService = new BoardService(eventBus, pixi);
        await boardService.init(() => ({ width: 800, height: 600 }));
    });

    it('keeps one subscription per event after repeated init calls', async () => {
        await boardService.init(() => ({ width: 800, height: 600 }));
        await boardService.init(() => ({ width: 800, height: 600 }));

        expect(eventBus.events.get(Events.UI.GridChange)?.size || 0).toBe(1);
        expect(eventBus.events.get(Events.Viewport.Changed)?.size || 0).toBe(1);
        expect(eventBus.events.get(Events.UI.MinimapGetData)?.size || 0).toBe(1);
        expect(eventBus.events.get(Events.UI.MinimapCenterOn)?.size || 0).toBe(1);
    });

    it('detaches listeners and destroys grid in destroy()', () => {
        const grid = {
            enabled: true,
            type: 'line',
            serialize: vi.fn(() => ({ type: 'line' })),
            setZoom: vi.fn(),
            setVisibleBounds: vi.fn(),
            setViewportTransform: vi.fn(),
            setEnabled: vi.fn(),
            updateVisual: vi.fn(),
            getPixiObject: vi.fn(() => ({ x: 0, y: 0 })),
            destroy: vi.fn(),
        };

        vi.spyOn(GridFactory, 'getDefaultOptions').mockReturnValue({ enabled: true });
        vi.spyOn(GridFactory, 'createGrid').mockReturnValue(grid);

        eventBus.emit(Events.UI.GridChange, { type: 'line' });
        expect(boardService.grid).toBe(grid);

        boardService.destroy();

        expect(grid.destroy).toHaveBeenCalledTimes(1);
        expect(pixi.setGrid).toHaveBeenLastCalledWith(null);
        expect(eventBus.events.has(Events.UI.GridChange)).toBe(false);
        expect(eventBus.events.has(Events.Viewport.Changed)).toBe(false);
        expect(eventBus.events.has(Events.UI.MinimapGetData)).toBe(false);
        expect(eventBus.events.has(Events.UI.MinimapCenterOn)).toBe(false);

        eventBus.emit(Events.UI.GridChange, { type: 'line' });
        expect(GridFactory.createGrid).toHaveBeenCalledTimes(1);
    });

    it('keeps screen-grid layer anchored across repeated viewport updates', () => {
        const grid = {
            enabled: true,
            type: 'cross',
            setZoom: vi.fn(),
            setVisibleBounds: vi.fn(),
            setViewportTransform: vi.fn(),
            updateVisual: vi.fn(),
            getPixiObject: vi.fn(() => ({ x: 0, y: 0 })),
        };
        boardService.grid = grid;

        for (let i = 0; i < 50; i += 1) {
            pixi.worldLayer.x = i * 7 - 100;
            pixi.worldLayer.y = i * -5 + 40;
            const nextScale = 0.2 + (i % 12) * 0.15;
            pixi.worldLayer.scale.set(nextScale);

            eventBus.emit(Events.Viewport.Changed);

            expect(pixi.gridLayer.x).toBe(0);
            expect(pixi.gridLayer.y).toBe(0);
            expect(pixi.gridLayer.scale.x).toBe(1);
            expect(pixi.gridLayer.scale.y).toBe(1);
        }

        expect(grid.setVisibleBounds).toHaveBeenCalledTimes(50);
        expect(grid.setViewportTransform).toHaveBeenCalledTimes(50);
        expect(grid.setZoom).toHaveBeenCalledTimes(50);
    });
});
