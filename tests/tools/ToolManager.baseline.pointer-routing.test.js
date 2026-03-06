import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

import { ToolManager } from '../../src/tools/ToolManager.js';
import { Events } from '../../src/core/events/Events.js';

function createTool(name, overrides = {}) {
    return {
        name,
        hotkey: overrides.hotkey || null,
        cursor: overrides.cursor || '',
        activate: vi.fn(),
        deactivate: vi.fn(),
        onMouseDown: vi.fn(),
        onMouseMove: vi.fn(),
        onMouseUp: vi.fn(),
        onDoubleClick: vi.fn(),
        onKeyDown: vi.fn(),
        onKeyUp: vi.fn(),
        onContextMenu: vi.fn(),
        onMouseWheel: vi.fn(),
        destroy: vi.fn(),
        ...overrides,
    };
}

function collectEventPayloads(eventBus, eventName) {
    return eventBus.emit.mock.calls
        .filter(([name]) => name === eventName)
        .map(([, payload]) => payload);
}

describe('ToolManager baseline: pointer and input routing', () => {
    let eventBus;
    let container;
    let manager;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 10, top: 20, width: 800, height: 600 }));
        document.body.appendChild(container);
        manager = new ToolManager(eventBus, container, null, null);
    });

    afterEach(() => {
        manager?.destroy();
        container?.remove();
    });

    it('routes pointer, context-menu, and keyboard events to the active tool only', () => {
        const inactiveTool = createTool('select', { hotkey: 'v' });
        const activeTool = createTool('draw', { hotkey: 'd' });

        manager.registerTool(inactiveTool);
        manager.registerTool(activeTool);
        manager.activateTool('draw');

        container.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            button: 0,
            clientX: 30,
            clientY: 60,
        }));
        document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: 35,
            clientY: 65,
        }));
        document.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            button: 0,
            clientX: 40,
            clientY: 70,
        }));
        container.dispatchEvent(new MouseEvent('dblclick', {
            bubbles: true,
            clientX: 45,
            clientY: 75,
        }));

        const contextMenuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 50,
            clientY: 80,
        });
        container.dispatchEvent(contextMenuEvent);

        document.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            key: 'q',
            code: 'KeyQ',
        }));
        document.dispatchEvent(new KeyboardEvent('keyup', {
            bubbles: true,
            key: 'q',
            code: 'KeyQ',
        }));

        expect(activeTool.onMouseDown).toHaveBeenCalledWith(expect.objectContaining({ x: 20, y: 40, button: 0 }));
        expect(activeTool.onMouseMove).toHaveBeenCalledWith(expect.objectContaining({ x: 25, y: 45 }));
        expect(activeTool.onMouseUp).toHaveBeenCalledWith(expect.objectContaining({ x: 30, y: 50, button: 0 }));
        expect(activeTool.onDoubleClick).toHaveBeenCalledWith(expect.objectContaining({ x: 35, y: 55 }));
        expect(activeTool.onContextMenu).toHaveBeenCalledWith(expect.objectContaining({ x: 40, y: 60 }));
        expect(activeTool.onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'q', code: 'KeyQ' }));
        expect(activeTool.onKeyUp).toHaveBeenCalledWith(expect.objectContaining({ key: 'q', code: 'KeyQ' }));
        expect(contextMenuEvent.defaultPrevented).toBe(true);

        expect(inactiveTool.onMouseDown).not.toHaveBeenCalled();
        expect(inactiveTool.onMouseMove).not.toHaveBeenCalled();
        expect(inactiveTool.onMouseUp).not.toHaveBeenCalled();
        expect(inactiveTool.onDoubleClick).not.toHaveBeenCalled();
        expect(inactiveTool.onContextMenu).not.toHaveBeenCalled();
        expect(inactiveTool.onKeyDown).not.toHaveBeenCalled();
        expect(inactiveTool.onKeyUp).not.toHaveBeenCalled();
    });

    it('reroutes subsequent events to the newly activated tool only', () => {
        const firstTool = createTool('select');
        const secondTool = createTool('draw');

        manager.registerTool(firstTool);
        manager.registerTool(secondTool);

        manager.activateTool('select');
        container.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            button: 0,
            clientX: 25,
            clientY: 45,
        }));

        manager.activateTool('draw');
        container.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            button: 0,
            clientX: 35,
            clientY: 55,
        }));

        expect(firstTool.onMouseDown).toHaveBeenCalledTimes(1);
        expect(secondTool.onMouseDown).toHaveBeenCalledTimes(1);
        expect(firstTool.onMouseDown).toHaveBeenLastCalledWith(expect.objectContaining({ x: 15, y: 25 }));
        expect(secondTool.onMouseDown).toHaveBeenLastCalledWith(expect.objectContaining({ x: 25, y: 35 }));
    });

    it('wheel listener emits WheelZoom and cursor updates without calling tool.onMouseWheel', () => {
        const drawTool = createTool('draw');

        manager.registerTool(drawTool);
        manager.activateTool('draw');
        eventBus.emit.mockClear();

        const wheelEvent = new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: 70,
            clientY: 95,
            deltaY: -120,
            ctrlKey: true,
            shiftKey: false,
        });
        container.dispatchEvent(wheelEvent);

        expect(collectEventPayloads(eventBus, Events.UI.CursorMove)).toEqual([
            { x: 60, y: 75 },
        ]);
        expect(collectEventPayloads(eventBus, Events.Tool.WheelZoom)).toEqual([
            { x: 60, y: 75, delta: -120 },
        ]);
        expect(drawTool.onMouseWheel).not.toHaveBeenCalled();
        expect(wheelEvent.defaultPrevented).toBe(true);
    });

    it('tolerates DOM input events when no tool is active', () => {
        const downSpy = vi.fn();
        const moveSpy = vi.fn();
        const upSpy = vi.fn();

        expect(() => {
            container.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true,
                button: 0,
                clientX: 30,
                clientY: 50,
            }));
            document.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true,
                clientX: 35,
                clientY: 55,
            }));
            document.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true,
                button: 0,
                clientX: 40,
                clientY: 60,
            }));
            document.dispatchEvent(new KeyboardEvent('keydown', {
                bubbles: true,
                key: 'q',
                code: 'KeyQ',
            }));
            document.dispatchEvent(new KeyboardEvent('keyup', {
                bubbles: true,
                key: 'q',
                code: 'KeyQ',
            }));
        }).not.toThrow();

        expect(downSpy).not.toHaveBeenCalled();
        expect(moveSpy).not.toHaveBeenCalled();
        expect(upSpy).not.toHaveBeenCalled();
        expect(eventBus.emit).not.toHaveBeenCalled();
    });
});
