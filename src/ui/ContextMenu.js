export class ContextMenu {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.isVisible = false;

        this.createElement();
        this.attachEvents();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'moodboard-contextmenu';
        this.element.style.position = 'absolute';
        this.element.style.minWidth = '160px';
        this.element.style.background = '#ffffff';
        this.element.style.border = '1px solid rgba(0,0,0,0.1)';
        this.element.style.borderRadius = '8px';
        this.element.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        this.element.style.padding = '8px 0';
        this.element.style.zIndex = '2000';
        this.element.style.display = 'none';
        this.element.style.userSelect = 'none';
        this.element.style.pointerEvents = 'auto';
        this.container.appendChild(this.element);

        // Пустое содержимое на сейчас
        this.element.innerHTML = '<div style="padding:8px 12px; color:#888;">(пусто)</div>';
    }

    attachEvents() {
        // Показ по событию из ядра
        this.eventBus.on('ui:contextmenu:show', ({ x, y, context, targetId }) => {
            this.show(x, y, context, targetId);
        });

        // Скрывать при клике вне меню или по Esc
        document.addEventListener('mousedown', (e) => {
            if (!this.isVisible) return;
            if (!this.element.contains(e.target)) {
                this.hide();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            if (e.key === 'Escape') this.hide();
        });
        window.addEventListener('resize', () => this.hide());
        window.addEventListener('scroll', () => this.hide(), true);
    }

    show(x, y, context = 'canvas', targetId = null) {
        this.renderItems(context, targetId);
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.display = 'block';
        this.isVisible = true;
        this.ensureInViewport();
    }

    hide() {
        this.element.style.display = 'none';
        this.isVisible = false;
    }

    ensureInViewport() {
        const rect = this.element.getBoundingClientRect();
        let dx = 0, dy = 0;
        if (rect.right > window.innerWidth) dx = window.innerWidth - rect.right - 8;
        if (rect.bottom > window.innerHeight) dy = window.innerHeight - rect.bottom - 8;
        if (dx !== 0 || dy !== 0) {
            const left = parseInt(this.element.style.left || '0', 10) + dx;
            const top = parseInt(this.element.style.top || '0', 10) + dy;
            this.element.style.left = `${left}px`;
            this.element.style.top = `${top}px`;
        }
    }

    renderItems(context, targetId) {
        // Пока только для объекта: Копировать / Вставить
        if (context === 'object') {
            this.element.innerHTML = '';
            const list = document.createElement('div');
            list.className = 'moodboard-contextmenu__list';

            const mkItem = (label, onClick) => {
                const item = document.createElement('div');
                item.className = 'moodboard-contextmenu__item';
                item.textContent = label;
                item.addEventListener('click', () => {
                    this.hide();
                    onClick();
                });
                return item;
            };

            // Копировать — копируем конкретный объект
            list.appendChild(mkItem('Копировать', () => {
                if (targetId) {
                    this.eventBus.emit('ui:copy-object', { objectId: targetId });
                }
            }));

            // Вставить — используем текущий буфер (объект/группа)
            list.appendChild(mkItem('Вставить', () => {
                this.eventBus.emit('keyboard:paste');
            }));

            this.element.appendChild(list);
            return;
        }

        // По умолчанию — пусто
        this.element.innerHTML = '<div style="padding:8px 12px; color:#888;">(пусто)</div>';
    }
}


