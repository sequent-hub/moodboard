import { Events } from '../events/Events.js';

export class KeyboardEventRouter {
    constructor(eventBus, shortcuts, isInputElementGuard) {
        this.eventBus = eventBus;
        this.shortcuts = shortcuts;
        this.isInputElementGuard = isInputElementGuard;
    }

    handleKeyDown(event) {
        if (this.isInputElementGuard(event.target)) {
            return;
        }

        const combination = this.eventToShortcut(event);
        const handlers = this.shortcuts.get(combination);

        if (handlers && handlers.length > 0) {
            handlers.forEach(({ handler, preventDefault, stopPropagation }) => {
                if (preventDefault) event.preventDefault();
                if (stopPropagation) event.stopPropagation();

                handler(event);
            });
        }
    }

    handleKeyUp(event) {
        const combination = this.eventToShortcut(event, 'keyup');

        this.eventBus.emit(Events.Keyboard.KeyUp, {
            key: event.key,
            code: event.code,
            combination,
            originalEvent: event
        });
    }

    normalizeShortcut(combination) {
        return combination
            .toLowerCase()
            .split('+')
            .map(key => key.trim())
            .sort((a, b) => {
                const order = ['ctrl', 'alt', 'shift', 'meta'];
                const aIndex = order.indexOf(a);
                const bIndex = order.indexOf(b);

                if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                }
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
            })
            .join('+');
    }

    eventToShortcut(event, eventType = 'keydown') {
        const parts = [];

        if (event.ctrlKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        if (event.metaKey) parts.push('meta');

        let key = event.key.toLowerCase();

        const specialKeys = {
            ' ': 'space',
            'enter': 'enter',
            'escape': 'escape',
            'backspace': 'backspace',
            'delete': 'delete',
            'tab': 'tab',
            'arrowup': 'arrowup',
            'arrowdown': 'arrowdown',
            'arrowleft': 'arrowleft',
            'arrowright': 'arrowright'
        };

        if (specialKeys[key]) {
            key = specialKeys[key];
        }

        if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
            parts.push(key);
        }

        return parts.join('+');
    }
}
