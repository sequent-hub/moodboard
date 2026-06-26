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

describe('SaveManager - no timer/unload autosave', () => {
    let manager;
    let eventBus;
    let addWindowListenerSpy;
    let addDocumentListenerSpy;

    beforeEach(() => {
        addWindowListenerSpy = vi.spyOn(window, 'addEventListener');
        addDocumentListenerSpy = vi.spyOn(document, 'addEventListener');
        eventBus = createEventBus();
        manager = new SaveManager(eventBus);
    });

    afterEach(() => {
        manager.options.autoSave = false;
        manager.hasUnsavedChanges = false;
        manager.destroy();
        addWindowListenerSpy.mockRestore();
        addDocumentListenerSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('регистрирует pagehide/visibilitychange для flush при выходе, но не beforeunload', () => {
        const windowEvents = addWindowListenerSpy.mock.calls.map((args) => args[0]);
        const documentEvents = addDocumentListenerSpy.mock.calls.map((args) => args[0]);

        // beforeunload не используется: async fetch на нём не успевает, flush идёт через sendBeacon.
        expect(windowEvents).not.toContain('beforeunload');
        // Flush последней правки при закрытии вкладки/сворачивании.
        expect(windowEvents).toContain('pagehide');
        expect(documentEvents).toContain('visibilitychange');
    });

    it('не подписывается на таймерное периодическое сохранение', () => {
        expect(manager.periodicSaveTimer).toBeUndefined();
    });
});
