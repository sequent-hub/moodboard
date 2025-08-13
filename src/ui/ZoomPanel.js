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
        label.textContent = '100%';
        const caret = document.createElement('span');
        caret.className = 'moodboard-zoombar__label-caret';
        caret.textContent = '▾';
        label.appendChild(caret);
        this.labelEl = label;

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
            if (action === 'zoom-in') this.eventBus.emit('ui:zoom:in');
            else if (action === 'zoom-out') this.eventBus.emit('ui:zoom:out');
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

        this.eventBus.on('ui:zoom:percent', ({ percentage }) => {
            if (this.labelEl) this.labelEl.textContent = `${percentage}%`;
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

        addItem('По размеру экрана', () => this.eventBus.emit('ui:zoom:fit'));
        addItem('К выделению', () => this.eventBus.emit('ui:zoom:selection'));
        addItem('100%', () => this.eventBus.emit('ui:zoom:reset'));

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


