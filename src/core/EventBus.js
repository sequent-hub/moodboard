export class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
    }

    off(event, callback) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.delete(callback);

            // Если callback'ов больше нет, удаляем событие из Map
            if (callbacks.size === 0) {
                this.events.delete(event);
            }
        }
    }

    emit(event, data) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    // Логируем ошибку, но продолжаем выполнение
                    console.error(`Error in event callback for '${event}':`, error);
                }
            });
        }
    }

    removeAllListeners() {
        this.events.clear();
    }
}