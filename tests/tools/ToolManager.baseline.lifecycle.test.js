import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

import { ToolManager } from '../../src/tools/ToolManager.js';

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

function getCalls(spy, eventName) {
    return spy.mock.calls.filter(([name]) => name === eventName);
}

describe('ToolManager baseline: lifecycle contracts', () => {
    let eventBus;
    let container;
    let manager;
    let addContainerSpy;
    let addDocumentSpy;
    let addWindowSpy;
    let removeContainerSpy;
    let removeDocumentSpy;
    let removeWindowSpy;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 }));
        document.body.appendChild(container);

        addContainerSpy = vi.spyOn(container, 'addEventListener');
        addDocumentSpy = vi.spyOn(document, 'addEventListener');
        addWindowSpy = vi.spyOn(window, 'addEventListener');
        removeContainerSpy = vi.spyOn(container, 'removeEventListener');
        removeDocumentSpy = vi.spyOn(document, 'removeEventListener');
        removeWindowSpy = vi.spyOn(window, 'removeEventListener');

        manager = new ToolManager(eventBus, container, null, null);
    });

    afterEach(() => {
        manager?.destroy();
        addContainerSpy?.mockRestore();
        addDocumentSpy?.mockRestore();
        addWindowSpy?.mockRestore();
        removeContainerSpy?.mockRestore();
        removeDocumentSpy?.mockRestore();
        removeWindowSpy?.mockRestore();
        container?.remove();
    });

    it('constructor wires the current container, document, and window listeners once', () => {
        expect(getCalls(addContainerSpy, 'mousedown')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'mousemove')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'mouseup')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'mouseenter')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'mouseleave')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'dragenter')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'dragover')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'dragleave')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'drop')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'dblclick')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'wheel')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'contextmenu')).toHaveLength(1);

        expect(getCalls(addDocumentSpy, 'mousemove')).toHaveLength(1);
        expect(getCalls(addDocumentSpy, 'mouseup')).toHaveLength(1);
        expect(getCalls(addDocumentSpy, 'keydown')).toHaveLength(1);
        expect(getCalls(addDocumentSpy, 'keyup')).toHaveLength(1);

        expect(getCalls(addWindowSpy, 'wheel')).toHaveLength(1);
        expect(getCalls(addContainerSpy, 'wheel')[0][2]).toEqual({ passive: false });
        expect(getCalls(addWindowSpy, 'wheel')[0][2]).toEqual({ passive: false });
    });

    it('destroy clears the registry, resets active tool, and requests listener cleanup', () => {
        const selectTool = createTool('select');
        const drawTool = createTool('draw');

        manager.registerTool(selectTool);
        manager.registerTool(drawTool);
        manager.activateTool('draw');

        expect(() => manager.destroy()).not.toThrow();

        expect(selectTool.destroy).toHaveBeenCalledTimes(1);
        expect(drawTool.destroy).toHaveBeenCalledTimes(1);
        expect(manager.getAllTools()).toEqual([]);
        expect(manager.getActiveTool()).toBeNull();

        expect(getCalls(removeContainerSpy, 'mousedown')).toHaveLength(1);
        expect(getCalls(removeContainerSpy, 'mousemove')).toHaveLength(1);
        expect(getCalls(removeContainerSpy, 'mouseup')).toHaveLength(1);
        expect(getCalls(removeContainerSpy, 'dblclick')).toHaveLength(1);
        expect(getCalls(removeContainerSpy, 'wheel')).toHaveLength(1);
        expect(getCalls(removeContainerSpy, 'drop')).toHaveLength(1);
        expect(getCalls(removeDocumentSpy, 'mousemove')).toHaveLength(1);
        expect(getCalls(removeDocumentSpy, 'mouseup')).toHaveLength(1);
        expect(getCalls(removeDocumentSpy, 'keydown')).toHaveLength(1);
        expect(getCalls(removeDocumentSpy, 'keyup')).toHaveLength(1);
        expect(getCalls(removeWindowSpy, 'wheel')).toHaveLength(1);

        expect(() => manager.destroy()).not.toThrow();
    });

    it('repeated activation does not duplicate DOM routing for active listeners', () => {
        const drawTool = createTool('draw');

        manager.registerTool(drawTool);
        manager.activateTool('draw');
        manager.activateTool('draw');
        drawTool.onMouseMove.mockClear();

        document.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: 40,
            clientY: 60,
        }));

        expect(drawTool.onMouseMove).toHaveBeenCalledTimes(1);
        expect(drawTool.onMouseMove).toHaveBeenCalledWith(expect.objectContaining({ x: 40, y: 60 }));
    });
});
