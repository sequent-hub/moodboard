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
});
