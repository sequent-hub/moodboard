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
            position: { x: 70, y: 90 },
            properties: expect.objectContaining({
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                url: '/api/files/file-1/download',
            }),
        }));
    });
});
