import { describe, expect, it, vi } from 'vitest';
import { HandlesDomRenderer } from '../../src/ui/handles/HandlesDomRenderer.js';
import { ContextMenu } from '../../src/ui/ContextMenu.js';
import { Events } from '../../src/core/events/Events.js';
import { createIntegerGuard } from '../helpers/pixelPerfectIntegerGuard.js';

describe('Pixel-perfect integer contract: overlays and handles', () => {
    it('HandlesDomRenderer emits integer CSS geometry for bounds and controls', () => {
        const layer = document.createElement('div');
        const host = {
            layer,
            target: null,
            visible: false,
            _handlesSuppressed: false,
            eventBus: {
                emit: vi.fn((event, payload) => {
                    if (event === Events.Tool.GetObjectPixi) {
                        payload.pixiObject = { _mb: { type: 'shape' } };
                    }
                    if (event === Events.Tool.GetObjectRotation) {
                        payload.rotation = 15;
                    }
                }),
            },
            positioningService: {
                worldBoundsToCssRect: () => ({
                    left: 10.2,
                    top: 20.8,
                    width: 100.4,
                    height: 80.6,
                }),
            },
            _onHandleDown: vi.fn(),
            _onEdgeResizeDown: vi.fn(),
            _onRotateHandleDown: vi.fn(),
            update: vi.fn(),
        };

        const renderer = new HandlesDomRenderer(host, '<svg></svg>');
        renderer.showBounds({ x: 0, y: 0, width: 10, height: 10 }, 'obj-1');

        const box = layer.querySelector('.mb-handles-box');
        const rotate = box.querySelector('[data-handle="rotate"]');
        const guard = createIntegerGuard('HandlesDomRenderer');
        guard.collect('box.left', parseFloat(box.style.left));
        guard.collect('box.top', parseFloat(box.style.top));
        guard.collect('box.width', parseFloat(box.style.width));
        guard.collect('box.height', parseFloat(box.style.height));
        guard.collect('rotate.left', parseFloat(rotate.style.left));
        guard.collect('rotate.top', parseFloat(rotate.style.top));
        guard.assertNoFractions();
        expect(true).toBe(true);
    });

    it('ContextMenu snaps show coordinates to integer pixels', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const handlers = new Map();
        const eventBus = {
            on: vi.fn((event, cb) => handlers.set(event, cb)),
            emit: vi.fn(),
        };
        const menu = new ContextMenu(container, eventBus);

        menu.show(12.4, 31.6, 'canvas');

        const guard = createIntegerGuard('ContextMenu');
        guard.collect('lastX', menu.lastX);
        guard.collect('lastY', menu.lastY);
        guard.collect('style.left', parseFloat(menu.element.style.left));
        guard.collect('style.top', parseFloat(menu.element.style.top));
        guard.assertNoFractions();
        menu.destroy();
        expect(true).toBe(true);
    });
});
