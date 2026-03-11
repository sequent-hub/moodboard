import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FrameService } from '../../src/services/FrameService.js';
import { Events } from '../../src/core/events/Events.js';

function createMockEventBus() {
    const handlers = {};
    return {
        on: vi.fn((event, handler) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        }),
        off: vi.fn((event, handler) => {
            if (!handlers[event]) return;
            if (handler) handlers[event] = handlers[event].filter((h) => h !== handler);
            else handlers[event] = [];
        }),
        emit: vi.fn((event, payload) => {
            const list = handlers[event] || [];
            list.forEach((h) => h(payload));
        }),
        _handlers: handlers
    };
}

function createPixiObject({ x, y, width, height }) {
    return {
        x,
        y,
        width,
        height,
        zIndex: 0,
        getBounds() {
            return {
                x: this.x - this.width / 2,
                y: this.y - this.height / 2,
                width: this.width,
                height: this.height
            };
        }
    };
}

describe('FrameService text sync during frame drag', () => {
    let eventBus;
    let state;
    let pixi;
    let frameService;

    beforeEach(() => {
        eventBus = createMockEventBus();

        state = {
            state: {
                objects: [
                    {
                        id: 'frame-1',
                        type: 'frame',
                        position: { x: 0, y: 0 },
                        width: 200,
                        height: 200,
                        properties: { isArbitrary: true }
                    },
                    {
                        id: 'text-1',
                        type: 'text',
                        position: { x: 40, y: 30 },
                        width: 100,
                        height: 40,
                        properties: { frameId: 'frame-1' }
                    }
                ]
            },
            markDirty: vi.fn()
        };

        const framePixi = createPixiObject({
            x: 100,
            y: 100,
            width: 200,
            height: 200
        });

        const textPixi = createPixiObject({
            x: 90,
            y: 50,
            width: 100,
            height: 40
        });

        pixi = {
            app: { stage: { sortableChildren: true } },
            objects: new Map([
                ['frame-1', framePixi],
                ['text-1', textPixi]
            ]),
            setFrameFill: vi.fn()
        };

        frameService = new FrameService(eventBus, pixi, state);
        frameService.attach();
    });

    it('emits transform update for attached text while dragging frame', () => {
        eventBus.emit(Events.Tool.DragStart, { object: 'frame-1' });

        const framePixi = pixi.objects.get('frame-1');
        framePixi.x = 130;
        framePixi.y = 140;
        eventBus.emit(Events.Tool.DragUpdate, { object: 'frame-1' });

        expect(state.state.objects[1].position).toEqual({ x: 70, y: 70 });
        expect(eventBus.emit).toHaveBeenCalledWith(
            Events.Object.TransformUpdated,
            expect.objectContaining({
                objectId: 'text-1',
                type: 'position',
                position: { x: 70, y: 70 }
            })
        );
    });

    it('after detach, DragStart/DragUpdate do not trigger frame logic', () => {
        frameService.detach();

        eventBus.emit(Events.Tool.DragStart, { object: 'frame-1' });
        const framePixi = pixi.objects.get('frame-1');
        framePixi.x = 200;
        framePixi.y = 200;
        eventBus.emit(Events.Tool.DragUpdate, { object: 'frame-1' });

        expect(state.state.objects[1].position).toEqual({ x: 40, y: 30 });
        expect(pixi.setFrameFill).not.toHaveBeenCalled();
    });

    it('when dragging non-frame over frame, setFrameFill is called for hover highlight', () => {
        vi.useFakeTimers();
        state.state.objects = [
            { id: 'frame-1', type: 'frame', position: { x: 0, y: 0 }, width: 200, height: 200 },
            { id: 'note-1', type: 'note', position: { x: 50, y: 50 }, width: 80, height: 60 }
        ];
        pixi.objects.set('frame-1', createPixiObject({ x: 100, y: 100, width: 200, height: 200 }));
        pixi.objects.set('note-1', createPixiObject({ x: 90, y: 80, width: 80, height: 60 }));

        eventBus.emit(Events.Tool.DragStart, { object: 'note-1' });
        eventBus.emit(Events.Tool.DragUpdate, { object: 'note-1' });

        vi.runAllTimers();

        expect(pixi.setFrameFill).toHaveBeenCalledWith('frame-1', 200, 200, 0xEEEEEE);
        vi.useRealTimers();
    });
});

