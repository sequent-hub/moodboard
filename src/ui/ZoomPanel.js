import { Events } from '../core/events/Events.js';

export class ZoomPanel {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.labelEl = null;
        this.menuEl = null;
        this.create();
        this.attach();
    }

    create() {
        this.element = document.createElement('div');
        this.element.className = 'moodboard-zoombar';

        const zoomOutBtn = document.createElement('button');
        zoomOutBtn.className = 'moodboard-zoombar__button';
        zoomOutBtn.title = 'Уменьшить масштаб';
        zoomOutBtn.textContent = '−';
        zoomOutBtn.dataset.action = 'zoom-out';

        const label = document.createElement('span');
        label.className = 'moodboard-zoombar__label';
        const value = document.createElement('span');
        value.className = 'moodboard-zoombar__label-value';
        value.textContent = '100%';
        const caret = document.createElement('span');
        caret.className = 'moodboard-zoombar__label-caret';
        caret.textContent = '▾';
        label.appendChild(value);
        label.appendChild(caret);
        this.labelEl = label;
        this.valueEl = value;

        const zoomInBtn = document.createElement('button');
        zoomInBtn.className = 'moodboard-zoombar__button';
        zoomInBtn.title = 'Увеличить масштаб';
        zoomInBtn.textContent = '+';
        zoomInBtn.dataset.action = 'zoom-in';

        this.element.appendChild(zoomOutBtn);
        this.element.appendChild(label);
        this.element.appendChild(zoomInBtn);

        this.container.appendChild(this.element);
    }

    attach() {
        this.element.addEventListener('click', (e) => {
            const btn = e.target.closest('.moodboard-zoombar__button');
            if (!btn) return;
            const action = btn.dataset.action;
            if (action === 'zoom-in') this.eventBus.emit(Events.UI.ZoomIn);
            else if (action === 'zoom-out') this.eventBus.emit(Events.UI.ZoomOut);
        });

        // Выпадающее меню по клику на процент
        this.labelEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.menuEl) {
                this.hideMenu();
            } else {
                this.showMenu();
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (!this.menuEl) return;
            if (this.element.contains(e.target)) return;
            this.hideMenu();
        });

        this.eventBus.on(Events.UI.ZoomPercent, ({ percentage }) => {
            if (this.valueEl) this.valueEl.textContent = `${percentage}%`;
        });
    }

    showMenu() {
        this.menuEl = document.createElement('div');
        this.menuEl.className = 'moodboard-zoombar__menu';
        this.menuEl.innerHTML = '';

        const addItem = (label, onClick) => {
            const item = document.createElement('div');
            item.className = 'moodboard-zoombar__menu-item';
            item.textContent = label;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideMenu();
                onClick();
            });
            this.menuEl.appendChild(item);
        };

        addItem('По размеру экрана', () => this.eventBus.emit(Events.UI.ZoomFit));
        addItem('К выделению', () => this.eventBus.emit(Events.UI.ZoomSelection));
        addItem('100%', () => this.eventBus.emit(Events.UI.ZoomReset));

        this.element.appendChild(this.menuEl);
    }

    hideMenu() {
        if (this.menuEl) this.menuEl.remove();
        this.menuEl = null;
    }

    destroy() {
        if (this.element) this.element.remove();
        this.element = null;
        this.labelEl = null;
    }
}


