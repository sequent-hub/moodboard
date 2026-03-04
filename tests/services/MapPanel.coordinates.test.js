import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MapPanel } from '../../src/ui/MapPanel.js';
import { Events } from '../../src/core/events/Events.js';

/**
 * Тесты координатной математики миникарты.
 *
 * Фокус:
 * - корректность перевода mini -> world;
 * - корректность передачи точки центрирования в основное полотно.
 */
describe('MapPanel coordinate conversion', () => {
    let container;
    let bus;
    let panel;
    let lastCenterPayload;
    let originalGetContext;
    let originalRaf;
    let originalCancelRaf;
    let ctxStub;

    beforeEach(() => {
        // jsdom не реализует реальный canvas context.
        // Для координатных тестов миникарты нам достаточно заглушки
        // с набором методов, которые вызывает MapPanel.renderMinimap().
        ctxStub = {
            setTransform: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            translate: vi.fn(),
            scale: vi.fn(),
            strokeRect: vi.fn(),
            rotate: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
        };
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxStub);

        originalRaf = global.requestAnimationFrame;
        originalCancelRaf = global.cancelAnimationFrame;
        global.requestAnimationFrame = vi.fn(() => 1);
        global.cancelAnimationFrame = vi.fn();

        container = document.createElement('div');
        document.body.appendChild(container);

        lastCenterPayload = null;
        bus = {
            emit: vi.fn((event, payload) => {
                if (event === Events.UI.MinimapGetData) {
                    payload.world = { x: 0, y: 0, scale: 1 };
                    payload.view = { width: 1000, height: 800 };
                    payload.objects = [
                        { id: 'a', x: 100, y: 100, width: 200, height: 100, rotation: 0 },
                        { id: 'b', x: 500, y: 300, width: 100, height: 200, rotation: 0 },
                    ];
                }
                if (event === Events.Tool.GetSelection) {
                    payload.selection = [];
                }
                if (event === Events.UI.MinimapCenterOn) {
                    lastCenterPayload = payload;
                }
            }),
        };

        panel = new MapPanel(container, bus);
        panel.showPopup();

        // В тестовом окружении выставляем "видимые" размеры явно,
        // чтобы формулы miniToWorld работали детерминированно.
        Object.defineProperty(panel.canvas, 'clientWidth', { value: 200, configurable: true });
        Object.defineProperty(panel.canvas, 'clientHeight', { value: 100, configurable: true });
    });

    afterEach(() => {
        panel.hidePopup();
        panel.destroy();
        container.remove();
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        global.requestAnimationFrame = originalRaf;
        global.cancelAnimationFrame = originalCancelRaf;
        vi.restoreAllMocks();
    });

    it('miniToWorld maps minimap center to bbox center', () => {
        // BBox объектов:
        // minX=100, minY=100, maxX=600, maxY=500 -> center=(350,300).
        //
        // Для точки центра миникарты ожидаем, что перевод даст центр bbox мира.
        const worldPos = panel.miniToWorld(100, 50);
        expect(worldPos.worldX).toBeCloseTo(350, 6);
        expect(worldPos.worldY).toBeCloseTo(300, 6);
    });

    it('handlePointer emits MinimapCenterOn with converted world coords', () => {
        // Проверяем цепочку:
        // указатель на миникарте -> miniToWorld -> событие центрирования основного вида.
        const fakeEvent = {
            clientX: 100,
            clientY: 50,
        };

        panel.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
        panel.handlePointer(fakeEvent);

        expect(lastCenterPayload).not.toBeNull();
        expect(lastCenterPayload.worldX).toBeCloseTo(350, 6);
        expect(lastCenterPayload.worldY).toBeCloseTo(300, 6);
    });
});

