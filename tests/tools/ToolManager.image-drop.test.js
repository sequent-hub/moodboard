import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

vi.mock('../../src/assets/icons/cursor-default.svg?raw', () => ({
    default: '<svg width="32px" height="64px"></svg>',
}));

import { ToolManager } from '../../src/tools/ToolManager.js';

describe('ToolManager - drag and drop image upload', () => {
    let eventBus;
    let container;
    let core;
    let manager;
    let originalFileReader;
    let consoleWarnSpy;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        container = document.createElement('div');
        container.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0 }));
        core = { imageUploadService: { uploadImage: vi.fn() } };
        manager = new ToolManager(eventBus, container, null, core);
        originalFileReader = global.FileReader;
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        global.FileReader = originalFileReader;
        consoleWarnSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('при успешном uploadImage эмитит PasteImageAt с server URL', async () => {
        core.imageUploadService.uploadImage.mockResolvedValue({
            url: '/api/images/img-1/file',
            name: 'special.png',
            imageId: 'img-1',
        });

        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'special.png';
        const event = {
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 200,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImageAt, {
            x: 100,
            y: 200,
            src: '/api/images/img-1/file',
            name: 'special.png',
            imageId: 'img-1',
        });
    });

    it('при ошибке uploadImage делает fallback через FileReader(dataURL)', async () => {
        core.imageUploadService.uploadImage.mockRejectedValue(new Error('net::ERR_CONNECTION_TIMED_OUT'));

        global.FileReader = class {
            constructor() {
                this.onload = null;
                this.result = null;
            }
            readAsDataURL() {
                this.result = 'data:image/png;base64,BBBB';
                if (this.onload) this.onload();
            }
        };

        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'special.png';
        const event = {
            preventDefault: vi.fn(),
            clientX: 50,
            clientY: 60,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImageAt, {
            x: 50,
            y: 60,
            src: 'data:image/png;base64,BBBB',
            name: 'special.png',
            imageId: null,
        });
    });

    it('при drop обычного файла эмитит ToolbarAction type="file"', async () => {
        core.fileUploadService = { uploadFile: vi.fn().mockResolvedValue({
            id: 'file-1',
            fileId: 'file-1',
            name: 'report.pdf',
            size: 12345,
            mimeType: 'application/pdf',
            formattedSize: '12 KB',
            url: '/api/files/file-1/download',
        }) };

        const file = new Blob(['pdf-content'], { type: 'application/pdf' });
        file.name = 'report.pdf';

        const event = {
            preventDefault: vi.fn(),
            clientX: 70,
            clientY: 90,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.ToolbarAction, expect.objectContaining({
            type: 'file',
            id: 'file',
            fileId: 'file-1',
            position: { x: 10, y: 20 },
            properties: expect.objectContaining({
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                url: '/api/files/file-1/download',
            }),
        }));
    });

    it('учитывает смещение canvas при drop изображения (client -> local)', async () => {
        container.getBoundingClientRect = vi.fn(() => ({ left: 120, top: 80 }));
        core.imageUploadService.uploadImage.mockResolvedValue({
            url: '/api/images/img-2/file',
            name: 'offset.png',
            imageId: 'img-2',
        });

        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'offset.png';
        const event = {
            preventDefault: vi.fn(),
            clientX: 220,
            clientY: 230,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImageAt, {
            x: 100,
            y: 150,
            src: '/api/images/img-2/file',
            name: 'offset.png',
            imageId: 'img-2',
        });
    });

    it('для нескольких файлов применяет веерную раскладку от точки курсора', async () => {
        core.fileUploadService = {
            uploadFile: vi
                .fn()
                .mockResolvedValueOnce({
                    id: 'file-1',
                    fileId: 'file-1',
                    name: 'a.pdf',
                    size: 100,
                    mimeType: 'application/pdf',
                    formattedSize: '100 B',
                    url: '/api/files/file-1/download',
                })
                .mockResolvedValueOnce({
                    id: 'file-2',
                    fileId: 'file-2',
                    name: 'b.pdf',
                    size: 200,
                    mimeType: 'application/pdf',
                    formattedSize: '200 B',
                    url: '/api/files/file-2/download',
                })
                .mockResolvedValueOnce({
                    id: 'file-3',
                    fileId: 'file-3',
                    name: 'c.pdf',
                    size: 300,
                    mimeType: 'application/pdf',
                    formattedSize: '300 B',
                    url: '/api/files/file-3/download',
                }),
        };

        const fileA = new Blob(['a'], { type: 'application/pdf' });
        fileA.name = 'a.pdf';
        const fileB = new Blob(['b'], { type: 'application/pdf' });
        fileB.name = 'b.pdf';
        const fileC = new Blob(['c'], { type: 'application/pdf' });
        fileC.name = 'c.pdf';

        const event = {
            preventDefault: vi.fn(),
            clientX: 100,
            clientY: 200,
            dataTransfer: {
                files: [fileA, fileB, fileC],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        const toolbarActions = eventBus.emit.mock.calls
            .filter(([evt]) => evt === Events.UI.ToolbarAction)
            .map(([, payload]) => payload);

        expect(toolbarActions).toHaveLength(3);
        expect(toolbarActions[0]).toEqual(expect.objectContaining({
            type: 'file',
            position: { x: 40, y: 130 },
            fileId: 'file-1',
        }));
        expect(toolbarActions[1]).toEqual(expect.objectContaining({
            type: 'file',
            position: { x: 65, y: 130 },
            fileId: 'file-2',
        }));
        expect(toolbarActions[2]).toEqual(expect.objectContaining({
            type: 'file',
            position: { x: 65, y: 155 },
            fileId: 'file-3',
        }));
    });

    it('для file route пересчитывает drop-позицию в world с учетом pan/zoom', async () => {
        core.fileUploadService = {
            uploadFile: vi.fn().mockResolvedValue({
                id: 'file-1',
                fileId: 'file-1',
                name: 'coords.txt',
                size: 4,
                mimeType: 'text/plain',
                formattedSize: '4 B',
                url: '/api/files/file-1/download',
            }),
        };
        core.pixi = {
            worldLayer: {
                x: 180,
                y: 90,
                scale: { x: 2 }
            }
        };

        const file = new Blob(['test'], { type: 'text/plain' });
        file.name = 'coords.txt';
        const event = {
            preventDefault: vi.fn(),
            clientX: 580,
            clientY: 390,
            dataTransfer: {
                files: [file],
                getData: vi.fn(() => ''),
            },
        };

        await manager.handleDrop(event);

        const toolbarActionCall = eventBus.emit.mock.calls.find(([evt]) => evt === Events.UI.ToolbarAction);
        expect(toolbarActionCall).toBeTruthy();
        const payload = toolbarActionCall[1];
        const expectedWorld = { x: (580 - 180) / 2, y: (390 - 90) / 2 };
        expect(payload.position).toEqual({
            x: Math.round(expectedWorld.x - 60),
            y: Math.round(expectedWorld.y - 70),
        });
    });
});
