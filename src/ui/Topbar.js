/**
 * Горизонтальная верхняя панель (пока пустая)
 */
import { Events } from '../core/events/Events.js';

export class Topbar {
    constructor(container, eventBus, theme = 'light') {
        this.container = container;
        this.eventBus = eventBus;
        this.theme = theme;
        this.element = null;
        this._paintPopover = null;
        this.createTopbar();
        this.attachEvents();
        // Активируем дефолтную кнопку (line) до прихода события из ядра
        this.setActive('line');

        // Синхронизация активного состояния по событию из ядра
        this.eventBus.on(Events.UI.GridCurrent, ({ type }) => {
            this.setActive(type);
        });
    }

    createTopbar() {
        this.element = document.createElement('div');
        this.element.className = `moodboard-topbar moodboard-topbar--${this.theme}`;
        // Кнопки выбора вида сетки (без функциональности)
        const buttons = [
            { id: 'grid-line', icon: '▦', title: 'Сетка: линии', type: 'line' },
            { id: 'grid-dot', icon: '⋯', title: 'Сетка: точки', type: 'dot' },
            { id: 'grid-cross', icon: '+', title: 'Сетка: крестики', type: 'cross' },
            { id: 'grid-off', icon: '⊘', title: 'Сетка: выкл', type: 'off' }
        ];

        buttons.forEach(cfg => {
            const btn = document.createElement('button');
            btn.className = 'moodboard-topbar__button';
            btn.textContent = cfg.icon;
            btn.title = cfg.title;
            btn.dataset.grid = cfg.type;
            this.element.appendChild(btn);
        });

        // Вертикальный разделитель
        const divider = document.createElement('div');
        divider.className = 'moodboard-topbar__divider';
        this.element.appendChild(divider);

        // Кнопка "краска" (иконка банки с краской)
        const paintBtn = document.createElement('button');
        paintBtn.className = 'moodboard-topbar__button moodboard-topbar__button--paint';
        paintBtn.title = 'Палитра фона';
        // простая svg-иконка банки с краской
        paintBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3h6l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3z" stroke="#333" stroke-width="2" fill="#fff"/><path d="M11 3v5h5" stroke="#333" stroke-width="2"/><path d="M17 12s2 2 2 4a2 2 0 0 1-4 0c0-2 2-4 2-4z" fill="#4ade80" stroke="#333" stroke-width="1"/></svg>';
        paintBtn.dataset.action = 'paint-toggle';
        this.element.appendChild(paintBtn);

        // (кнопки зума вынесены в отдельную панель справа)

        this.container.appendChild(this.element);
    }

    attachEvents() {
        this.element.addEventListener('click', (e) => {
            const btn = e.target.closest('.moodboard-topbar__button');
            if (!btn) return;
            if (btn.dataset.grid) {
                const type = btn.dataset.grid;
                this.eventBus.emit(Events.UI.GridChange, { type });
                this.setActive(type);
                return;
            }
            if (btn.dataset.action === 'paint-toggle') {
                this.togglePaintPopover(btn);
                return;
            }
        });

        // Зум обрабатывается в отдельной панели
    }

    setActive(type) {
        const buttons = this.element.querySelectorAll('.moodboard-topbar__button');
        buttons.forEach((b) => b.classList.remove('moodboard-topbar__button--active'));
        const target = this.element.querySelector(`.moodboard-topbar__button[data-grid="${type}"]`);
        if (target) target.classList.add('moodboard-topbar__button--active');
    }

    setTheme(theme) {
        this.theme = theme;
        this.element.className = `moodboard-topbar moodboard-topbar--${theme}`;
    }

    togglePaintPopover(anchorBtn) {
        if (this._paintPopover && this._paintPopover.parentNode) {
            this._paintPopover.remove();
            this._paintPopover = null;
            return;
        }
        const pop = document.createElement('div');
        pop.className = 'moodboard-topbar__paint-popover';
        // Пять цветов: 1 — светло-зелёный, 2 — светло-синий, 3 — светло-оранжевый, 4 — светло‑серый, 5 — белый
        const colors = [
            { id: 1, name: 'light-green', hex: '#D1FAE5' },
            { id: 2, name: 'light-blue', hex: '#DBEAFE' },
            { id: 3, name: 'light-orange', hex: '#FFEDD5' },
            { id: 4, name: 'light-gray', hex: '#F3F4F6' },
            { id: 5, name: 'white', hex: '#FFFFFF' }
        ];
        const grid = document.createElement('div');
        grid.className = 'moodboard-topbar__paint-grid';
        colors.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'moodboard-topbar__paint-btn';
            b.title = `Цвет ${c.id}`;
            b.style.background = c.hex;
            b.dataset.colorId = String(c.id);
            b.addEventListener('click', () => {
                this.eventBus.emit(Events.UI.PaintPick, { id: c.id, color: c.hex, name: c.name });
                if (this._paintPopover) this._paintPopover.remove();
                this._paintPopover = null;
            });
            grid.appendChild(b);
        });
        pop.appendChild(grid);

        // позиционируем поповер
        const rect = anchorBtn.getBoundingClientRect();
        pop.style.position = 'absolute';
        pop.style.left = `${rect.left - this.element.getBoundingClientRect().left}px`;
        pop.style.top = `${rect.bottom - this.element.getBoundingClientRect().top + 6}px`;

        this.element.appendChild(pop);
        this._paintPopover = pop;

        // закрытие по клику вне
        const onDocClick = (ev) => {
            if (!pop.contains(ev.target) && ev.target !== anchorBtn) {
                pop.remove();
                this._paintPopover = null;
                document.removeEventListener('click', onDocClick, true);
            }
        };
        setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
    }

    destroy() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}


