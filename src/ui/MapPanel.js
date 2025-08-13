export class MapPanel {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.popupEl = null;
        this.create();
        this.attach();
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = 'moodboard-mapbar';

        const btn = document.createElement('button');
        btn.className = 'moodboard-mapbar__button';
        btn.title = 'Карта';
        btn.textContent = '🗺️';
        btn.dataset.action = 'toggle-map';

        this.element.appendChild(btn);
        this.container.appendChild(this.element);
    }

    attach() {
        // Клик по кнопке — открыть/закрыть всплывающую панель
        this.element.addEventListener('click', (e) => {
            const btn = e.target.closest('.moodboard-mapbar__button');
            if (!btn) return;
            e.stopPropagation();
            if (this.popupEl) this.hidePopup();
            else this.showPopup();
            this.eventBus.emit('ui:map:toggle');
        });

        // Закрытие по клику вне панели
        document.addEventListener('mousedown', (e) => {
            if (!this.popupEl) return;
            if (this.element.contains(e.target)) return;
            this.hidePopup();
        });
    }

    destroy() {
        if (this.element) this.element.remove();
        this.element = null;
    }

    // Показ всплывающей панели (20% ширины/высоты экрана, над кнопкой)
    showPopup() {
        if (this.popupEl) return;
        const popup = document.createElement('div');
        popup.className = 'moodboard-mapbar__popup';
        // Здесь в будущем можно отрисовать мини‑карту
        this.element.appendChild(popup);
        this.popupEl = popup;
    }

    // Скрыть всплывающую панель
    hidePopup() {
        if (!this.popupEl) return;
        this.popupEl.remove();
        this.popupEl = null;
    }
}


