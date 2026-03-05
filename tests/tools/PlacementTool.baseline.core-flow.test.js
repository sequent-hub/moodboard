import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMockApp,
    createMockEventBus,
    createMockWorld,
} from './PlacementTool.baseline.helpers.js';
import { PlacementTool } from '../../src/tools/object-tools/PlacementTool.js';

describe('PlacementTool baseline: core flow', () => {
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

    it('Place.Set prepares pending config for placement', () => {
        eventBus.emit(Events.Place.Set, { type: 'note', properties: { content: 'baseline' } });
        expect(tool.pending).toEqual({ type: 'note', properties: { content: 'baseline' } });
    });

    it('click confirm emits ToolbarAction payload and resets pending/ghost', () => {
        eventBus.emit(Events.Place.Set, { type: 'note', properties: { content: 'n1' } });
        expect(tool.ghostContainer).not.toBeNull();

        tool.onMouseDown({ x: 400, y: 300, offsetX: 400, offsetY: 300, button: 0 });

        const actions = collectEventPayloads(eventBus, Events.UI.ToolbarAction);
        expect(actions).toHaveLength(1);
        expect(actions[0]).toEqual(
            expect.objectContaining({
                type: 'note',
                id: 'note',
                position: expect.any(Object),
                properties: expect.objectContaining({ content: 'n1' }),
            })
        );
        expect(tool.pending).toBeNull();
        expect(tool.ghostContainer).toBeNull();
    });

    it('cancel via select activation clears pending and removes ghost', () => {
        eventBus.emit(Events.Place.Set, { type: 'shape', properties: { kind: 'circle' } });
        expect(tool.pending).toEqual(expect.objectContaining({ type: 'shape' }));
        expect(tool.ghostContainer).not.toBeNull();

        eventBus.emit(Events.Tool.Activated, { tool: 'select' });

        expect(tool.pending).toBeNull();
        expect(tool.ghostContainer).toBeNull();
    });

    it('type-specific placement smoke: text/note/shape/drawing/image/file/frame', () => {
        const scenarios = [
            { type: 'text', properties: { content: 't' } },
            { type: 'note', properties: { content: 'n' } },
            { type: 'shape', properties: { kind: 'rounded' } },
            { type: 'drawing', properties: { strokeWidth: 2 } },
            { type: 'image', properties: { width: 64, height: 64 } },
            { type: 'file', properties: { fileName: 'a.txt', mimeType: 'text/plain' } },
            { type: 'frame', properties: { title: 'Frame A', width: 260, height: 180 } },
        ];

        for (const scenario of scenarios) {
            eventBus.emit.mockClear();
            eventBus.emit(Events.Place.Set, scenario);
            tool.onMouseDown({ x: 200, y: 160, offsetX: 200, offsetY: 160, button: 0 });

            const payload = collectEventPayloads(eventBus, Events.UI.ToolbarAction)[0];
            expect(payload).toEqual(
                expect.objectContaining({
                    type: scenario.type,
                    id: scenario.type,
                    position: expect.any(Object),
                    properties: expect.any(Object),
                })
            );
        }
    });
});
