/**
 * Горизонтальная верхняя панель (пока пустая)
 */
import { Events } from '../core/events/Events.js';
import { TopbarIconLoader } from '../utils/topbarIconLoader.js';

export class Topbar {
    constructor(container, eventBus, theme = 'light') {
        this.container = container;
        this.eventBus = eventBus;
        this.theme = theme;
        this.element = null;
        this._paintPopover = null;
        // Загружаем иконки
        this.iconLoader = new TopbarIconLoader();
        this.icons = this.iconLoader.icons;
        this.init();
    }

    async init() {
        try {
            // Загружаем все иконки
            this.icons = await this.iconLoader.loadAllIcons();
        } catch (error) {
            console.error('❌ Ошибка загрузки иконок верхней панели:', error);
        }
        
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
            { id: 'grid-line', icon: 'grid-line', title: 'Сетка: линии', type: 'line' },
            { id: 'grid-dot', icon: 'grid-dot', title: 'Сетка: точки', type: 'dot' },
            { id: 'grid-cross', icon: 'grid-cross', title: 'Сетка: крестики', type: 'cross' },
            { id: 'grid-off', icon: 'grid-off', title: 'Сетка: выкл', type: 'off' }
        ];

        buttons.forEach(cfg => {
            const btn = document.createElement('button');
            btn.className = 'moodboard-topbar__button';
            
            // Создаем SVG иконку
            if (this.icons[cfg.icon]) {
                this.createSvgIcon(btn, cfg.icon);
            } else {
                // Fallback: создаем простую текстовую иконку
                const fallbackIcon = document.createElement('span');
                fallbackIcon.textContent = cfg.icon.charAt(0).toUpperCase();
                fallbackIcon.style.fontSize = '14px';
                fallbackIcon.style.fontWeight = 'bold';
                btn.appendChild(fallbackIcon);
            }
            
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
        
        // Создаем SVG иконку
        if (this.icons['paint']) {
            this.createSvgIcon(paintBtn, 'paint');
        } else {
            // Fallback: создаем простую текстовую иконку
            const fallbackIcon = document.createElement('span');
            fallbackIcon.textContent = '🎨';
            fallbackIcon.style.fontSize = '16px';
            paintBtn.appendChild(fallbackIcon);
        }
        
        paintBtn.dataset.action = 'paint-toggle';
        this.element.appendChild(paintBtn);

        // (кнопки зума вынесены в отдельную панель справа)

        this.container.appendChild(this.element);
    }

    /**
     * Создает SVG иконку для кнопки
     */
    createSvgIcon(button, iconName) {
        if (this.icons[iconName]) {
            // Создаем SVG элемент из загруженного содержимого
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = this.icons[iconName];
            const svg = tempDiv.querySelector('svg');
            
            if (svg) {
                // Убираем inline размеры, чтобы CSS мог их контролировать
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.style.display = 'block';
                
                // Добавляем SVG в кнопку
                button.appendChild(svg);
            }
        }
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
        // Пять цветов кнопок-палитры и соответствующие цвета фона доски
        // 1: фон #f7fbff, кнопка #B3E5FC
        // 2: фон #f8fff7, кнопка #E8F5E9
        // 3: фон #fffcf7, кнопка #FFF3E0
        // 4: фон #f5f5f5, кнопка #f5f5f5
        // 5: фон #ffffff, кнопка #ffffff
        const colors = [
            { id: 1, name: 'default-light', hex: '#B3E5FC', board: '#f7fbff' },
            { id: 2, name: 'mint-light',    hex: '#E8F5E9', board: '#f8fff7' },
            { id: 3, name: 'peach-light',   hex: '#FFF3E0', board: '#fffcf7' },
            { id: 4, name: 'gray-light',    hex: '#f5f5f5', board: '#f5f5f5' },
            { id: 5, name: 'white',         hex: '#ffffff', board: '#ffffff' }
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
                this.eventBus.emit(Events.UI.PaintPick, { id: c.id, color: c.board, name: c.name });
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


