import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveStatus } from '../../src/ui/SaveStatus.js';
import { Events } from '../../src/core/events/Events.js';

function createEventBus() {
    const handlers = new Map();
    return {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        off: vi.fn(),
        emit: vi.fn((event, payload) => {
            const list = handlers.get(event) || [];
            for (const handler of list) handler(payload);
        }),
    };
}

describe('SaveStatus UI', () => {
    let container;
    let eventBus;
    let status;
    let consoleErrorSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        eventBus = createEventBus();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        status = new SaveStatus(container, eventBus, { hideDelay: 3000 });
    });

    afterEach(() => {
        status.destroy();
        consoleErrorSpy.mockRestore();
        container.remove();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('показывает начальный текст "Готов к работе"', () => {
        expect(container.querySelector('.save-text')?.textContent).toBe('Готов к работе');
    });

    it('обновляет текст для pending/saving/saved', () => {
        eventBus.emit(Events.Save.StatusChanged, { status: 'pending' });
        expect(container.querySelector('.save-text')?.textContent).toBe('Изменения...');

        eventBus.emit(Events.Save.StatusChanged, { status: 'saving' });
        expect(container.querySelector('.save-text')?.textContent).toBe('Сохранение...');

        eventBus.emit(Events.Save.StatusChanged, { status: 'saved' });
        expect(container.querySelector('.save-text')?.textContent).toBe('Сохранено');
    });

    it('для saved делает автоскрытие через hideDelay', () => {
        eventBus.emit(Events.Save.StatusChanged, { status: 'saved' });
        expect(status.element.style.opacity).toBe('1');

        vi.advanceTimersByTime(2999);
        expect(status.element.style.opacity).toBe('1');

        vi.advanceTimersByTime(1);
        expect(status.element.style.opacity).toBe('0.6');
    });

    it('для error показывает сообщение и скрывает через 6000мс', () => {
        eventBus.emit(Events.Save.StatusChanged, { status: 'error', message: 'net::ERR_CONNECTION_TIMED_OUT' });
        expect(container.querySelector('.save-text')?.textContent).toBe('net::ERR_CONNECTION_TIMED_OUT');
        expect(status.element.style.opacity).toBe('1');

        vi.advanceTimersByTime(5999);
        expect(status.element.style.opacity).toBe('1');

        vi.advanceTimersByTime(1);
        expect(status.element.style.opacity).toBe('0.6');
    });

    it('обрабатывает save:error событие и логирует ошибку', () => {
        eventBus.emit(Events.Save.Error, { error: 'Timeout' });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Ошибка сохранения:', 'Timeout');
    });
});
