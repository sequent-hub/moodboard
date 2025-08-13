export class ZoomPanel {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.labelEl = null;
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

        this.eventBus.on('ui:zoom:percent', ({ percentage }) => {
            if (this.labelEl) this.labelEl.textContent = `${percentage}%`;
        });
    }

    destroy() {
        if (this.element) this.element.remove();
        this.element = null;
        this.labelEl = null;
    }
}


