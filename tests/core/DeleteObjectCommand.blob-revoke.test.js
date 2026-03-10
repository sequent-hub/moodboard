import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteObjectCommand } from '../../src/core/commands/DeleteObjectCommand.js';
import { Events } from '../../src/core/events/Events.js';

// jsdom может не иметь URL.revokeObjectURL — polyfill для тестов
if (typeof globalThis.URL !== 'undefined' && typeof globalThis.URL.revokeObjectURL !== 'function') {
    globalThis.URL.revokeObjectURL = function () {};
}

describe('DeleteObjectCommand: blob URL revoke', () => {
    let core;
    let revokeSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        revokeSpy = vi.fn();
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeSpy);

        core = {
            state: {
                getObjects: vi.fn(() => core._objects),
                removeObject: vi.fn((id) => {
                    core._objects = core._objects.filter((o) => o.id !== id);
                })
            },
            pixi: {
                removeObject: vi.fn()
            },
            eventBus: {
                emit: vi.fn()
            },
            _objects: []
        };
    });

    it('revokes blob URL when deleting image with properties.src', async () => {
        const blobUrl = 'blob:http://localhost/uuid-123';
        const imageObj = {
            id: 'img-1',
            type: 'image',
            position: { x: 100, y: 150 },
            width: 180,
            height: 120,
            properties: { src: blobUrl, name: 'fallback.png' }
        };
        core._objects = [imageObj];

        const cmd = new DeleteObjectCommand(core, imageObj.id);
        await cmd.execute();

        expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
        expect(core.state.removeObject).toHaveBeenCalledWith(imageObj.id);
        expect(core.pixi.removeObject).toHaveBeenCalledWith(imageObj.id);
    });

    it('revokes blob URL when src is at object top level', async () => {
        const blobUrl = 'blob:http://localhost/uuid-456';
        const imageObj = {
            id: 'img-2',
            type: 'image',
            src: blobUrl,
            position: { x: 50, y: 50 },
            width: 100,
            height: 80,
            properties: {}
        };
        core._objects = [imageObj];

        const cmd = new DeleteObjectCommand(core, imageObj.id);
        await cmd.execute();

        expect(revokeSpy).toHaveBeenCalledWith(blobUrl);
    });

    it('does not revoke when src is not blob URL', async () => {
        const imageObj = {
            id: 'img-3',
            type: 'image',
            position: { x: 0, y: 0 },
            width: 100,
            height: 100,
            properties: { src: 'https://example.com/image.png' }
        };
        core._objects = [imageObj];

        const cmd = new DeleteObjectCommand(core, imageObj.id);
        await cmd.execute();

        expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('does not revoke for non-image types', async () => {
        const noteObj = {
            id: 'note-1',
            type: 'note',
            position: { x: 10, y: 20 },
            width: 200,
            height: 150,
            properties: { content: 'test' }
        };
        core._objects = [noteObj];

        const cmd = new DeleteObjectCommand(core, noteObj.id);
        await cmd.execute();

        expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('emits Object.Deleted event', async () => {
        const imageObj = {
            id: 'img-evt',
            type: 'image',
            position: { x: 0, y: 0 },
            width: 100,
            height: 100,
            properties: { src: 'blob:xxx' }
        };
        core._objects = [imageObj];

        const cmd = new DeleteObjectCommand(core, imageObj.id);
        await cmd.execute();

        expect(core.eventBus.emit).toHaveBeenCalledWith(Events.Object.Deleted, {
            objectId: imageObj.id
        });
    });
});
