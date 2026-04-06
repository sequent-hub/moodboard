import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupClipboardFlow } from '../../src/core/flows/ClipboardFlow.js';
import { Events } from '../../src/core/events/Events.js';

vi.mock('../../src/services/RevitScreenshotMetadataService.js', () => {
    return {
        RevitScreenshotMetadataService: class {
            async extractFromImageSource(src) {
                if (typeof src === 'string' && (src.includes('revit') || src.includes('img-1'))) {
                    return {
                        hasMetadata: true,
                        payload: '{"view":"revit-1"}',
                    };
                }
                return {
                    hasMetadata: false,
                    payload: null,
                };
            }
        }
    };
});

function createEventBus() {
    const listeners = new Map();
    return {
        on(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
        },
        off(event, handler) {
            listeners.get(event)?.delete(handler);
        },
        emit(event, payload) {
            const handlers = listeners.get(event);
            if (!handlers) return;
            for (const handler of handlers) handler(payload);
        }
    };
}

describe('ClipboardFlow Revit metadata routing', () => {
    let originalImage;

    beforeEach(() => {
        originalImage = global.Image;
        global.Image = class {
            constructor() {
                this.onload = null;
                this.onerror = null;
                this.naturalWidth = 100;
                this.naturalHeight = 50;
            }
            set src(_value) {
                if (this.onload) this.onload();
            }
        };
    });

    afterEach(() => {
        global.Image = originalImage;
        vi.restoreAllMocks();
    });

    it('creates revit-screenshot-img for PasteImage when metadata exists', async () => {
        const eventBus = createEventBus();
        const createObject = vi.fn();
        const core = {
            eventBus,
            createObject,
            pixi: {
                app: { stage: {}, view: { clientWidth: 1000, clientHeight: 700 } },
                worldLayer: { x: 0, y: 0, scale: { x: 1 } }
            },
            state: { state: { objects: [] } },
            history: { executeCommand: vi.fn() },
            toolManager: { getActiveTool: vi.fn(() => null) },
            selectTool: null,
            _cursor: { x: 400, y: 200 }
        };

        setupClipboardFlow(core);
        eventBus.emit(Events.UI.PasteImage, {
            src: '/api/v2/images/img-1/download',
            name: 'r.png'
        });

        await vi.waitFor(() => expect(createObject).toHaveBeenCalled());
        expect(createObject).toHaveBeenCalledWith(
            'revit-screenshot-img',
            expect.any(Object),
            expect.objectContaining({
                src: '/api/v2/images/img-1/download',
                view: '{"view":"revit-1"}'
            })
        );
    });

    it('creates image for PasteImageAt when metadata absent', async () => {
        const eventBus = createEventBus();
        const createObject = vi.fn();
        const core = {
            eventBus,
            createObject,
            pixi: {
                app: { stage: {}, view: { clientWidth: 1000, clientHeight: 700 } },
                worldLayer: { x: 0, y: 0, scale: { x: 1 } }
            },
            state: { state: { objects: [] } },
            history: { executeCommand: vi.fn() },
            toolManager: { getActiveTool: vi.fn(() => null) },
            selectTool: null
        };

        setupClipboardFlow(core);
        eventBus.emit(Events.UI.PasteImageAt, {
            x: 100,
            y: 100,
            src: '/api/v2/images/img-2/download',
            name: 'plain.png'
        });

        await vi.waitFor(() => expect(createObject).toHaveBeenCalled());
        expect(createObject).toHaveBeenCalledWith(
            'image',
            expect.any(Object),
            expect.not.objectContaining({ view: expect.any(String) })
        );
    });

    it('создает image-объект для legacy src (контракт src-only)', async () => {
        const eventBus = createEventBus();
        const createObject = vi.fn();
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const core = {
            eventBus,
            createObject,
            pixi: {
                app: { stage: {}, view: { clientWidth: 1000, clientHeight: 700 } },
                worldLayer: { x: 0, y: 0, scale: { x: 1 } }
            },
            state: { state: { objects: [] } },
            history: { executeCommand: vi.fn() },
            toolManager: { getActiveTool: vi.fn(() => null) },
            selectTool: null
        };

        setupClipboardFlow(core);
        eventBus.emit(Events.UI.PasteImageAt, {
            x: 100,
            y: 100,
            src: '/api/images/img-legacy/file',
            name: 'legacy.png'
        });

        await Promise.resolve();
        await vi.waitFor(() => expect(createObject).toHaveBeenCalled());
        expect(createObject).toHaveBeenCalledWith(
            'image',
            expect.any(Object),
            expect.objectContaining({
                src: '/api/images/img-legacy/file',
                name: 'legacy.png',
            })
        );
        expect(alertSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });
});

