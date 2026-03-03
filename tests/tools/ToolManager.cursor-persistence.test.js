import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

import { ToolManager } from '../../src/tools/ToolManager.js';

function createMouseEvent(target, x = 10, y = 20) {
    return {
        clientX: x,
        clientY: y,
        button: 0,
        target,
        preventDefault: vi.fn(),
    };
}

describe('ToolManager cursor persistence', () => {
    let container;
    let pixiApp;
    let eventBus;
    let manager;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0 }));

        pixiApp = {
            view: { style: { cursor: '' } },
            renderer: {
                events: {
                    cursorStyles: {
                        pointer: 'pointer',
                        default: 'default',
                    },
                },
            },
        };

        manager = new ToolManager(eventBus, container, pixiApp, null);
    });

    it('возвращает курсор активного инструмента после внешнего сброса на canvas', () => {
        const pencilCursor = 'url("data:image/svg+xml,<svg></svg>") 4 28, crosshair';
        const drawingTool = {
            name: 'draw',
            hotkey: 'd',
            cursor: pencilCursor,
            activate: vi.fn((app) => {
                app.view.style.cursor = pencilCursor;
            }),
            deactivate: vi.fn(),
            onMouseDown: vi.fn(),
            onMouseMove: vi.fn(),
            onMouseUp: vi.fn(),
            onDoubleClick: vi.fn(),
            onKeyDown: vi.fn(),
            onKeyUp: vi.fn(),
            onContextMenu: vi.fn(),
            destroy: vi.fn(),
        };

        manager.registerTool(drawingTool);
        manager.activateTool('draw');

        // Имитация hover по объекту доски, который сбрасывает/меняет курсор.
        pixiApp.view.style.cursor = '';
        pixiApp.renderer.events.cursorStyles.pointer = 'pointer';
        pixiApp.renderer.events.cursorStyles.default = 'default';

        manager.handleMouseMove(createMouseEvent(container));

        expect(pixiApp.view.style.cursor).toBe(pencilCursor);
        expect(pixiApp.renderer.events.cursorStyles.pointer).toBe(pencilCursor);
        expect(pixiApp.renderer.events.cursorStyles.default).toBe(pencilCursor);
    });

    it('не фиксирует курсор для select-инструмента', () => {
        const selectTool = {
            name: 'select',
            hotkey: 'v',
            cursor: '',
            activate: vi.fn((app) => {
                app.view.style.cursor = '';
            }),
            deactivate: vi.fn(),
            onMouseDown: vi.fn(),
            onMouseMove: vi.fn(),
            onMouseUp: vi.fn(),
            onDoubleClick: vi.fn(),
            onKeyDown: vi.fn(),
            onKeyUp: vi.fn(),
            onContextMenu: vi.fn(),
            destroy: vi.fn(),
        };

        manager.registerTool(selectTool);
        manager.activateTool('select');

        pixiApp.view.style.cursor = 'move';
        manager.handleMouseMove(createMouseEvent(container));

        expect(pixiApp.view.style.cursor).toBe('move');
        expect(pixiApp.renderer.events.cursorStyles.pointer).toBe('pointer');
        expect(pixiApp.renderer.events.cursorStyles.default).toBe('default');
    });

    it('возвращает курсор предыдущего инструмента после временного pan', () => {
        const pencilCursor = 'url("data:image/svg+xml,<svg></svg>") 4 28, crosshair';
        const drawTool = {
            name: 'draw',
            hotkey: 'd',
            cursor: pencilCursor,
            activate: vi.fn((app) => {
                app.view.style.cursor = pencilCursor;
            }),
            deactivate: vi.fn(),
            onMouseDown: vi.fn(),
            onMouseMove: vi.fn(),
            onMouseUp: vi.fn(),
            onDoubleClick: vi.fn(),
            onKeyDown: vi.fn(),
            onKeyUp: vi.fn(),
            onContextMenu: vi.fn(),
            destroy: vi.fn(),
        };
        const panTool = {
            name: 'pan',
            hotkey: 'h',
            cursor: 'move',
            activate: vi.fn((app) => {
                app.view.style.cursor = 'move';
            }),
            deactivate: vi.fn(),
            onMouseDown: vi.fn(),
            onMouseMove: vi.fn(),
            onMouseUp: vi.fn(),
            onDoubleClick: vi.fn(),
            onKeyDown: vi.fn(),
            onKeyUp: vi.fn(),
            onContextMenu: vi.fn(),
            destroy: vi.fn(),
        };

        manager.registerTool(drawTool);
        manager.registerTool(panTool);
        manager.activateTool('draw');

        manager.activateTemporaryTool('pan');
        expect(manager.getActiveTool().name).toBe('pan');

        manager.returnToPreviousTool();

        expect(manager.getActiveTool().name).toBe('draw');
        expect(pixiApp.view.style.cursor).toBe(pencilCursor);
        expect(pixiApp.renderer.events.cursorStyles.pointer).toBe(pencilCursor);
        expect(pixiApp.renderer.events.cursorStyles.default).toBe(pencilCursor);
    });
});
