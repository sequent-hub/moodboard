import { vi } from 'vitest';
import { KeyboardManager } from '../../src/core/KeyboardManager.js';

export function createKeyboardTestEventBus() {
    const handlers = new Map();

    const on = vi.fn((eventName, handler) => {
        if (!handlers.has(eventName)) {
            handlers.set(eventName, new Set());
        }
        handlers.get(eventName).add(handler);
    });

    const off = vi.fn((eventName, handler) => {
        const set = handlers.get(eventName);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) {
            handlers.delete(eventName);
        }
    });

    const emit = vi.fn((eventName, payload) => {
        const set = handlers.get(eventName);
        if (!set) return;
        for (const handler of set) {
            handler(payload);
        }
    });

    return { on, off, emit };
}

export function createKeyboardManagerContext({ core = null } = {}) {
    const eventBus = createKeyboardTestEventBus();
    const targetElement = document.createElement('div');
    targetElement.setAttribute('data-testid', 'keyboard-target');
    document.body.appendChild(targetElement);

    const manager = new KeyboardManager(eventBus, targetElement, core);

    const cleanup = () => {
        manager.destroy();
        document.body.innerHTML = '';
    };

    return {
        eventBus,
        targetElement,
        manager,
        cleanup,
    };
}

export function dispatchKeyboardEvent(target, type, key, init = {}) {
    const event = new KeyboardEvent(type, {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
    });

    const dispatchResult = target.dispatchEvent(event);
    return { event, dispatchResult };
}

export function collectEventPayloads(eventBus, eventName) {
    return eventBus.emit.mock.calls
        .filter(([name]) => name === eventName)
        .map(([, payload]) => payload);
}

export function collectEventCalls(eventBus, eventName) {
    return eventBus.emit.mock.calls.filter(([name]) => name === eventName);
}
