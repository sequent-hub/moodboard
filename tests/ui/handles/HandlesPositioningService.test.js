import { describe, expect, it, vi } from 'vitest';
import { HandlesPositioningService } from '../../../src/ui/handles/HandlesPositioningService.js';
import { Events } from '../../../src/core/events/Events.js';

function createIdentityWorld() {
    return {
        x: 0,
        y: 0,
        scale: { x: 1, y: 1 },
        toGlobal(point) {
            return { x: point.x, y: point.y };
        },
        toLocal(point) {
            return { x: point.x, y: point.y };
        },
    };
}

function createHost({ positions = {}, sizes = {}, rotations = {}, pixiBounds = {} } = {}) {
    const world = createIdentityWorld();
    const eventBus = {
        emit: vi.fn((event, payload) => {
            if (event === Events.Tool.GetObjectPosition) {
                payload.position = positions[payload.objectId] || null;
            }
            if (event === Events.Tool.GetObjectSize) {
                payload.size = sizes[payload.objectId] || null;
            }
            if (event === Events.Tool.GetObjectRotation) {
                payload.rotation = rotations[payload.objectId] || 0;
            }
        }),
    };

    const objects = new Map(
        Object.entries(pixiBounds).map(([id, bounds]) => [
            id,
            {
                getBounds() {
                    return { ...bounds };
                },
            },
        ])
    );

    return {
        container: {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
        },
        eventBus,
        core: {
            pixi: {
                app: {
                    view: {
                        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
                    },
                    stage: world,
                    renderer: { resolution: 1 },
                },
                worldLayer: world,
                objects,
            },
        },
    };
}

describe('HandlesPositioningService.getGroupSelectionWorldBounds()', () => {
    it('prefers state geometry over pixi bounds for group handles', () => {
        const host = createHost({
            positions: {
                frame: { x: 100, y: 100 },
                emoji: { x: 320, y: 120 },
            },
            sizes: {
                frame: { width: 160, height: 120 },
                emoji: { width: 96, height: 96 },
            },
            rotations: {
                frame: 0,
                emoji: 0,
            },
            pixiBounds: {
                frame: { x: 98, y: 98, width: 164, height: 124 },
                emoji: { x: 330, y: 120, width: 76, height: 96 },
            },
        });
        const service = new HandlesPositioningService(host);

        const bounds = service.getGroupSelectionWorldBounds(['frame', 'emoji']);

        expect(bounds).toEqual({
            x: 100,
            y: 100,
            width: 316,
            height: 120,
        });
    });

    it('includes object rotation when deriving group bounds from state', () => {
        const host = createHost({
            positions: {
                a: { x: 10, y: 20 },
                b: { x: 120, y: 40 },
            },
            sizes: {
                a: { width: 100, height: 60 },
                b: { width: 80, height: 50 },
            },
            rotations: {
                a: 30,
                b: 0,
            },
        });
        const service = new HandlesPositioningService(host);

        const bounds = service.getGroupSelectionWorldBounds(['a', 'b']);

        expect(bounds.x).toBeCloseTo(1.6987, 3);
        expect(bounds.y).toBeCloseTo(-0.9808, 3);
        expect(bounds.width).toBeCloseTo(198.3013, 3);
        expect(bounds.height).toBeCloseTo(101.9615, 3);
    });

    it('falls back to pixi bounds when state geometry is unavailable', () => {
        const host = createHost({
            pixiBounds: {
                loose: { x: 50, y: 60, width: 140, height: 90 },
            },
        });
        const service = new HandlesPositioningService(host);

        const bounds = service.getGroupSelectionWorldBounds(['loose']);

        expect(bounds).toEqual({
            x: 50,
            y: 60,
            width: 140,
            height: 90,
        });
    });
});
