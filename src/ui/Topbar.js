/**
 * Горизонтальная верхняя панель (пока пустая)
 */
export class Topbar {
    constructor(container, eventBus, theme = 'light') {
        this.container = container;
        this.eventBus = eventBus;
        this.theme = theme;
        this.element = null;
        this.createTopbar();
    }

    createTopbar() {
        this.element = document.createElement('div');
        this.element.className = `moodboard-topbar moodboard-topbar--${this.theme}`;
        // Пока без пунктов
        this.container.appendChild(this.element);
    }

    setTheme(theme) {
        this.theme = theme;
        this.element.className = `moodboard-topbar moodboard-topbar--${theme}`;
    }

    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}


