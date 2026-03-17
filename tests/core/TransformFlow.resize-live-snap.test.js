import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { Events } from '../../src/core/events/Events.js';
import { setupTransformFlow } from '../../src/core/flows/TransformFlow.js';

function createCoreStub() {
    const eventBus = new EventBus();
    const objects = [
        { id: 'obj-1', type: 'note', width: 100, height: 80, position: { x: 90, y: 100 } },
        { id: 'obj-2', type: 'note', width: 120, height: 60, position: { x: 240, y: 160 } },
    ];
    const pixiObjects = new Map([
        ['obj-1', { width: 100, height: 80 }],
        ['obj-2', { width: 120, height: 60 }],
    ]);
    const core = {
        eventBus,
        state: {
            state: { objects },
            getObjects() {
                return this.state.objects;
            },
        },
        pixi: {
            objects: pixiObjects,
            updateObjectRotation: vi.fn(),
        },
        history: { executeCommand: vi.fn() },
        updateObjectSizeAndPositionDirect: vi.fn(),
        updateObjectRotationDirect: vi.fn(),
        selectTool: null,
        resizeStartSize: null,
        _activeResize: null,
        _groupResizeStart: null,
        _groupResizeSnapshot: null,
        _groupRotateStart: null,
        _groupRotateCenter: null,
    };
    return core;
}

describe('TransformFlow live resize snap policy', () => {
    it('disables snap during single ResizeUpdate', () => {
        const core = createCoreStub();
        setupTransformFlow(core);

        core.eventBus.emit(Events.Tool.ResizeStart, { object: 'obj-1', handle: 'se' });
        core.eventBus.emit(Events.Tool.ResizeUpdate, {
            object: 'obj-1',
            handle: 'se',
            size: { width: 130, height: 110 },
            position: { x: 90, y: 100 },
        });

        expect(core.updateObjectSizeAndPositionDirect).toHaveBeenCalled();
        const lastCall = core.updateObjectSizeAndPositionDirect.mock.calls.at(-1);
        expect(lastCall[0]).toBe('obj-1');
        expect(lastCall[1]).toEqual({ width: 130, height: 110 });
        expect(lastCall[4]).toEqual({ snap: false });
    });

    it('disables snap during GroupResizeUpdate for all objects', () => {
        const core = createCoreStub();
        setupTransformFlow(core);

        core.eventBus.emit(Events.Tool.GroupResizeStart, {
            objects: ['obj-1', 'obj-2'],
            startBounds: { x: 90, y: 100, width: 270, height: 140 },
            handle: 'se',
        });
        core.eventBus.emit(Events.Tool.GroupResizeUpdate, {
            objects: ['obj-1', 'obj-2'],
            startBounds: { x: 90, y: 100, width: 270, height: 140 },
            newBounds: { x: 90, y: 100, width: 300, height: 170 },
            scale: { x: 300 / 270, y: 170 / 140 },
        });

        expect(core.updateObjectSizeAndPositionDirect).toHaveBeenCalledTimes(2);
        for (const call of core.updateObjectSizeAndPositionDirect.mock.calls) {
            expect(call[4]).toEqual({ snap: false });
        }
    });
});
