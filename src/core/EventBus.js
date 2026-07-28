export class EventBus {
    constructor() {
        this.events = new Map();
        this.emitObservers = new Set();
    }

    /**
     * Подписка на факт любого emit. Нужна рендер-циклу: событие ядра означает
     * возможное изменение сцены, а перечислять сотни имён событий по одному
     * хрупко — новое событие легко забыть и получить незакрашенный кадр.
     * @param {(event: string, data: unknown) => void} observer
     */
    addEmitObserver(observer) {
        if (typeof observer === 'function') {
            this.emitObservers.add(observer);
        }
    }

    removeEmitObserver(observer) {
        this.emitObservers.delete(observer);
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
        this.emitObservers.forEach((observer) => {
            try {
                observer(event, data);
            } catch (error) {
                console.error(`Error in emit observer for '${event}':`, error);
            }
        });

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