export class ContextMenu {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.isVisible = false;
        this.lastX = 0;
        this.lastY = 0;
        this.currentGridType = 'line';

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

        // Синхронизация активного типа сетки
        this.eventBus.on('ui:grid:current', ({ type }) => {
            if (type) this.currentGridType = type;
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
        this.lastX = x;
        this.lastY = y;
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

            const mkItem = (label, shortcut, onClick) => {
                const item = document.createElement('div');
                item.className = 'moodboard-contextmenu__item';
                const left = document.createElement('span');
                left.className = 'moodboard-contextmenu__label';
                left.textContent = label;
                const right = document.createElement('span');
                right.className = 'moodboard-contextmenu__shortcut';
                right.textContent = shortcut || '';
                item.appendChild(left);
                item.appendChild(right);
                item.addEventListener('click', () => {
                    this.hide();
                    onClick();
                });
                return item;
            };

            // Копировать — копируем конкретный объект
            list.appendChild(mkItem('Копировать', 'Ctrl+C', () => {
                if (targetId) {
                    this.eventBus.emit('ui:copy-object', { objectId: targetId });
                }
            }));

            // Вставить — используем текущий буфер (объект/группа)
            list.appendChild(mkItem('Вставить', 'Ctrl+V', () => {
                this.eventBus.emit('ui:paste-at', { x: this.lastX, y: this.lastY });
            }));

            // Слойность
            list.appendChild(mkItem('На передний план', ']', () => {
                if (targetId) this.eventBus.emit('ui:layer:bring-to-front', { objectId: targetId });
            }));
            list.appendChild(mkItem('Перенести вперёд', 'Ctrl+]', () => {
                if (targetId) this.eventBus.emit('ui:layer:bring-forward', { objectId: targetId });
            }));
            list.appendChild(mkItem('Перенести назад', 'Ctrl+[', () => {
                if (targetId) this.eventBus.emit('ui:layer:send-backward', { objectId: targetId });
            }));
            list.appendChild(mkItem('На задний план', '[', () => {
                if (targetId) this.eventBus.emit('ui:layer:send-to-back', { objectId: targetId });
            }));

            this.element.appendChild(list);
            return;
        }

        if (context === 'group') {
            this.element.innerHTML = '';
            const list = document.createElement('div');
            list.className = 'moodboard-contextmenu__list';

            const mkItem = (label, shortcut, onClick) => {
                const item = document.createElement('div');
                item.className = 'moodboard-contextmenu__item';
                const left = document.createElement('span');
                left.className = 'moodboard-contextmenu__label';
                left.textContent = label;
                const right = document.createElement('span');
                right.className = 'moodboard-contextmenu__shortcut';
                right.textContent = shortcut || '';
                item.appendChild(left);
                item.appendChild(right);
                item.addEventListener('click', () => {
                    this.hide();
                    onClick();
                });
                return item;
            };

            // Копировать группу — берём текущее выделение
            list.appendChild(mkItem('Копировать', 'Ctrl+C', () => {
                this.eventBus.emit('ui:copy-group');
            }));

            // Вставить — вставляет из group/object буфера в точку клика
            list.appendChild(mkItem('Вставить', 'Ctrl+V', () => {
                this.eventBus.emit('ui:paste-at', { x: this.lastX, y: this.lastY });
            }));

            // Слойность для группы (двигаем все выбранные объекты)
            list.appendChild(mkItem('На передний план', ']', () => {
                this.eventBus.emit('ui:layer-group:bring-to-front');
            }));
            list.appendChild(mkItem('Перенести вперёд', 'Ctrl+]', () => {
                this.eventBus.emit('ui:layer-group:bring-forward');
            }));
            list.appendChild(mkItem('Перенести назад', 'Ctrl+[', () => {
                this.eventBus.emit('ui:layer-group:send-backward');
            }));
            list.appendChild(mkItem('На задний план', '[', () => {
                this.eventBus.emit('ui:layer-group:send-to-back');
            }));

            this.element.appendChild(list);
            return;
        }

        if (context === 'canvas') {
            this.element.innerHTML = '';
            const list = document.createElement('div');
            list.className = 'moodboard-contextmenu__list';
            const item = document.createElement('div');
            item.className = 'moodboard-contextmenu__item';
            const left = document.createElement('span');
            left.className = 'moodboard-contextmenu__label';
            left.textContent = 'Вставить';
            const right = document.createElement('span');
            right.className = 'moodboard-contextmenu__shortcut';
            right.textContent = 'Ctrl+V';
            item.appendChild(left);
            item.appendChild(right);
            item.addEventListener('click', () => {
                this.hide();
                this.eventBus.emit('ui:paste-at', { x: this.lastX, y: this.lastY });
            });
            list.appendChild(item);

            // Разделитель
            const divider = document.createElement('div');
            divider.className = 'moodboard-contextmenu__divider';
            list.appendChild(divider);

            // Ряд кнопок сетки
            const gridRow = document.createElement('div');
            gridRow.className = 'moodboard-contextmenu__grid-row';
            const buttons = [
                { icon: '▦', type: 'line', title: 'Сетка: линии' },
                { icon: '⋯', type: 'dot', title: 'Сетка: точки' },
                { icon: '+', type: 'cross', title: 'Сетка: крестики' },
                { icon: '⊘', type: 'off', title: 'Сетка: выкл' }
            ];
            buttons.forEach(cfg => {
                const b = document.createElement('button');
                b.className = 'moodboard-contextmenu__grid-button';
                b.textContent = cfg.icon;
                b.title = cfg.title;
                b.dataset.grid = cfg.type;
                if (cfg.type === this.currentGridType) {
                    b.classList.add('moodboard-contextmenu__grid-button--active');
                }
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hide();
                    this.eventBus.emit('ui:grid:change', { type: cfg.type });
                });
                gridRow.appendChild(b);
            });
            list.appendChild(gridRow);
            this.element.appendChild(list);
            return;
        }

        // По умолчанию — пусто
        this.element.innerHTML = '<div style="padding:8px 12px; color:#888;">(пусто)</div>';
    }
}


