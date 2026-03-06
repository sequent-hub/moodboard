import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

// --- Моки ---

// SVG-ассет
vi.mock('../../src/assets/icons/i-cursor.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

// pixi.js
vi.mock('pixi.js', () => {
    const createGraphicsMock = () => ({
        clear: vi.fn().mockReturnThis(),
        beginFill: vi.fn().mockReturnThis(),
        endFill: vi.fn().mockReturnThis(),
        drawRoundedRect: vi.fn().mockReturnThis(),
        drawRect: vi.fn().mockReturnThis(),
        drawCircle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        x: 0,
        y: 0,
        zIndex: 0,
        alpha: 1,
        filters: null,
        parent: null,
        destroy: vi.fn(),
    });

    const createContainerMock = () => ({
        addChild: vi.fn(),
        removeChild: vi.fn(),
        destroy: vi.fn(),
        children: [],
        alpha: 1,
        x: 0,
        y: 0,
        pivot: { x: 0, y: 0, set: vi.fn() },
    });

    return {
        Container: vi.fn().mockImplementation(() => createContainerMock()),
        Graphics: vi.fn().mockImplementation(() => createGraphicsMock()),
        Text: vi.fn().mockImplementation((content, style) => ({
            text: content || '',
            style: style || {},
            x: 0,
            y: 0,
            width: 100,
            height: 20,
            anchor: { set: vi.fn() },
            getLocalBounds: vi.fn(() => ({ x: 0, y: 0, width: 48, height: 48 })),
            scale: { set: vi.fn() },
        })),
        Sprite: vi.fn().mockImplementation(() => ({
            width: 100,
            height: 100,
        })),
        Point: vi.fn().mockImplementation((x, y) => ({ x, y })),
        Rectangle: vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h })),
        Texture: {
            fromURL: vi.fn().mockResolvedValue({ width: 300, height: 200 }),
        },
        filters: {
            BlurFilter: vi.fn().mockImplementation(() => ({ blur: 6 })),
        },
    };
});

import { PlacementTool } from '../../src/tools/object-tools/PlacementTool.js';

// ─────────────────────────────────────────────
// Хелперы
// ─────────────────────────────────────────────
function createMockEventBus() {
    const handlers = {};
    return {
        on: vi.fn((event, handler) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        }),
        emit: vi.fn((event, data) => {
            if (handlers[event]) {
                handlers[event].forEach(h => h(data));
            }
        }),
        off: vi.fn(),
        _handlers: handlers,
    };
}

function createMockApp() {
    return {
        view: {
            style: { cursor: '' },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            getBoundingClientRect: vi.fn(() => ({
                x: 0, y: 0, width: 1200, height: 800,
                left: 0, top: 0, right: 1200, bottom: 800,
            })),
            parentElement: {
                getBoundingClientRect: vi.fn(() => ({
                    left: 0, top: 0, width: 1200, height: 800,
                })),
            },
        },
        stage: {
            getChildByName: vi.fn(() => null),
        },
        renderer: {
            events: { cursorStyles: { pointer: 'pointer', default: 'default' } },
        },
    };
}

function createMockWorld() {
    return {
        addChild: vi.fn(),
        removeChild: vi.fn(),
        toLocal: vi.fn((point) => ({ x: point.x, y: point.y })),
    };
}

