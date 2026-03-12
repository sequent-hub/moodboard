import { describe, it, expect, vi } from 'vitest';
import { ZoomPanController } from '../../src/services/ZoomPanController.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Тесты инвариантов координат для ZoomPanController.
 *
 * Основная идея:
 * при zoom вокруг курсора мировая точка под курсором должна оставаться той же.
 * Если инвариант нарушается, пользователь видит "соскальзывание" сцены
 * и накопительный дрейф при повторном зуме.
 */
function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const h of list) h(payload);
        }),
    };
}

describe('ZoomPanController coordinate invariants', () => {
    it('keeps world point under cursor after wheel zoom', () => {
        // Подготавливаем простую модель:
        // world имеет смещение (x/y) и масштаб 1.
        // Далее вычисляем мировую точку под курсором до zoom,
        // выполняем zoom in и сравниваем с точкой после zoom.
        //
        // Ожидание: точки должны совпасть с высокой точностью.
        const eventBus = createEventBus();
        const world = {
            x: 150,
            y: 90,
            scale: { x: 1, set(v) { this.x = v; } },
        };
        const pixi = {
            worldLayer: world,
            app: { view: { clientWidth: 1000, clientHeight: 700 }, stage: world },
        };

        const controller = new ZoomPanController(eventBus, pixi);
        controller.attach();

        const cursor = { x: 400, y: 250 };
        const worldBefore = {
            x: (cursor.x - world.x) / world.scale.x,
            y: (cursor.y - world.y) / world.scale.x,
        };

        eventBus.emit(Events.Tool.WheelZoom, { ...cursor, delta: -120 });

        const worldAfter = {
            x: (cursor.x - world.x) / world.scale.x,
            y: (cursor.y - world.y) / world.scale.x,
        };

        expect(world.scale.x).toBe(1.25); // следующий уровень после 100% в ZOOM_LEVELS
        expect(worldAfter.x).toBeCloseTo(worldBefore.x, 8);
        expect(worldAfter.y).toBeCloseTo(worldBefore.y, 8);
    });
});

describe('ZoomPanController null guards', () => {
    it('ZoomIn does not throw when pixi.app.view is missing', () => {
        const eventBus = createEventBus();
        const pixi = { worldLayer: null, app: null };
        const controller = new ZoomPanController(eventBus, pixi);
        controller.attach();

        expect(() => eventBus.emit(Events.UI.ZoomIn)).not.toThrow();
    });

    it('ZoomOut does not throw when pixi.app.view is missing', () => {
        const eventBus = createEventBus();
        const pixi = { worldLayer: null, app: null };
        const controller = new ZoomPanController(eventBus, pixi);
        controller.attach();

        expect(() => eventBus.emit(Events.UI.ZoomOut)).not.toThrow();
    });
});

