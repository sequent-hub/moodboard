import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveManager } from '../../src/core/SaveManager.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        off: vi.fn(),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

describe('SaveManager payload contract stress diagnostics', () => {
    let manager;
    let eventBus;
    let originalXHR;
    let sendBeaconSpy;
    let fetchSpy;

    const boardData = {
        id: 'board-stress-1',
        boardData: {
            objects: [
                { id: 'img-1', type: 'image', src: '/api/v2/images/img-1/download', properties: { width: 200, height: 120 } }
            ],
            name: 'stress-board'
        },
        settings: { backgroundColor: '#ffffff' }
    };

    beforeEach(() => {
        vi.useFakeTimers();
        originalXHR = global.XMLHttpRequest;

        const meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        meta.setAttribute('content', 'csrf-stress-1');
        document.head.appendChild(meta);

        eventBus = createEventBus();
        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        manager = new SaveManager(eventBus, { autoSave: false });
        manager.options.autoSave = false;

        sendBeaconSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(navigator, 'sendBeacon', {
            configurable: true,
            writable: true,
            value: sendBeaconSpy,
        });

        fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: { ok: true } })
        });
        global.fetch = fetchSpy;
    });

    afterEach(() => {
        manager.options.autoSave = false;
        manager.hasUnsavedChanges = false;
        manager.destroy();
        document.querySelectorAll('meta[name="csrf-token"]').forEach((el) => el.remove());
        global.XMLHttpRequest = originalXHR;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('sync fallback сохраняет boardId и непустой boardData при 100 unload циклах', () => {
        sendBeaconSpy.mockReturnValue(false);
        const sentBodies = [];
        const xhr = {
            open: vi.fn(),
            setRequestHeader: vi.fn(),
            send: vi.fn((body) => sentBodies.push(body)),
        };
        global.XMLHttpRequest = vi.fn(() => xhr);

        for (let i = 0; i < 100; i++) {
            manager.hasUnsavedChanges = true;
            window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
        }

        expect(sentBodies).toHaveLength(100);
        for (const body of sentBodies) {
            const payload = JSON.parse(body);
            expect(payload.boardId).toBe('board-stress-1');
            expect(Array.isArray(payload.boardData?.boardData?.objects)).toBe(true);
            expect(payload.boardData.boardData.objects.length).toBeGreaterThan(0);
        }
    });

    it('sendBeacon канал вызывается и передает Blob payload', () => {
        manager.hasUnsavedChanges = true;
        window.dispatchEvent(new Event('beforeunload', { cancelable: true }));

        expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
        const [url, blob] = sendBeaconSpy.mock.calls[0];
        expect(url).toBe('/api/moodboard/save');
        expect(blob).toBeDefined();
        expect(manager.hasUnsavedChanges).toBe(false);
    });
});
