import { describe, it, expect, vi } from 'vitest';
import { ContextMenu } from '../../src/ui/ContextMenu.js';

function createMockEventBus() {
    return {
        on: vi.fn(),
        emit: vi.fn(),
        off: vi.fn(),
    };
}

describe('ContextMenu diagnostics', () => {
    it('hide does not throw when element is null', () => {
        const container = document.createElement('div');
        const eventBus = createMockEventBus();
        const menu = new ContextMenu(container, eventBus);

        menu.isVisible = true;
        menu.element = null;

        expect(() => menu.hide()).not.toThrow();
        expect(menu.isVisible).toBe(false);
    });
});
