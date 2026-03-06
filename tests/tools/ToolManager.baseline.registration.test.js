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

describe('ToolManager baseline: registration contracts', () => {
    let eventBus;
    let container;
    let manager;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 }));
        document.body.appendChild(container);
        manager = new ToolManager(eventBus, container, null, null);
    });

    afterEach(() => {
        manager?.destroy();
        container?.remove();
    });

    it('registers tools by name and exposes them through current lookup methods', () => {
        const selectTool = createTool('select', { hotkey: 'v' });
        const drawTool = createTool('draw', { hotkey: 'd' });

        manager.registerTool(selectTool);
        manager.registerTool(drawTool);

        expect(manager.getActiveTool()).toBeNull();
        expect(manager.hasActiveTool('select')).toBe(true);
        expect(manager.hasActiveTool('draw')).toBe(true);
        expect(manager.hasActiveTool('missing')).toBe(false);
        expect(manager.getAllTools()).toEqual([selectTool, drawTool]);
    });

    it('activateDefaultTool uses the first registered tool as the stable default', () => {
        const selectTool = createTool('select');
        const drawTool = createTool('draw');

        manager.registerTool(selectTool);
        manager.registerTool(drawTool);
        manager.activateDefaultTool();

        expect(manager.getActiveTool()).toBe(selectTool);
        expect(selectTool.activate).toHaveBeenCalledTimes(1);
        expect(drawTool.activate).not.toHaveBeenCalled();
    });

    it('duplicate registration overwrites the named entry while keeping default-name behavior', () => {
        const firstSelect = createTool('select');
        const replacementSelect = createTool('select', { cursor: 'crosshair' });

        manager.registerTool(firstSelect);
        manager.registerTool(replacementSelect);

        expect(manager.getAllTools()).toEqual([replacementSelect]);
        expect(manager.hasActiveTool('select')).toBe(true);

        manager.activateTool('select');
        expect(manager.getActiveTool()).toBe(replacementSelect);
        expect(firstSelect.activate).not.toHaveBeenCalled();

        manager.activateDefaultTool();
        expect(manager.getActiveTool()).toBe(replacementSelect);
    });
});
