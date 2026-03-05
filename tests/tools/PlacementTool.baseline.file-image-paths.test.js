import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';
import {
    collectEventPayloads,
    createMockApp,
    createMockEventBus,
    createMockWorld,
} from './PlacementTool.baseline.helpers.js';
import { PlacementTool } from '../../src/tools/object-tools/PlacementTool.js';

describe('PlacementTool baseline: file/image placement paths', () => {
    let eventBus;
    let world;
    let app;
    let core;
    let tool;

    beforeEach(() => {
        vi.clearAllMocks();
        eventBus = createMockEventBus();
        world = createMockWorld();
        app = createMockApp(world);
        core = {
            imageUploadService: { uploadImage: vi.fn() },
            fileUploadService: { uploadFile: vi.fn() },
        };
        tool = new PlacementTool(eventBus, core);
        tool.activate(app);
        eventBus.emit.mockClear();
    });

    it('file selected flow emits ToolbarAction with server payload fields', async () => {
        core.fileUploadService.uploadFile.mockResolvedValue({
            id: 'file-1',
            fileId: 'file-1',
            name: 'spec.pdf',
            size: 2048,
            mimeType: 'application/pdf',
            formattedSize: '2 KB',
            url: '/api/files/file-1/download',
        });
        tool.selectedFile = {
            file: new Blob(['x'], { type: 'application/pdf' }),
            fileName: 'spec.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            properties: { width: 120, height: 140 },
        };

        await tool.placeSelectedFile({ x: 300, y: 200, offsetX: 300, offsetY: 200, button: 0 });

        const payload = collectEventPayloads(eventBus, Events.UI.ToolbarAction)[0];
        expect(payload).toEqual(
            expect.objectContaining({
                type: 'file',
                id: 'file',
                fileId: 'file-1',
                properties: expect.objectContaining({
                    fileName: 'spec.pdf',
                    mimeType: 'application/pdf',
                    url: '/api/files/file-1/download',
                }),
            })
        );
    });

    it('file fallback path keeps local payload fields when upload fails', async () => {
        core.fileUploadService.uploadFile.mockRejectedValue(new Error('upload failed'));
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        tool.selectedFile = {
            file: new Blob(['x'], { type: 'application/pdf' }),
            fileName: 'local.pdf',
            fileSize: 777,
            mimeType: 'application/pdf',
            properties: { width: 120, height: 140 },
        };

        await tool.placeSelectedFile({ x: 100, y: 100, offsetX: 100, offsetY: 100, button: 0 });

        const payload = collectEventPayloads(eventBus, Events.UI.ToolbarAction)[0];
        expect(payload).toEqual(
            expect.objectContaining({
                type: 'file',
                id: 'file',
                properties: expect.objectContaining({
                    fileName: 'local.pdf',
                    fileSize: 777,
                    mimeType: 'application/pdf',
                }),
            })
        );
        alertSpy.mockRestore();
    });

    it('image selected flow emits ToolbarAction with server image fields', async () => {
        core.imageUploadService.uploadImage.mockResolvedValue({
            id: 'img-1',
            imageId: 'img-1',
            name: 'photo.png',
            url: '/api/images/img-1/file',
            width: 1000,
            height: 500,
        });
        tool.selectedImage = {
            file: new Blob(['png'], { type: 'image/png' }),
            fileName: 'photo.png',
            fileSize: 1234,
            mimeType: 'image/png',
            properties: { width: 300, height: 200 },
        };

        await tool.placeSelectedImage({ x: 500, y: 400, offsetX: 500, offsetY: 400, button: 0 });

        const payload = collectEventPayloads(eventBus, Events.UI.ToolbarAction)[0];
        expect(payload).toEqual(
            expect.objectContaining({
                type: 'image',
                id: 'image',
                imageId: 'img-1',
                properties: expect.objectContaining({
                    src: '/api/images/img-1/file',
                    name: 'photo.png',
                    width: 300,
                    height: 150,
                }),
            })
        );
    });

    it('image fallback path keeps minimal local payload fields', async () => {
        core.imageUploadService.uploadImage.mockRejectedValue(new Error('upload failed'));
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = vi.fn(() => 'blob://local-image');
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        tool.selectedImage = {
            file: new Blob(['png'], { type: 'image/png' }),
            fileName: 'local.png',
            fileSize: 1234,
            mimeType: 'image/png',
            properties: { width: 222, height: 111 },
        };

        await tool.placeSelectedImage({ x: 120, y: 80, offsetX: 120, offsetY: 80, button: 0 });

        const payload = collectEventPayloads(eventBus, Events.UI.ToolbarAction)[0];
        expect(payload).toEqual(
            expect.objectContaining({
                type: 'image',
                id: 'image',
                properties: expect.objectContaining({
                    src: 'blob://local-image',
                    name: 'local.png',
                    width: 222,
                    height: 111,
                }),
            })
        );
        URL.createObjectURL = originalCreateObjectURL;
        alertSpy.mockRestore();
    });
});
