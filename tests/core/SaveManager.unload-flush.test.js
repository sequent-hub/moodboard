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

describe('SaveManager - unload/pagehide/visibilitychange flush', () => {
    let manager;
    let eventBus;
    let setIntervalSpy;
    let sendBeaconSpy;
    let originalXHR;

    const boardData = {
        id: 'board-unload-1',
        objects: [{ id: 'img-1', type: 'image', imageId: 'img-1' }],
        settings: { backgroundColor: '#ffffff' },
    };

    beforeEach(() => {
        vi.useFakeTimers();
        setIntervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => 1);

        const meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        meta.setAttribute('content', 'csrf-token-1');
        document.head.appendChild(meta);

        sendBeaconSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(navigator, 'sendBeacon', {
            configurable: true,
            writable: true,
            value: sendBeaconSpy,
        });

        originalXHR = global.XMLHttpRequest;

        eventBus = createEventBus();
        eventBus.on(Events.Save.GetBoardData, (request) => {
            request.data = boardData;
        });

        manager = new SaveManager(eventBus);
        manager.options.autoSave = false;
    });

    afterEach(() => {
        manager.options.autoSave = false;
        manager.hasUnsavedChanges = false;
        manager.destroy();
        document.querySelectorAll('meta[name="csrf-token"]').forEach((el) => el.remove());
        global.XMLHttpRequest = originalXHR;
        setIntervalSpy.mockRestore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('beforeunload вызывает sendBeacon при unsaved changes', () => {
        manager.hasUnsavedChanges = true;
        const event = new Event('beforeunload', { cancelable: true });

        window.dispatchEvent(event);

        expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
        const [url, payload] = sendBeaconSpy.mock.calls[0];
        expect(url).toBe('/api/moodboard/save');
        expect(payload).toBeInstanceOf(Blob);
        expect(manager.hasUnsavedChanges).toBe(false);
    });

    it('если sendBeacon вернул false, использует sync XHR fallback', () => {
        sendBeaconSpy.mockReturnValue(false);
        const xhr = {
            open: vi.fn(),
            setRequestHeader: vi.fn(),
            send: vi.fn(),
        };
        global.XMLHttpRequest = vi.fn(() => xhr);

        manager.hasUnsavedChanges = true;
        window.dispatchEvent(new Event('beforeunload', { cancelable: true }));

        expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
        expect(global.XMLHttpRequest).toHaveBeenCalledTimes(1);
        expect(xhr.open).toHaveBeenCalledWith('POST', '/api/moodboard/save', false);
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('X-CSRF-TOKEN', 'csrf-token-1');
        expect(xhr.send).toHaveBeenCalledTimes(1);

        const sentPayload = JSON.parse(xhr.send.mock.calls[0][0]);
        expect(sentPayload.boardData.id).toBe('board-unload-1');
    });

    it('pagehide триггерит flush при unsaved changes', () => {
        manager.hasUnsavedChanges = true;
        window.dispatchEvent(new Event('pagehide'));
        expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    });

    it('visibilitychange(hidden) триггерит flush, visible не триггерит', () => {
        manager.hasUnsavedChanges = true;

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(sendBeaconSpy).toHaveBeenCalledTimes(0);

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
        expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    });
});
