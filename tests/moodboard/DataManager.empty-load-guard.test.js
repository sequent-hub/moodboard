import { describe, it, expect, vi } from 'vitest';
import { DataManager } from '../../src/moodboard/DataManager.js';

function createCoreMock(initialObjects = []) {
    const stateObjects = [...initialObjects];

    return {
        objects: stateObjects,
        state: {
            state: { objects: stateObjects },
        },
        eventBus: {
            emit: vi.fn(),
        },
        settingsApplier: null,
        deleteObject: vi.fn(),
        createObjectFromData: vi.fn(),
        pixi: {
            objects: new Map(),
            removeObject: vi.fn(),
        },
    };
}

describe('DataManager empty load guard', () => {
    it('blocks empty load when board already has objects', () => {
        const core = createCoreMock([{ id: 'n-1', type: 'note', properties: { content: 'keep' } }]);
        const manager = new DataManager(core);

        const clearSpy = vi.spyOn(manager, 'clearBoard');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        manager.loadData({ objects: [] });

        expect(clearSpy).not.toHaveBeenCalled();
        expect(core.createObjectFromData).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('allows empty load when explicitly marked with meta.allowEmptyLoad', () => {
        const core = createCoreMock([{ id: 'n-1', type: 'note', properties: { content: 'keep' } }]);
        const manager = new DataManager(core);

        const clearSpy = vi.spyOn(manager, 'clearBoard').mockReturnValue(1);

        manager.loadData({
            objects: [],
            meta: { allowEmptyLoad: true },
        });

        expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps normal behavior for non-empty incoming snapshots', () => {
        const core = createCoreMock([{ id: 'n-1', type: 'note' }]);
        const manager = new DataManager(core);

        const clearSpy = vi.spyOn(manager, 'clearBoard').mockReturnValue(1);
        const incoming = { id: 'n-2', type: 'text', properties: { content: 'loaded' } };

        manager.loadData({ objects: [incoming] });

        expect(clearSpy).toHaveBeenCalledTimes(1);
        expect(core.createObjectFromData).toHaveBeenCalledWith(incoming);
    });
});
