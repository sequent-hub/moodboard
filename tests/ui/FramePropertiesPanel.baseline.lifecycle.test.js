/**
 * Baseline-тесты жизненного цикла FramePropertiesPanel.
 * Проверяют: document click handler для палитры — добавление/удаление с одной и той же ссылкой, destroy очищает.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Events } from '../../src/core/events/Events.js';
import { FramePropertiesPanel } from '../../src/ui/FramePropertiesPanel.js';

function createMockEventBus() {
    const handlers = {};
    return {
        on: vi.fn((event, handler) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
        }),
        emit: vi.fn((event, data) => {
            if (handlers[event]) handlers[event].forEach((h) => h(data));
        }),
        off: vi.fn(),
        _handlers: handlers,
    };
}

function createMockCore(frameId = 'frame-1') {
    const objectsMap = new Map();
    objectsMap.set(frameId, {
        _mb: {
            type: 'frame',
            properties: { title: 'Test', type: 'a4' },
        },
    });
    return {
        selectTool: { selectedObjects: new Set([frameId]) },
        pixi: {
            objects: objectsMap,
            worldLayer: { scale: { x: 1 }, x: 0, y: 0 },
        },
        getObjectData: vi.fn((id) => {
            const pixi = objectsMap.get(id);
            if (!pixi?._mb) return null;
            return {
                backgroundColor: 0xffffff,
                properties: pixi._mb.properties,
            };
        }),
    };
}

function createMockContainer() {
    const el = document.createElement('div');
    el.getBoundingClientRect = vi.fn(() => ({
        x: 0, y: 0, width: 1200, height: 800,
        top: 0, left: 0, right: 1200, bottom: 800,
    }));
    return el;
}

describe('FramePropertiesPanel baseline: lifecycle contracts', () => {
    let eventBus;
    let container;
    let core;
    let panel;
    let addDocSpy;
    let removeDocSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        eventBus = createMockEventBus();
        container = createMockContainer();
        document.body.appendChild(container);
        core = createMockCore();
        addDocSpy = vi.spyOn(document, 'addEventListener');
        removeDocSpy = vi.spyOn(document, 'removeEventListener');
        panel = new FramePropertiesPanel(eventBus, container, core);
    });

    afterEach(() => {
        vi.useRealTimers();
        panel?.destroy?.();
        container?.remove?.();
        addDocSpy?.mockRestore?.();
        removeDocSpy?.mockRestore?.();
    });

    it('showFor displays panel for frame selection', () => {
        panel.showFor('frame-1');
        expect(panel.panel.style.display).toBe('flex');
        expect(panel.currentId).toBe('frame-1');
    });

    it('clicking color button shows palette and adds document click handler', () => {
        panel.showFor('frame-1');
        expect(panel.colorButton).toBeTruthy();
        panel.colorButton.click();
        vi.runAllTimers();

        const clickAdds = addDocSpy.mock.calls.filter(([name]) => name === 'click');
        expect(clickAdds.length).toBeGreaterThanOrEqual(1);
    });

    it('destroy removes document click handler with SAME reference as added (no leak)', () => {
        const handlerRef = [];
        let removeReceivedSameRef = false;
        const addCapture = vi.spyOn(document, 'addEventListener').mockImplementation((name, handler) => {
            if (name === 'click') handlerRef[0] = handler;
        });
        const removeCapture = vi.spyOn(document, 'removeEventListener').mockImplementation((name, handler) => {
            if (name === 'click') removeReceivedSameRef = handler === handlerRef[0];
        });

        try {
            panel.showFor('frame-1');
            panel.colorButton.click();
            vi.runAllTimers();

            expect(handlerRef[0]).toBeDefined();

            panel.destroy();

            expect(removeCapture).toHaveBeenCalledWith('click', expect.any(Function));
            expect(removeReceivedSameRef).toBe(true);
        } finally {
            addCapture.mockRestore();
            removeCapture.mockRestore();
        }
    });

    it('destroy removes panel from DOM and nullifies references', () => {
        panel.showFor('frame-1');
        expect(container.querySelector('.frame-properties-panel')).toBeInTheDocument();

        panel.destroy();

        expect(container.querySelector('.frame-properties-panel')).toBeNull();
        expect(panel.panel).toBeNull();
        expect(panel.currentId).toBeNull();
    });

    it('repeated destroy is safe', () => {
        panel.showFor('frame-1');
        expect(() => panel.destroy()).not.toThrow();
        expect(() => panel.destroy()).not.toThrow();
    });
});
