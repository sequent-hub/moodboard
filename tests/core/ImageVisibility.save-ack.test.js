import { describe, it, expect, vi } from 'vitest';
import { CoreMoodBoard } from '../../src/core/index.js';
import { setupSaveFlow } from '../../src/core/flows/SaveFlow.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

function createCoreLikeObject() {
    const objects = [];
    const pixiObjects = new Map();
    const core = {
        state: {
            state: { objects },
            addObject: vi.fn((obj) => { objects.push(obj); }),
        },
        pixi: {
            objects: pixiObjects,
            createObject: vi.fn((obj) => { pixiObjects.set(obj.id, { visible: true }); }),
            findObjectByPosition: vi.fn(() => null),
        },
        gridSnapResolver: {
            snapWorldTopLeft: vi.fn((position) => position),
        },
        history: {
            executeCommand: vi.fn((command) => command.execute()),
        },
        eventBus: {
            emit: vi.fn(),
        },
        _pendingPersistAckVisibilityIds: new Set(),
    };
    core._isPersistAckRequiredType = CoreMoodBoard.prototype._isPersistAckRequiredType.bind(core);
    core._setObjectVisibility = CoreMoodBoard.prototype._setObjectVisibility.bind(core);
    core.revealPendingObjectsAfterSave = CoreMoodBoard.prototype.revealPendingObjectsAfterSave.bind(core);
    return core;
}

describe('Image visibility save ack contract', () => {
    it('image object is hidden until save ack and shown after reveal', () => {
        const core = createCoreLikeObject();

        const created = CoreMoodBoard.prototype.createObject.call(
            core,
            'image',
            { x: 100, y: 200 },
            { src: '/api/v2/images/img-1/download', width: 300, height: 150 },
            { imageId: 'img-1' }
        );

        expect(core.pixi.objects.get(created.id).visible).toBe(false);
        expect(core._pendingPersistAckVisibilityIds.has(created.id)).toBe(true);

        core.revealPendingObjectsAfterSave();

        expect(core.pixi.objects.get(created.id).visible).toBe(true);
        expect(core._pendingPersistAckVisibilityIds.size).toBe(0);
    });

    it('non-image object stays visible and is not put into pending set', () => {
        const core = createCoreLikeObject();

        const created = CoreMoodBoard.prototype.createObject.call(
            core,
            'note',
            { x: 10, y: 20 },
            { content: 'hello', width: 200, height: 200 },
            {}
        );

        expect(core.pixi.objects.get(created.id).visible).toBe(true);
        expect(core._pendingPersistAckVisibilityIds.size).toBe(0);
    });

    it('file object is hidden until save ack and shown after reveal', () => {
        const core = createCoreLikeObject();

        const created = CoreMoodBoard.prototype.createObject.call(
            core,
            'file',
            { x: 40, y: 80 },
            { fileName: 'doc.pdf', width: 120, height: 140, url: '/api/v2/files/f-1/download' },
            { fileId: 'f-1' }
        );

        expect(core.pixi.objects.get(created.id).visible).toBe(false);
        expect(core._pendingPersistAckVisibilityIds.has(created.id)).toBe(true);

        core.revealPendingObjectsAfterSave();

        expect(core.pixi.objects.get(created.id).visible).toBe(true);
        expect(core._pendingPersistAckVisibilityIds.size).toBe(0);
    });

    it('save:success in SaveFlow triggers revealPendingObjectsAfterSave', () => {
        const eventBus = createEventBus();
        const core = {
            eventBus,
            state: { state: {} },
            revealPendingObjectsAfterSave: vi.fn(),
        };

        setupSaveFlow(core);
        eventBus.emit(Events.Save.Success, {});

        expect(core.revealPendingObjectsAfterSave).toHaveBeenCalledTimes(1);
    });
});
