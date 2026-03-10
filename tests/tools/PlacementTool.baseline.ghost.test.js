import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    createMockApp,
    createMockEventBus,
    createMockWorld,
} from './PlacementTool.baseline.helpers.js';
import { PlacementTool } from '../../src/tools/object-tools/PlacementTool.js';

describe('PlacementTool baseline: ghost behavior', () => {
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
    });

    it('ghost show/hide/update contract for note placement', () => {
        eventBus.emit(Events.Place.Set, { type: 'note', properties: { width: 250, height: 250 } });
        expect(tool.ghostContainer).not.toBeNull();
        expect(world.addChild).toHaveBeenCalledWith(tool.ghostContainer);

        tool.updateGhostPosition(111, 222);
        expect(tool.ghostContainer.x).toBe(111);
        expect(tool.ghostContainer.y).toBe(222);

        const oldGhost = tool.ghostContainer;
        tool.hideGhost();
        expect(world.removeChild).toHaveBeenCalledWith(oldGhost);
        expect(oldGhost.destroy).toHaveBeenCalled();
        expect(tool.ghostContainer).toBeNull();
    });

    it('ghost follows move and world mapping changes (zoom/pan smoke)', () => {
        let scale = 1;
        let panX = 0;
        let panY = 0;
        world.toLocal.mockImplementation((p) => ({
            x: p.x * scale + panX,
            y: p.y * scale + panY,
        }));

        eventBus.emit(Events.Place.Set, { type: 'shape', properties: { kind: 'circle' } });
        expect(tool.ghostContainer).not.toBeNull();

        app.view.__dispatch('mousemove', { x: 100, y: 200, offsetX: 100, offsetY: 200 });
        expect(tool.ghostContainer.x).toBe(100);
        expect(tool.ghostContainer.y).toBe(200);

        scale = 1.5;
        panX = 20;
        panY = -10;
        app.view.__dispatch('mousemove', { x: 100, y: 200, offsetX: 100, offsetY: 200 });
        expect(tool.ghostContainer.x).toBe(170);
        expect(tool.ghostContainer.y).toBe(290);
    });

    it('ghost is removed on deactivate and destroy', () => {
        eventBus.emit(Events.Place.Set, { type: 'frame', properties: { width: 200, height: 300 } });
        expect(tool.ghostContainer).not.toBeNull();

        tool.deactivate();
        expect(tool.ghostContainer).toBeNull();

        tool.activate(app);
        eventBus.emit(Events.Place.Set, { type: 'note', properties: {} });
        expect(tool.ghostContainer).not.toBeNull();
        tool.destroy();
        expect(tool.ghostContainer).toBeNull();
        expect(tool.app).toBeNull();
        expect(tool.world).toBeNull();
    });

    it('Place.ImageSelected → showImageGhost adds ghost to world (async)', async () => {
        const file = new File(['x'], 'test-image.png', { type: 'image/png' });
        eventBus.emit(Events.Place.ImageSelected, {
            file,
            fileName: 'test-image.png',
            properties: { width: 300, height: 200 }
        });

        await vi.waitFor(
            () => {
                expect(tool.ghostContainer).not.toBeNull();
                expect(world.addChild).toHaveBeenCalledWith(tool.ghostContainer);
            },
            { timeout: 500 }
        );

        tool.updateGhostPosition(50, 75);
        expect(tool.ghostContainer.x).toBe(50);
        expect(tool.ghostContainer.y).toBe(75);
    });

    it('Place.FileSelected → showFileGhost adds ghost to world with 120×140', () => {
        const file = new File(['doc content'], 'document.pdf', { type: 'application/pdf' });
        eventBus.emit(Events.Place.FileSelected, {
            file,
            fileName: 'document.pdf',
            fileSize: 100,
            mimeType: 'application/pdf',
            properties: { width: 120, height: 140 }
        });

        expect(tool.ghostContainer).not.toBeNull();
        expect(world.addChild).toHaveBeenCalledWith(tool.ghostContainer);
        expect(tool.ghostContainer.pivot.x).toBe(60);
        expect(tool.ghostContainer.pivot.y).toBe(70);

        tool.updateGhostPosition(80, 90);
        expect(tool.ghostContainer.x).toBe(80);
        expect(tool.ghostContainer.y).toBe(90);
    });
});
