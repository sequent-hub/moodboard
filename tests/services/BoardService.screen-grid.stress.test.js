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
        app: { view: { clientWidth: 1280, clientHeight: 720 }, stage: {} },
        setGrid: vi.fn(),
    };
}

function createGridMock(type) {
    return {
        type,
        enabled: true,
        serialize: vi.fn(() => ({ type })),
        setZoom: vi.fn(),
        setVisibleBounds: vi.fn(),
        setViewportTransform: vi.fn(),
        setEnabled: vi.fn(),
        updateVisual: vi.fn(),
        getPixiObject: vi.fn(() => ({ x: 0, y: 0 })),
        destroy: vi.fn(),
    };
}

describe('BoardService screen-grid stress contracts', () => {
    let eventBus;
    let pixi;
    let boardService;

    beforeEach(async () => {
        vi.restoreAllMocks();
        eventBus = new EventBus();
        pixi = createPixiStub();
        boardService = new BoardService(eventBus, pixi);
        await boardService.init(() => ({ width: 1280, height: 720 }));
    });

    it('keeps listener counts stable through repeated init/grid cycles', async () => {
        const created = [];
        vi.spyOn(GridFactory, 'getDefaultOptions').mockImplementation((type) => ({ enabled: true, type }));
        vi.spyOn(GridFactory, 'createGrid').mockImplementation((type) => {
            const grid = createGridMock(type);
            created.push(grid);
            return grid;
        });

        for (let i = 0; i < 15; i += 1) {
            await boardService.init(() => ({ width: 1280, height: 720 }));
            eventBus.emit(Events.UI.GridChange, { type: 'line' });
            eventBus.emit(Events.UI.GridChange, { type: 'dot' });
            eventBus.emit(Events.UI.GridChange, { type: 'cross' });
            eventBus.emit(Events.UI.GridChange, { type: 'off' });
        }

        expect(eventBus.events.get(Events.UI.GridChange)?.size || 0).toBe(1);
        expect(eventBus.events.get(Events.Viewport.Changed)?.size || 0).toBe(1);
        expect(eventBus.events.get(Events.Tool.WheelZoom)?.size || 0).toBe(1);
        expect(eventBus.events.get(Events.UI.MinimapGetData)?.size || 0).toBe(1);
        expect(eventBus.events.get(Events.UI.MinimapCenterOn)?.size || 0).toBe(1);
        expect(created.length).toBe(45);
    });

    it('does not drift gridLayer from screen-space under long zoom/pan loops', () => {
        const grid = createGridMock('cross');
        boardService.grid = grid;

        for (let i = 0; i < 400; i += 1) {
            pixi.worldLayer.x = -1000 + i * 3;
            pixi.worldLayer.y = 500 - i * 2;
            const z = 0.2 + ((i % 24) * 0.2);
            pixi.worldLayer.scale.set(Math.min(5, z));

            eventBus.emit(Events.Viewport.Changed);

            expect(pixi.gridLayer.x).toBe(0);
            expect(pixi.gridLayer.y).toBe(0);
            expect(pixi.gridLayer.scale.x).toBe(1);
            expect(pixi.gridLayer.scale.y).toBe(1);
        }

        expect(grid.setViewportTransform).toHaveBeenCalledTimes(400);
        expect(grid.setVisibleBounds).toHaveBeenCalledTimes(400);
        expect(grid.setZoom).toHaveBeenCalledTimes(400);
    });

    it('releases listeners after destroy even after stress cycles', () => {
        const created = [];
        vi.spyOn(GridFactory, 'getDefaultOptions').mockImplementation((type) => ({ enabled: true, type }));
        vi.spyOn(GridFactory, 'createGrid').mockImplementation((type) => {
            const grid = createGridMock(type);
            created.push(grid);
            return grid;
        });

        for (let i = 0; i < 50; i += 1) {
            eventBus.emit(Events.UI.GridChange, { type: i % 2 === 0 ? 'line' : 'dot' });
            pixi.worldLayer.scale.set(0.5 + (i % 10) * 0.1);
            eventBus.emit(Events.Viewport.Changed);
        }

        const latestGrid = boardService.grid;
        boardService.destroy();

        expect(eventBus.events.has(Events.UI.GridChange)).toBe(false);
        expect(eventBus.events.has(Events.Viewport.Changed)).toBe(false);
        expect(eventBus.events.has(Events.Tool.WheelZoom)).toBe(false);
        expect(eventBus.events.has(Events.UI.MinimapGetData)).toBe(false);
        expect(eventBus.events.has(Events.UI.MinimapCenterOn)).toBe(false);
        expect(latestGrid.destroy).toHaveBeenCalledTimes(1);

        eventBus.emit(Events.UI.GridChange, { type: 'cross' });
        expect(GridFactory.createGrid).toHaveBeenCalledTimes(created.length);
    });
});
