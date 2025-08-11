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
        this.events.get(event)?.delete(callback);
    }

    emit(event, data) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    removeAllListeners() {
        this.events.clear();
    }
}