import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupClipboardFlow } from '../../src/core/flows/ClipboardFlow.js';
import { Events } from '../../src/core/events/Events.js';

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
        },
    };
}

describe('ClipboardFlow image availability guard (diagnostic)', () => {
    let originalImage;
    let originalFetch;
    let alertSpy;

    beforeEach(() => {
        originalImage = global.Image;
        originalFetch = global.fetch;
        alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});

        global.fetch = vi.fn(async (url) => {
            if (String(url).includes('/api/v2/images/')) {
                return { ok: false, status: 404, statusText: 'Not Found' };
            }
            return { ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) };
        });
    });

    afterEach(() => {
        global.Image = originalImage;
        global.fetch = originalFetch;
        alertSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('не должен создавать image-объект при 404 загрузки изображения (PasteImage)', async () => {
        global.Image = class {
            constructor() {
                this.onload = null;
                this.onerror = null;
                this.naturalWidth = 0;
                this.naturalHeight = 0;
            }
            set src(_value) {
                if (this.onerror) this.onerror(new Event('error'));
            }
        };

        const eventBus = createEventBus();
        const createObject = vi.fn();
        const core = {
            eventBus,
            createObject,
            pixi: {
                app: { stage: {}, view: { clientWidth: 1200, clientHeight: 800 } },
                worldLayer: { x: 0, y: 0, scale: { x: 1 } },
            },
            state: { state: { objects: [] } },
            history: { executeCommand: vi.fn() },
            toolManager: { getActiveTool: vi.fn(() => null) },
            selectTool: null,
            _cursor: { x: 300, y: 220 },
        };

        setupClipboardFlow(core);
        eventBus.emit(Events.UI.PasteImage, {
            src: '/api/v2/images/img-404/download',
            name: 'broken.png',
            imageId: 'img-404',
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(createObject).not.toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalled();
    });
});

