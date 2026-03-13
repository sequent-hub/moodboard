import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { Events } from '../../src/core/events/Events.js';
import { ZoomPanController } from '../../src/services/ZoomPanController.js';
import { BoardService } from '../../src/services/BoardService.js';
import { createIntegerGuard } from '../helpers/pixelPerfectIntegerGuard.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

describe('Pixel-perfect integer contract: viewport transforms', () => {
    it('ZoomPanController keeps world screen offsets integer after wheel/reset/fit', () => {
        const eventBus = createEventBus();
        const world = {
            x: 151,
            y: 89,
            scale: { x: 1, set(v) { this.x = v; } },
        };
        const pixi = {
            worldLayer: world,
            objects: new Map([
                ['a', { getBounds: () => ({ x: 10, y: 20, width: 110, height: 70 }) }],
            ]),
            app: { view: { clientWidth: 1001, clientHeight: 701 }, stage: world },
        };

        const controller = new ZoomPanController(eventBus, pixi);
        controller.attach();
        eventBus.emit(Events.Tool.WheelZoom, { x: 400.4, y: 250.7, delta: -120 });
        eventBus.emit(Events.UI.ZoomReset);
        eventBus.emit(Events.UI.ZoomFit);

        const guard = createIntegerGuard('ZoomPanController');
        guard.collect('world.x', world.x);
        guard.collect('world.y', world.y);
        guard.assertNoFractions();
        expect(true).toBe(true);
    });

    it('BoardService MinimapCenterOn keeps world offsets integer', async () => {
        const eventBus = new EventBus();
        const pixi = {
            worldLayer: { x: 0, y: 0, scale: { x: 1.25 } },
            app: { view: { clientWidth: 1000, clientHeight: 700 }, stage: null },
            gridLayer: { x: 0, y: 0, scale: { x: 1, y: 1, set(v) { this.x = v; this.y = v; } } },
            setGrid: vi.fn(),
        };
        const service = new BoardService(eventBus, pixi);
        await service.init(() => ({ width: 1000, height: 700 }));
        service.grid = { enabled: false };

        eventBus.emit(Events.UI.MinimapCenterOn, { worldX: 333.3, worldY: 222.2 });

        const guard = createIntegerGuard('BoardService.MinimapCenterOn');
        guard.collect('world.x', pixi.worldLayer.x);
        guard.collect('world.y', pixi.worldLayer.y);
        guard.assertNoFractions();
        service.destroy();
        expect(true).toBe(true);
    });
});
