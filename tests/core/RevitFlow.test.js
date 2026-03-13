import { describe, expect, it, vi } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

const showInModelMock = vi.fn().mockResolvedValue({ ok: true, port: 11210, attempts: [] });

vi.mock('../../src/services/RevitNavigationService.js', () => {
    return {
        RevitNavigationService: class {
            showInModel(...args) {
                return showInModelMock(...args);
            }
        }
    };
});

import { setupRevitFlow } from '../../src/core/flows/RevitFlow.js';

function createEventBus() {
    const listeners = new Map();
    return {
        on(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
        },
        emit(event, payload) {
            const set = listeners.get(event);
            if (!set) return;
            for (const handler of set) handler(payload);
        }
    };
}

describe('RevitFlow', () => {
    it('calls navigation service when view payload exists', async () => {
        const core = { eventBus: createEventBus() };
        setupRevitFlow(core);
        showInModelMock.mockClear();

        core.eventBus.emit(Events.UI.RevitShowInModel, {
            objectId: 'obj-1',
            view: '{"view":"x"}'
        });

        await vi.waitFor(() => expect(showInModelMock).toHaveBeenCalledTimes(1));
        expect(showInModelMock).toHaveBeenCalledWith('{"view":"x"}', { objectId: 'obj-1' });
    });

    it('skips navigation when view is empty', async () => {
        const core = { eventBus: createEventBus() };
        setupRevitFlow(core);
        showInModelMock.mockClear();

        core.eventBus.emit(Events.UI.RevitShowInModel, {
            objectId: 'obj-1',
            view: ''
        });

        await Promise.resolve();
        expect(showInModelMock).not.toHaveBeenCalled();
    });
});

