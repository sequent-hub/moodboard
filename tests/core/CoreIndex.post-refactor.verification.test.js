import { describe, it, expect, vi, afterEach } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { Events } from '../../src/core/events/Events.js';
import { EventBus } from '../../src/core/EventBus.js';
import { SaveManager } from '../../src/core/SaveManager.js';
import { HistoryManager } from '../../src/core/HistoryManager.js';
import { setupLayerAndViewportFlow } from '../../src/core/flows/LayerAndViewportFlow.js';
import { createCoreBaselineContext } from './CoreIndex.baseline.helpers.js';

function withLayerFlowContext(objects) {
    const ctx = createCoreBaselineContext({ objects });
    ctx.pixi.app = {
        stage: { sortableChildren: false },
        view: { clientWidth: 1200, clientHeight: 800 }
    };
    ctx.pixi.worldLayer = {
        x: 0,
        y: 0,
        scale: {
            x: 1,
            set(value) {
                this.x = value;
            }
        }
    };
    ctx.toolManager = {
        getActiveTool: () => ({
            name: 'select',
            selectedObjects: new Set()
        })
    };
    ctx.selectTool = {
        selectedObjects: new Set(),
        setSelection: vi.fn(),
        updateResizeHandles: vi.fn()
    };
    setupLayerAndViewportFlow(ctx);
    return ctx;
}

describe('Post-refactor verification: layer and viewport flows', () => {
    it('single object z-order action reorders state and updates PIXI zIndex', () => {
        const ctx = withLayerFlowContext([
            { id: 'a', type: 'note', position: { x: 10, y: 10 }, width: 100, height: 80 },
            { id: 'b', type: 'note', position: { x: 20, y: 20 }, width: 100, height: 80 },
            { id: 'c', type: 'note', position: { x: 30, y: 30 }, width: 100, height: 80 }
        ]);

        ctx.eventBus.emit(Events.UI.LayerBringToFront, { objectId: 'a' });

        expect(ctx.state.state.objects.map((o) => o.id)).toEqual(['b', 'c', 'a']);
        expect(ctx.pixi.objects.get('b').zIndex).toBe(0);
        expect(ctx.pixi.objects.get('c').zIndex).toBe(1);
        expect(ctx.pixi.objects.get('a').zIndex).toBe(2);
    });

    it('group z-order action keeps group block and internal order', () => {
        const ctx = withLayerFlowContext([
            { id: 'a', type: 'note', position: { x: 10, y: 10 }, width: 100, height: 80 },
            { id: 'b', type: 'note', position: { x: 20, y: 20 }, width: 100, height: 80 },
            { id: 'c', type: 'note', position: { x: 30, y: 30 }, width: 100, height: 80 },
            { id: 'd', type: 'note', position: { x: 40, y: 40 }, width: 100, height: 80 }
        ]);

        ctx.toolManager = {
            getActiveTool: () => ({
                name: 'select',
                selectedObjects: new Set(['b', 'c'])
            })
        };

        ctx.eventBus.emit(Events.UI.LayerGroupBringToFront, {});

        expect(ctx.state.state.objects.map((o) => o.id)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('pan + minimap + zoom selection keep mutable payload contract', () => {
        const ctx = withLayerFlowContext([
            { id: 'a', type: 'note', position: { x: 100, y: 100 }, width: 120, height: 80, transform: { rotation: 10 } },
            { id: 'b', type: 'note', position: { x: 420, y: 260 }, width: 200, height: 140, transform: { rotation: 25 } }
        ]);

        const boardDataChanged = vi.fn();
        ctx.eventBus.on(Events.Grid.BoardDataChanged, boardDataChanged);

        ctx.eventBus.emit(Events.Tool.PanUpdate, { delta: { x: 30, y: -10 } });
        expect(ctx.pixi.worldLayer.x).toBe(30);
        expect(ctx.pixi.worldLayer.y).toBe(-10);
        expect(boardDataChanged).toHaveBeenCalledTimes(1);

        const req = {};
        ctx.eventBus.emit(Events.UI.MinimapGetData, req);
        expect(req.world).toEqual(expect.objectContaining({ x: 30, y: -10, scale: 1 }));
        expect(req.view).toEqual(expect.objectContaining({ width: 1200, height: 800 }));
        expect(req.objects).toHaveLength(2);

        ctx.selectTool.selectedObjects = new Set(['a', 'b']);
        ctx.eventBus.emit(Events.UI.ZoomSelection, {});
        expect(ctx.pixi.worldLayer.scale.x).toBeGreaterThan(0.1);
        expect(ctx.pixi.worldLayer.scale.x).toBeLessThanOrEqual(5);
    });
});

describe('Post-refactor verification: wiring/lifecycle risks', () => {
    it('re-running setupToolEvents does not duplicate handlers for the same event', () => {
        const ctx = createCoreBaselineContext({
            objects: [{ id: 'obj-1', type: 'note', position: { x: 10, y: 10 }, width: 100, height: 80 }],
        });

        CoreMoodBoard.prototype.setupToolEvents.call(ctx);
        CoreMoodBoard.prototype.setupToolEvents.call(ctx);

        ctx.eventBus.emit(Events.Tool.ObjectsDelete, { objects: ['obj-1'] });
        // ObjectsDelete -> GroupDeleteCommand -> history.executeCommand (1 раз при одном обработчике)
        expect(ctx.history.executeCommand).toHaveBeenCalledTimes(1);
        expect(ctx.state.getObjects()).not.toContainEqual(expect.objectContaining({ id: 'obj-1' }));
    });

    it('SaveManager.destroy removes its EventBus subscriptions', () => {
        vi.useFakeTimers();
        const bus = new EventBus();
        const manager = new SaveManager(bus, { autoSave: true });

        expect((bus.events.get(Events.Object.Created) || new Set()).size).toBeGreaterThan(0);
        manager.destroy();

        expect((bus.events.get(Events.Object.Created) || new Set()).size).toBe(0);
        vi.useRealTimers();
    });

    it('HistoryManager.destroy removes only its own listeners', () => {
        const bus = new EventBus();
        const external = vi.fn();
        bus.on(Events.UI.ZoomIn, external);
        const history = new HistoryManager(bus);

        history.destroy();
        bus.emit(Events.UI.ZoomIn, {});

        expect(external).toHaveBeenCalledTimes(1);
    });
});

afterEach(() => {
    vi.useRealTimers();
});
