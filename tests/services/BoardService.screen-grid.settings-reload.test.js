import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../src/core/EventBus.js';
import { Events } from '../../src/core/events/Events.js';
import { GridFactory } from '../../src/grid/GridFactory.js';
import { SettingsApplier } from '../../src/services/SettingsApplier.js';
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
        app: {
            view: { clientWidth: 1024, clientHeight: 768 },
            stage: {},
            renderer: { backgroundColor: 0xF5F5F5 },
        },
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

describe('BoardService + SettingsApplier screen-grid reload contracts', () => {
    let eventBus;
    let pixi;
    let boardService;
    let settingsApplier;

    beforeEach(async () => {
        vi.restoreAllMocks();
        eventBus = new EventBus();
        pixi = createPixiStub();
        boardService = new BoardService(eventBus, pixi);
        await boardService.init(() => ({ width: 1024, height: 768 }));
        settingsApplier = new SettingsApplier(eventBus, pixi, boardService);
    });

    it('keeps gridLayer screen-anchored through repeated settings apply cycles', () => {
        vi.spyOn(GridFactory, 'getDefaultOptions').mockImplementation((type) => ({ enabled: true, type }));
        vi.spyOn(GridFactory, 'createGrid').mockImplementation((type) => createGridMock(type));

        const types = ['line', 'dot', 'cross'];
        for (let i = 0; i < 90; i += 1) {
            const type = types[i % types.length];
            const settings = {
                grid: {
                    type,
                    visible: true,
                    size: 24 + (i % 3) * 8,
                    options: { opacity: 0.3 + (i % 4) * 0.1 },
                },
                zoom: { current: 0.3 + (i % 10) * 0.2 },
                pan: { x: -300 + i * 5, y: 200 - i * 3 },
            };
            settingsApplier.apply(settings);

            expect(pixi.gridLayer.x).toBe(0);
            expect(pixi.gridLayer.y).toBe(0);
            expect(pixi.gridLayer.scale.x).toBe(1);
            expect(pixi.gridLayer.scale.y).toBe(1);
        }

        expect(pixi.setGrid).toHaveBeenCalled();
        expect(boardService.grid).toBeTruthy();
        expect(['line', 'dot', 'cross']).toContain(boardService.grid.type);
    });

    it('preserves viewport contract when toggling grid off/on via settings reload', () => {
        vi.spyOn(GridFactory, 'getDefaultOptions').mockImplementation((type) => ({ enabled: true, type }));
        vi.spyOn(GridFactory, 'createGrid').mockImplementation((type) => createGridMock(type));

        settingsApplier.apply({ grid: { type: 'line', visible: true, size: 32 } });
        const lineGrid = boardService.grid;
        expect(lineGrid).toBeTruthy();

        for (let i = 0; i < 60; i += 1) {
            settingsApplier.apply({
                zoom: { current: 0.2 + (i % 12) * 0.18 },
                pan: { x: i * 7, y: i * -4 },
            });
            settingsApplier.apply({ grid: { type: 'off', visible: false } });
            settingsApplier.apply({ grid: { type: i % 2 === 0 ? 'dot' : 'cross', visible: true, size: 20 } });

            expect(pixi.gridLayer.x).toBe(0);
            expect(pixi.gridLayer.y).toBe(0);
            expect(pixi.gridLayer.scale.x).toBe(1);
            expect(pixi.gridLayer.scale.y).toBe(1);
        }

        expect(lineGrid.destroy).toHaveBeenCalled();
    });
});
