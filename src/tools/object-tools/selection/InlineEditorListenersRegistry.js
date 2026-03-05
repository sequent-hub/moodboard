export function registerEditorListeners(eventBus, listeners) {
    listeners.forEach(([eventName, handler]) => {
        eventBus.on(eventName, handler);
    });
    return listeners;
}

export function unregisterEditorListeners(eventBus, listeners) {
    listeners.forEach(([eventName, handler]) => {
        try {
            eventBus.off(eventName, handler);
        } catch (_) {}
    });
}
