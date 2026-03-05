import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMockApp,
    createMockEventBus,
    createMockWorld,
} from './PlacementTool.baseline.helpers.js';
import { PlacementTool } from '../../src/tools/object-tools/PlacementTool.js';

describe('PlacementTool baseline: event contracts', () => {
    let eventBus;
    let world;
    let app;
    let tool;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createMockEventBus();
        world = createMockWorld();
        app = createMockApp(world);
        tool = new PlacementTool(eventBus, {
            imageUploadService: { uploadImage: vi.fn() },
            fileUploadService: { uploadFile: vi.fn() },
        });
        tool.activate(app);
        eventBus.emit.mockClear();
    });

    it('event names baseline stays stable for Place and ToolbarAction', () => {
        expect(Events.Place.Set).toBe('place:set');
        expect(Events.Place.GhostShow).toBe('place:ghost:show');
        expect(Events.Place.GhostUpdate).toBe('place:ghost:update');
        expect(Events.Place.GhostHide).toBe('place:ghost:hide');
        expect(Events.UI.ToolbarAction).toBe('toolbar:action');
    });

    it('ToolbarAction payload key contract for note placement remains stable', () => {
        eventBus.emit(Events.Place.Set, { type: 'note', properties: { content: 'baseline' } });
        tool.onMouseDown({ x: 250, y: 180, offsetX: 250, offsetY: 180, button: 0 });

        const payload = collectEventPayloads(eventBus, Events.UI.ToolbarAction)[0];
        expect(Object.keys(payload).sort()).toEqual(['id', 'position', 'properties', 'type']);
        expect(Object.keys(payload.position).sort()).toEqual(['x', 'y']);
        expect(payload).toEqual(
            expect.objectContaining({
                type: 'note',
                id: 'note',
                properties: expect.any(Object),
            })
        );
    });

    it('Place.Ghost* events are not emitted in current placement baseline flow', () => {
        eventBus.emit(Events.Place.Set, { type: 'shape', properties: { kind: 'square' } });
        app.view.__dispatch('mousemove', { x: 10, y: 20, offsetX: 10, offsetY: 20 });
        tool.onMouseDown({ x: 10, y: 20, offsetX: 10, offsetY: 20, button: 0 });
        tool.deactivate();

        expect(collectEventPayloads(eventBus, Events.Place.GhostShow)).toHaveLength(0);
        expect(collectEventPayloads(eventBus, Events.Place.GhostUpdate)).toHaveLength(0);
        expect(collectEventPayloads(eventBus, Events.Place.GhostHide)).toHaveLength(0);
    });

    it('repeated activate/deactivate does not duplicate ToolbarAction emits', () => {
        tool.deactivate();
        tool.activate(app);
        eventBus.emit.mockClear();

        eventBus.emit(Events.Place.Set, { type: 'note', properties: {} });
        tool.onMouseDown({ x: 99, y: 101, offsetX: 99, offsetY: 101, button: 0 });

        expect(collectEventPayloads(eventBus, Events.UI.ToolbarAction)).toHaveLength(1);
    });
});
