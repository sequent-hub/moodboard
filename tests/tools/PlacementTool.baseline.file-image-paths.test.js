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
            src: 'https://cdn.futurello.futurebim.ru/files/spec.pdf',
            name: 'spec.pdf',
            size: 2048,
            mimeType: 'application/pdf',
            formattedSize: '2 KB',
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
                properties: expect.objectContaining({
                    fileName: 'spec.pdf',
                    mimeType: 'application/pdf',
                    src: 'https://cdn.futurello.futurebim.ru/files/spec.pdf',
                }),
            })
        );
    });

    it('file upload error does not emit ToolbarAction and shows alert', async () => {
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

        expect(collectEventPayloads(eventBus, Events.UI.ToolbarAction)).toHaveLength(0);
        expect(alertSpy).toHaveBeenCalledWith('Ошибка загрузки файла на сервер. Файл не добавлен.');
        alertSpy.mockRestore();
    });

    it('image selected flow emits ToolbarAction with server image fields', async () => {
        vi.spyOn(tool.revitMetadataService, 'extractFromFile').mockResolvedValue({
            hasMetadata: false,
            payload: null
        });
        core.imageUploadService.uploadImage.mockResolvedValue({
            name: 'photo.png',
            url: '/api/v2/images/img-1/download',
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
                properties: expect.objectContaining({
                    src: '/api/v2/images/img-1/download',
                    name: 'photo.png',
                    width: 300,
                    height: 150,
                }),
            })
        );
    });

    it('image upload error does not emit ToolbarAction and shows alert', async () => {
        vi.spyOn(tool.revitMetadataService, 'extractFromFile').mockResolvedValue({
            hasMetadata: false,
            payload: null
        });
        core.imageUploadService.uploadImage.mockRejectedValue(new Error('upload failed'));
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        tool.selectedImage = {
            file: new Blob(['png'], { type: 'image/png' }),
            fileName: 'local.png',
            fileSize: 1234,
            mimeType: 'image/png',
            properties: { width: 222, height: 111 },
        };

        await tool.placeSelectedImage({ x: 120, y: 80, offsetX: 120, offsetY: 80, button: 0 });

        expect(collectEventPayloads(eventBus, Events.UI.ToolbarAction)).toHaveLength(0);
        expect(alertSpy).toHaveBeenCalledWith('Ошибка загрузки изображения на сервер. Изображение не добавлено.');
        alertSpy.mockRestore();
    });

    it('image selected flow emits revit-screenshot-img when metadata detected', async () => {
        vi.spyOn(tool.revitMetadataService, 'extractFromFile').mockResolvedValue({
            hasMetadata: true,
            payload: '{"view":"abc"}'
        });
        core.imageUploadService.uploadImage.mockResolvedValue({
            name: 'revit.png',
            url: '/api/v2/images/img-2/download',
            width: 1000,
            height: 500,
        });
        tool.selectedImage = {
            file: new Blob(['png'], { type: 'image/png' }),
            fileName: 'revit.png',
            fileSize: 1000,
            mimeType: 'image/png',
            properties: { width: 300, height: 200 },
        };

        await tool.placeSelectedImage({ x: 400, y: 300, offsetX: 400, offsetY: 300, button: 0 });

        const payload = collectEventPayloads(eventBus, Events.UI.ToolbarAction)[0];
        expect(payload).toEqual(
            expect.objectContaining({
                type: 'revit-screenshot-img',
                id: 'revit-screenshot-img',
                properties: expect.objectContaining({
                    src: '/api/v2/images/img-2/download',
                    view: '{"view":"abc"}'
                }),
            })
        );
    });

    it('revit image upload error does not emit ToolbarAction and shows alert', async () => {
        vi.spyOn(tool.revitMetadataService, 'extractFromFile').mockResolvedValue({
            hasMetadata: true,
            payload: '{"view":"fallback"}'
        });
        core.imageUploadService.uploadImage.mockRejectedValue(new Error('upload failed'));
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        tool.selectedImage = {
            file: new Blob(['png'], { type: 'image/png' }),
            fileName: 'revit-local.png',
            fileSize: 1111,
            mimeType: 'image/png',
            properties: { width: 200, height: 100 },
        };

        await tool.placeSelectedImage({ x: 200, y: 120, offsetX: 200, offsetY: 120, button: 0 });

        expect(collectEventPayloads(eventBus, Events.UI.ToolbarAction)).toHaveLength(0);
        expect(alertSpy).toHaveBeenCalledWith('Ошибка загрузки изображения на сервер. Изображение не добавлено.');
        alertSpy.mockRestore();
    });
});
