import { describe, it, expect, vi } from 'vitest';
import { HtmlHandlesLayer } from '../../src/ui/HtmlHandlesLayer.js';
import { Events } from '../../src/core/events/Events.js';

function createMockEventBus() {
    return {
        emit: vi.fn((event, data) => {
            if (event === Events.Tool.GetObjectRotation && data) {
                data.rotation = 0;
            }
        }),
        on: vi.fn(),
        off: vi.fn(),
    };
}

describe('HtmlHandlesLayer rotation diagnostics', () => {
    it('finishes rotate mouseup even if source event currentTarget is unavailable', () => {
        const container = document.createElement('div');
        const eventBus = createMockEventBus();
        const core = {};
        const layer = new HtmlHandlesLayer(container, eventBus, core);

        const box = document.createElement('div');
        box.style.left = '100px';
        box.style.top = '100px';
        box.style.width = '200px';
        box.style.height = '100px';

        const handle = document.createElement('div');
        handle.dataset.id = 'note-1';
        handle.style.cursor = 'grab';

        const sourceEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            currentTarget: handle,
            clientX: 210,
            clientY: 160,
        };

        let mouseupHandler = null;
        const addSpy = vi.spyOn(document, 'addEventListener').mockImplementation((type, handler) => {
            if (type === 'mouseup') mouseupHandler = handler;
        });
        const removeSpy = vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});

        layer._onRotateHandleDown(sourceEvent, box);
        expect(typeof mouseupHandler).toBe('function');

        // Imitate the event lifecycle after the original handler has completed.
        sourceEvent.currentTarget = null;

        expect(() => {
            mouseupHandler({ clientX: 220, clientY: 170 });
        }).not.toThrow();

        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Tool.RotateEnd,
            expect.objectContaining({ object: 'note-1' })
        );

        addSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
