import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeyboardManager } from '../../src/core/KeyboardManager.js';
import { Events } from '../../src/core/events/Events.js';

describe('KeyboardManager - image upload channels', () => {
    let eventBus;
    let targetElement;
    let core;
    let manager;
    let originalFileReader;
    let consoleErrorSpy;

    beforeEach(() => {
        eventBus = { emit: vi.fn() };
        targetElement = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
        core = {
            imageUploadService: {
                uploadFromDataUrl: vi.fn(),
                uploadImage: vi.fn(),
            },
        };
        manager = new KeyboardManager(eventBus, targetElement, core);
        originalFileReader = global.FileReader;
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        global.FileReader = originalFileReader;
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('при успешном uploadImage эмитит PasteImage с url и imageId', async () => {
        core.imageUploadService.uploadImage.mockResolvedValue({
            url: '/api/images/img-1/file',
            name: 'special.png',
            imageId: 'img-1',
        });

        const file = new Blob(['png'], { type: 'image/png' });
        await manager._handleImageFileUpload(file, 'special.png');

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImage, {
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
                this.result = 'data:image/png;base64,AAAA';
                if (this.onload) this.onload();
            }
        };

        const file = new Blob(['png'], { type: 'image/png' });
        await manager._handleImageFileUpload(file, 'special.png');

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImage, {
            src: 'data:image/png;base64,AAAA',
            name: 'special.png',
        });
    });

    it('при успешном uploadFromDataUrl эмитит PasteImage с url и imageId', async () => {
        core.imageUploadService.uploadFromDataUrl.mockResolvedValue({
            url: '/api/images/img-2/file',
            name: 'clipboard.png',
            id: 'img-2',
        });

        await manager._handleImageUpload('data:image/png;base64,BBBB', 'clipboard.png');

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImage, {
            src: '/api/images/img-2/file',
            name: 'clipboard.png',
            imageId: 'img-2',
        });
    });

    it('при ошибке uploadFromDataUrl делает fallback к исходному dataUrl', async () => {
        core.imageUploadService.uploadFromDataUrl.mockRejectedValue(new Error('upload failed'));

        await manager._handleImageUpload('data:image/png;base64,CCCC', 'clipboard.png');

        expect(eventBus.emit).toHaveBeenCalledWith(Events.UI.PasteImage, {
            src: 'data:image/png;base64,CCCC',
            name: 'clipboard.png',
        });
    });

    it('paste handler для text/plain data URL вызывает handleImageUpload и preventDefault', async () => {
        const handleImageUploadSpy = vi
            .spyOn(manager.clipboardImagePaste, 'handleImageUpload')
            .mockResolvedValue(undefined);
        const preventDefault = vi.fn();
        const handler = manager.clipboardImagePaste.createPasteHandler();

        await handler({
            clipboardData: {
                items: [],
                files: [],
                getData: (type) => type === 'text/plain' ? 'data:image/png;base64,DDDD' : '',
            },
            preventDefault,
        });

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(handleImageUploadSpy).toHaveBeenCalledWith('data:image/png;base64,DDDD', 'clipboard-image.png');
    });

    it('paste handler для items API вызывает handleImageFileUpload с clipboard image file', async () => {
        const file = new Blob(['png'], { type: 'image/png' });
        file.name = 'clipboard-item.png';
        const handleImageFileUploadSpy = vi
            .spyOn(manager.clipboardImagePaste, 'handleImageFileUpload')
            .mockResolvedValue(undefined);
        const preventDefault = vi.fn();
        const handler = manager.clipboardImagePaste.createPasteHandler();

        await handler({
            clipboardData: {
                items: [
                    {
                        type: 'image/png',
                        getAsFile: () => file,
                    },
                ],
                files: [],
                getData: () => '',
            },
            preventDefault,
        });

        expect(preventDefault).toHaveBeenCalledTimes(1);
        expect(handleImageFileUploadSpy).toHaveBeenCalledWith(file, 'clipboard-item.png');
    });

});
