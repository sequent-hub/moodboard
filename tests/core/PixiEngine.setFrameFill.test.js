/**
 * Тесты PixiEngine.setFrameFill для фреймов.
 * Frame хранится как PIXI.Container (из FrameObject.getPixi()), а не Graphics.
 * setFrameFill должен вызывать meta.instance.setFill для frame, независимо от типа PIXI-объекта.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PixiEngine } from '../../src/core/PixiEngine.js';

describe('PixiEngine setFrameFill', () => {
    let pixi;
    let mockSetFill;

    beforeEach(() => {
        mockSetFill = vi.fn();
        const container = document.createElement('div');
        const eventBus = { on: vi.fn() };
        const options = { width: 100, height: 100 };
        pixi = new PixiEngine(container, eventBus, options);

        const frameLikeObject = {
            _mb: {
                type: 'frame',
                instance: { setFill: mockSetFill },
            },
        };
        pixi.objects.set('frame-1', frameLikeObject);
    });

    it('setFrameFill calls instance.setFill for frame object (Container with meta)', () => {
        pixi.setFrameFill('frame-1', 200, 150, 0xEEEEEE);
        expect(mockSetFill).toHaveBeenCalledWith(0xEEEEEE);
    });

    it('setFrameFill does nothing for non-frame type', () => {
        const noteSetFill = vi.fn();
        pixi.objects.set('note-1', {
            _mb: { type: 'note', instance: { setFill: noteSetFill } },
        });
        pixi.setFrameFill('note-1', 100, 100, 0xFFFFFF);
        expect(noteSetFill).not.toHaveBeenCalled();
    });

    it('setFrameFill does nothing when object not found', () => {
        pixi.setFrameFill('non-existent', 100, 100, 0xFFFFFF);
        expect(mockSetFill).not.toHaveBeenCalled();
    });
});