// ─────────────────────────────────────────────
// Тесты PlacementTool (фокус на записке)
// ─────────────────────────────────────────────
describe('PlacementTool', () => {
    let eventBus;
    let tool;
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        eventBus = createMockEventBus();
        tool = new PlacementTool(eventBus);
    });

    // ═══════════════════════════════════════════
    // Конструктор
    // ═══════════════════════════════════════════
    describe('Конструктор', () => {
        it('должен инициализировать с именем "place"', () => {
            expect(tool.name).toBe('place');
        });

        it('должен инициализировать pending как null', () => {
            expect(tool.pending).toBeNull();
        });

        it('должен инициализировать ghostContainer как null', () => {
            expect(tool.ghostContainer).toBeNull();
        });

        it('должен подписаться на Place.Set', () => {
            const subscribedEvents = eventBus.on.mock.calls.map(c => c[0]);
            expect(subscribedEvents).toContain(Events.Place.Set);
        });

        it('должен подписаться на Tool.Activated', () => {
            const subscribedEvents = eventBus.on.mock.calls.map(c => c[0]);
            expect(subscribedEvents).toContain(Events.Tool.Activated);
        });

        it('должен подписаться на Place.FileSelected', () => {
            const subscribedEvents = eventBus.on.mock.calls.map(c => c[0]);
            expect(subscribedEvents).toContain(Events.Place.FileSelected);
        });

        it('не должен падать при eventBus = null', () => {
            expect(() => new PlacementTool(null)).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════
    // Place.Set для записки
    // ═══════════════════════════════════════════
    describe('Place.Set для записки', () => {
        it('должен установить pending при получении конфигурации', () => {
            const cfg = { type: 'note', properties: { content: 'Тест' } };

            eventBus.emit(Events.Place.Set, cfg);

            expect(tool.pending).toEqual(cfg);
        });

        it('должен сбросить pending при получении null', () => {
            tool.pending = { type: 'note' };

            eventBus.emit(Events.Place.Set, null);

            expect(tool.pending).toBeNull();
        });

        it('должен вызвать showNoteGhost при pending.type === "note" и наличии world', () => {
            tool.app = createMockApp();
            tool.world = createMockWorld();
            const spy = vi.spyOn(tool, 'showNoteGhost');

            eventBus.emit(Events.Place.Set, { type: 'note', properties: {} });

            expect(spy).toHaveBeenCalled();
        });

        it('не должен вызывать showNoteGhost если нет world', () => {
            tool.app = createMockApp();
            tool.world = null;
            const spy = vi.spyOn(tool, 'showNoteGhost');

            eventBus.emit(Events.Place.Set, { type: 'note', properties: {} });

            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════
    // Tool.Activated → сброс pending
    // ═══════════════════════════════════════════
    describe('Tool.Activated → сброс', () => {
        it('должен сбросить pending при активации select', () => {
            tool.pending = { type: 'note' };

            eventBus.emit(Events.Tool.Activated, { tool: 'select' });

            expect(tool.pending).toBeNull();
        });

        it('должен вызвать hideGhost при активации select', () => {
            tool.world = createMockWorld();
            const spy = vi.spyOn(tool, 'hideGhost');

            eventBus.emit(Events.Tool.Activated, { tool: 'select' });

            expect(spy).toHaveBeenCalled();
        });

        it('не должен сбрасывать pending при активации другого инструмента', () => {
            tool.pending = { type: 'note' };

            eventBus.emit(Events.Tool.Activated, { tool: 'draw' });

            expect(tool.pending).toEqual({ type: 'note' });
        });
    });

    // ═══════════════════════════════════════════
    // showNoteGhost()
    // ═══════════════════════════════════════════
    describe('showNoteGhost()', () => {
        beforeEach(() => {
            tool.world = createMockWorld();
        });

        it('должен создать ghostContainer', () => {
            tool.pending = { type: 'note', properties: {} };

            tool.showNoteGhost();

            expect(tool.ghostContainer).not.toBeNull();
        });

        it('должен установить alpha = 0.6 для полупрозрачности', () => {
            tool.pending = { type: 'note', properties: {} };

            tool.showNoteGhost();

            expect(tool.ghostContainer.alpha).toBe(0.6);
        });

        it('должен добавить ghostContainer в world', () => {
            tool.pending = { type: 'note', properties: {} };

            tool.showNoteGhost();

            expect(tool.world.addChild).toHaveBeenCalledWith(tool.ghostContainer);
        });

        it('должен использовать размеры по умолчанию 250x250', () => {
            tool.pending = { type: 'note', properties: {} };

            tool.showNoteGhost();

            expect(tool.ghostContainer.pivot.x).toBe(125);
            expect(tool.ghostContainer.pivot.y).toBe(125);
        });

        it('должен использовать кастомные размеры из properties', () => {
            tool.pending = {
                type: 'note',
                properties: { width: 300, height: 400 },
            };

            tool.showNoteGhost();

            expect(tool.ghostContainer.pivot.x).toBe(150);
            expect(tool.ghostContainer.pivot.y).toBe(200);
        });

        it('должен удалить предыдущий ghost перед созданием нового', () => {
            tool.pending = { type: 'note', properties: {} };
            tool.showNoteGhost();
        const firstGhost = tool.ghostContainer;

        tool.showNoteGhost();
        const secondGhost = tool.ghostContainer;

        expect(firstGhost).not.toBe(secondGhost);
        expect(tool.world.removeChild).toHaveBeenCalledWith(firstGhost);
        expect(firstGhost.destroy).toHaveBeenCalled();
        expect(tool.world.addChild).toHaveBeenNthCalledWith(1, firstGhost);
        expect(tool.world.addChild).toHaveBeenNthCalledWith(2, secondGhost);
        });

        it('не должен создавать ghost если pending.type !== "note"', () => {
            tool.pending = { type: 'text', properties: {} };

            tool.showNoteGhost();

            expect(tool.ghostContainer).toBeNull();
        });

        it('не должен создавать ghost если pending === null', () => {
            tool.pending = null;

            tool.showNoteGhost();

            expect(tool.ghostContainer).toBeNull();
        });

        it('не должен создавать ghost если world === null', () => {
            tool.world = null;
            tool.pending = { type: 'note', properties: {} };

            tool.showNoteGhost();

            expect(tool.ghostContainer).toBeNull();
        });
    });

    // ═══════════════════════════════════════════
    // hideGhost()
    // ═══════════════════════════════════════════
    describe('hideGhost()', () => {
        it('должен удалить ghostContainer из world', () => {
            tool.world = createMockWorld();
            tool.pending = { type: 'note', properties: {} };
            tool.showNoteGhost();

            const ghost = tool.ghostContainer;
            tool.hideGhost();

            expect(tool.world.removeChild).toHaveBeenCalledWith(ghost);
        });

        it('должен вызвать destroy на ghostContainer', () => {
            tool.world = createMockWorld();
            tool.pending = { type: 'note', properties: {} };
            tool.showNoteGhost();

            const ghost = tool.ghostContainer;
            tool.hideGhost();

            expect(ghost.destroy).toHaveBeenCalled();
        });

        it('должен обнулить ghostContainer', () => {
            tool.world = createMockWorld();
            tool.pending = { type: 'note', properties: {} };
            tool.showNoteGhost();

            tool.hideGhost();

            expect(tool.ghostContainer).toBeNull();
        });

        it('не должен падать при отсутствии ghostContainer', () => {
            tool.world = createMockWorld();
            expect(() => tool.hideGhost()).not.toThrow();
        });

        it('не должен падать при отсутствии world', () => {
            tool.world = null;
            tool.ghostContainer = { destroy: vi.fn() };

            expect(() => tool.hideGhost()).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════
    // updateGhostPosition()
    // ═══════════════════════════════════════════
    describe('updateGhostPosition()', () => {
        it('должен обновить координаты ghostContainer', () => {
            tool.world = createMockWorld();
            tool.pending = { type: 'note', properties: {} };
            tool.showNoteGhost();

            tool.updateGhostPosition(100, 200);

            expect(tool.ghostContainer.x).toBe(100);
            expect(tool.ghostContainer.y).toBe(200);
        });

        it('не должен падать при отсутствии ghostContainer', () => {
            expect(() => tool.updateGhostPosition(100, 200)).not.toThrow();
        });
    });

    // ═══════════════════════════════════════════
    // activate() с pending note
    // ═══════════════════════════════════════════
    describe('activate() с pending note', () => {
        it('должен вызвать showNoteGhost при pending.type === "note"', () => {
            const app = createMockApp();
            app.stage.getChildByName = vi.fn(() => createMockWorld());
            tool.pending = { type: 'note', properties: {} };
            const spy = vi.spyOn(tool, 'showNoteGhost');

            tool.activate(app);

            expect(spy).toHaveBeenCalled();
        });

        it('должен установить app и world', () => {
            const app = createMockApp();
            const mockWorld = createMockWorld();
            app.stage.getChildByName = vi.fn(() => mockWorld);

            tool.activate(app);

            expect(tool.app).toBe(app);
            expect(tool.world).toBe(mockWorld);
        });

        it('должен установить курсор на view', () => {
            const app = createMockApp();
            app.stage.getChildByName = vi.fn(() => createMockWorld());
            tool.pending = { type: 'note' };

            tool.activate(app);

            expect(app.view.style.cursor).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════
    // onMouseDown — размещение записки
    // ═══════════════════════════════════════════
    describe('onMouseDown — размещение записки', () => {
        let app;

        beforeEach(() => {
            app = createMockApp();
            const world = createMockWorld();
            app.stage.getChildByName = vi.fn(() => world);
            tool.activate(app);
            eventBus.emit.mockClear();
        });

        it('должен отправить ToolbarAction с type="note" при клике', () => {
            tool.pending = {
                type: 'note',
                properties: { content: 'Новая записка' },
            };

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            expect(eventBus.emit).toHaveBeenCalledWith(
                Events.UI.ToolbarAction,
                expect.objectContaining({
                    type: 'note',
                    id: 'note',
                })
            );
        });

        it('должен центрировать записку по позиции клика (250x250)', () => {
            tool.pending = {
                type: 'note',
                properties: {},
            };

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            const call = eventBus.emit.mock.calls.find(
                c => c[0] === Events.UI.ToolbarAction
            );
            expect(call).toBeDefined();
            const data = call[1];
            expect(data.position.x).toBe(Math.round(500 - 125));
            expect(data.position.y).toBe(Math.round(400 - 125));
        });

        it('должен передать свойства записки в ToolbarAction', () => {
            tool.pending = {
                type: 'note',
                properties: {
                    content: 'Тест',
                    backgroundColor: 0xFF0000,
                },
            };

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            const call = eventBus.emit.mock.calls.find(
                c => c[0] === Events.UI.ToolbarAction
            );
            expect(call[1].properties.content).toBe('Тест');
            expect(call[1].properties.backgroundColor).toBe(0xFF0000);
        });

        it('должен добавить width и height = 250 в свойства записки', () => {
            tool.pending = {
                type: 'note',
                properties: {},
            };

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            const call = eventBus.emit.mock.calls.find(
                c => c[0] === Events.UI.ToolbarAction
            );
            expect(call[1].properties.width).toBe(250);
            expect(call[1].properties.height).toBe(250);
        });

        it('должен поддержать квадратную форму при кастомных размерах', () => {
            tool.pending = {
                type: 'note',
                properties: { width: 200, height: 400 },
            };

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            const call = eventBus.emit.mock.calls.find(
                c => c[0] === Events.UI.ToolbarAction
            );
            const side = Math.max(200, 400);
            expect(call[1].properties.width).toBe(side);
            expect(call[1].properties.height).toBe(side);
        });

        it('должен сбросить pending после размещения', () => {
            tool.pending = { type: 'note', properties: {} };

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            expect(tool.pending).toBeNull();
        });

        it('должен скрыть ghost после размещения', () => {
            tool.pending = { type: 'note', properties: {} };
            const spy = vi.spyOn(tool, 'hideGhost');

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            expect(spy).toHaveBeenCalled();
        });

        it('должен переключиться на select после размещения', () => {
            tool.pending = { type: 'note', properties: {} };

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            expect(eventBus.emit).toHaveBeenCalledWith(
                Events.Keyboard.ToolSelect,
                { tool: 'select' }
            );
        });

        it('не должен делать ничего при pending === null', () => {
            tool.pending = null;

            tool.onMouseDown({ x: 500, y: 400, button: 0 });

            const toolbarCalls = eventBus.emit.mock.calls.filter(
                c => c[0] === Events.UI.ToolbarAction
            );
            expect(toolbarCalls).toHaveLength(0);
        });
    });

    // ═══════════════════════════════════════════
    // deactivate()
    // ═══════════════════════════════════════════
    describe('deactivate()', () => {
        it('должен вызвать hideGhost', () => {
            const app = createMockApp();
            tool.activate(app);
            const spy = vi.spyOn(tool, 'hideGhost');

            tool.deactivate();

            expect(spy).toHaveBeenCalled();
        });

        it('должен обнулить app и world', () => {
            const app = createMockApp();
            tool.activate(app);

            tool.deactivate();

            expect(tool.app).toBeNull();
            expect(tool.world).toBeNull();
        });

        it('должен сбросить курсор', () => {
            const app = createMockApp();
            tool.activate(app);
            app.view.style.cursor = 'crosshair';

            tool.deactivate();

            expect(app.view.style.cursor).toBe('');
        });
    });

    // ═══════════════════════════════════════════
    // _toWorld()
    // ═══════════════════════════════════════════
    describe('_toWorld()', () => {
        it('должен преобразовать координаты через world.toLocal', () => {
            tool.world = createMockWorld();
            tool.world.toLocal = vi.fn(() => ({ x: 50, y: 75 }));

            const result = tool._toWorld(100, 200);

            expect(result).toEqual({ x: 50, y: 75 });
        });

        it('должен вернуть исходные координаты если world === null', () => {
            tool.world = null;

            const result = tool._toWorld(100, 200);

            expect(result).toEqual({ x: 100, y: 200 });
        });
    });

    // ═══════════════════════════════════════════
    // _getPendingCursor()
    // ═══════════════════════════════════════════
    describe('_getPendingCursor()', () => {
        it('должен вернуть "crosshair" для записки', () => {
            tool.pending = { type: 'note' };
            expect(tool._getPendingCursor()).toBe('crosshair');
        });

        it('должен вернуть "text" для текста', () => {
            tool.pending = { type: 'text' };
            expect(tool._getPendingCursor()).toBe('text');
        });

        it('должен вернуть "crosshair" при отсутствии pending', () => {
            tool.pending = null;
            expect(tool._getPendingCursor()).toBe('crosshair');
        });
    });

    // ═══════════════════════════════════════════
    // Полный цикл размещения записки
    // ═══════════════════════════════════════════
    describe('Полный цикл размещения записки', () => {
        it('Place.Set → activate → showGhost → mouseDown → place → select', () => {
            const app = createMockApp();
            const world = createMockWorld();
            app.stage.getChildByName = vi.fn(() => world);

            expect(() => {
                eventBus.emit(Events.Place.Set, {
                    type: 'note',
                    properties: { content: 'Новая записка' },
                });

                tool.activate(app);

                expect(tool.ghostContainer).not.toBeNull();

                tool.updateGhostPosition(300, 200);

                tool.onMouseDown({ x: 300, y: 200, button: 0 });

                expect(tool.pending).toBeNull();
                expect(tool.ghostContainer).toBeNull();
            }).not.toThrow();
        });
    });
});
