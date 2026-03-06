import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

import { ToolManager } from '../../src/tools/ToolManager.js';
import { BaseTool } from '../../src/tools/BaseTool.js';
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

describe('ToolManager baseline: activation contracts', () => {
    let eventBus;
    let container;
    let pixiApp;
    let manager;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 }));
        document.body.appendChild(container);
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

    afterEach(() => {
        manager?.destroy();
        container?.remove();
    });

    it('activating a new tool deactivates the previous tool and passes pixiApp to activate', () => {
        const selectTool = createTool('select');
        const drawTool = createTool('draw');

        manager.registerTool(selectTool);
        manager.registerTool(drawTool);

        expect(manager.activateTool('select')).toBe(true);
        expect(manager.getActiveTool()).toBe(selectTool);
        expect(selectTool.activate).toHaveBeenCalledWith(pixiApp);
        expect(selectTool.deactivate).not.toHaveBeenCalled();

        expect(manager.activateTool('draw')).toBe(true);
        expect(manager.getActiveTool()).toBe(drawTool);
        expect(selectTool.deactivate).toHaveBeenCalledTimes(1);
        expect(drawTool.activate).toHaveBeenCalledWith(pixiApp);
    });

    it('keeps BaseTool activated/deactivated event payloads stable while switching tools', () => {
        const selectTool = new BaseTool('select', eventBus);
        const drawTool = new BaseTool('draw', eventBus);

        const selectActivateSpy = vi.spyOn(selectTool, 'activate');
        const selectDeactivateSpy = vi.spyOn(selectTool, 'deactivate');
        const drawActivateSpy = vi.spyOn(drawTool, 'activate');

        manager.registerTool(selectTool);
        manager.registerTool(drawTool);

        manager.activateTool('select');
        manager.activateTool('draw');

        expect(selectActivateSpy).toHaveBeenCalledTimes(1);
        expect(selectDeactivateSpy).toHaveBeenCalledTimes(1);
        expect(drawActivateSpy).toHaveBeenCalledTimes(1);
        expect(collectEventPayloads(eventBus, Events.Tool.Activated)).toEqual([
            { tool: 'select' },
            { tool: 'draw' },
        ]);
        expect(collectEventPayloads(eventBus, Events.Tool.Deactivated)).toEqual([
            { tool: 'select' },
        ]);
    });

    it('temporary activation switches back to the previous tool on return', () => {
        const drawTool = createTool('draw');
        const panTool = createTool('pan');

        manager.registerTool(drawTool);
        manager.registerTool(panTool);

        manager.activateTool('draw');
        manager.activateTemporaryTool('pan');

        expect(manager.getActiveTool()).toBe(panTool);
        expect(drawTool.deactivate).toHaveBeenCalledTimes(1);
        expect(panTool.activate).toHaveBeenCalledTimes(1);

        manager.returnToPreviousTool();

        expect(manager.getActiveTool()).toBe(drawTool);
        expect(drawTool.activate).toHaveBeenCalledTimes(2);
        expect(panTool.deactivate).toHaveBeenCalledTimes(1);
        expect(manager.temporaryTool).toBeNull();
        expect(manager.previousTool).toBeNull();
    });

    it('activating an unknown tool returns false, warns, and leaves the current tool untouched', () => {
        const selectTool = createTool('select');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        manager.registerTool(selectTool);
        manager.activateTool('select');

        expect(manager.activateTool('missing')).toBe(false);
        expect(manager.getActiveTool()).toBe(selectTool);
        expect(selectTool.deactivate).toHaveBeenCalledTimes(0);
        expect(warnSpy).toHaveBeenCalledWith('Tool "missing" not found');
    });
});
