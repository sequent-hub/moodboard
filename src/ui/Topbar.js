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
        // Палитра кнопки заливки и соответствие цвету фона доски
        this._palette = [
            { id: 1, name: 'default-light', btnHex: '#B3E5FC', board: '#f7fbff' },
            { id: 2, name: 'mint-light',    btnHex: '#E8F5E9', board: '#f8fff7' },
            { id: 3, name: 'peach-light',   btnHex: '#FFF3E0', board: '#fffcf7' },
            { id: 4, name: 'gray-light',    btnHex: '#f5f5f5', board: '#f5f5f5' },
            { id: 5, name: 'white',         btnHex: '#ffffff', board: '#ffffff' }
        ];
        this._pendingPaintHex = null;
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
        // не подсвечиваем дефолт до прихода актуального типа из ядра

        // Синхронизация активного состояния по событию из ядра
        this._onGridCurrent = ({ type }) => this.setActive(type);
        this.eventBus.on(Events.UI.GridCurrent, this._onGridCurrent);

        // Обновляем цвет кнопки "краски" при выборе цвета фона
        this._onPaintPick = ({ btnHex }) => {
            if (!btnHex) return;
            this.setPaintButtonHex(btnHex);
        };
        this.eventBus.on(Events.UI.PaintPick, this._onPaintPick);

        // Инициализация цвета кнопки "краска" из настроек (или фона рендерера)
        try {
            const ap = window?.moodboard?.coreMoodboard?.settingsApplier;
            const bgHex = (ap && ap.get && ap.get().backgroundColor) || this._getCurrentBoardBackgroundHex();
            if (bgHex) {
                this._currentBoardHex = String(bgHex).toLowerCase();
                const mapped = this.mapBoardToBtnHex(this._currentBoardHex);
                this.setPaintButtonHex(mapped);
            }
        } catch (_) {}
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
        this._paintBtn = paintBtn;
        // Применяем отложенный цвет, если был задан до создания кнопки
        if (this._pendingPaintHex) {
            try { this._paintBtn.style.setProperty('--paint-btn-color', this._pendingPaintHex); } catch (_) {}
            this._pendingPaintHex = null;
        }

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
            } else {
            }
        } else {
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

    /** Возвращает текущий цвет фона канваса как hex-строку #RRGGBB */
    _getCurrentBoardBackgroundHex() {
        try {
            const app = window?.moodboard?.coreMoodboard?.pixi?.app || window?.moodboard?.core?.pixi?.app;
            const colorInt = app?.renderer?.background?.color ?? app?.renderer?.backgroundColor;
            if (typeof colorInt !== 'number') return null;
            const hex = `#${colorInt.toString(16).padStart(6, '0')}`;
            return hex.toLowerCase();
        } catch (_) { return null; }
    }

    /** Маппинг цвета фона к цвету кнопки палитры */
    mapBoardToBtnHex(boardHex) {
        if (!boardHex) return null;
        const found = this._palette.find(p => p.board.toLowerCase() === boardHex.toLowerCase());
        return found ? found.btnHex : boardHex;
    }

    /** Установить цвет кнопки палитры */
    setPaintButtonHex(btnHex) {
        if (!btnHex) return;
        if (this._paintBtn) {
            try { 
                this._paintBtn.style.setProperty('--paint-btn-color', btnHex); 
                // Прямое применение фона/бордера, чтобы цвет был виден сразу
                this._paintBtn.style.background = btnHex;
                const darker = this._darkenHex ? this._darkenHex(btnHex, 0.35) : btnHex;
                this._paintBtn.style.borderColor = darker;
            } catch (_) {}
        } else {
            this._pendingPaintHex = btnHex;
        }
    }

    /** Утилита: затемнить hex-цвет на долю amount */
    _darkenHex(hex, amount = 0.25) {
        try {
            const h = String(hex).replace('#','');
            const r = parseInt(h.substring(0,2), 16);
            const g = parseInt(h.substring(2,4), 16);
            const b = parseInt(h.substring(4,6), 16);
            const dr = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
            const dg = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
            const db = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));
            return `#${dr.toString(16).padStart(2,'0')}${dg.toString(16).padStart(2,'0')}${db.toString(16).padStart(2,'0')}`;
        } catch (_) { return hex; }
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
        const colors = this._palette.map(c => ({ id: c.id, name: c.name, hex: c.btnHex, board: c.board }));
        const grid = document.createElement('div');
        grid.className = 'moodboard-topbar__paint-grid';

        colors.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'moodboard-topbar__paint-btn';
            b.title = `Цвет ${c.id}`;
            b.style.background = c.hex;
            // Тёмная обводка того же цвета
            b.style.borderColor = this._darkenHex(c.hex, 0.35);
            // Цвет галочки — чёрный для максимальной видимости
            b.style.color = '#111';
            // Для надёжного сравнения — сохраняем оба значения в dataset
            b.dataset.hex = String(c.hex).toLowerCase();
            b.dataset.board = String(c.board).toLowerCase();
            // Галочка по центру
            const tick = document.createElement('i');
            tick.className = 'moodboard-topbar__paint-tick';
            b.appendChild(tick);
            b.dataset.colorId = String(c.id);
            b.addEventListener('click', () => {
                // Обновляем галочку на выбранном цвете
                try {
                    const prev = grid.querySelector('.moodboard-topbar__paint-btn.is-active');
                    if (prev) prev.classList.remove('is-active');
                    b.classList.add('is-active');
                } catch (_) {}
                // Мгновенно обновляем цвет кнопки "краска"
                this.setPaintButtonHex(c.hex);
                // Передаём выбор в ядро для смены фона
                this.eventBus.emit(Events.UI.PaintPick, { id: c.id, color: c.board, name: c.name, btnHex: c.hex });
                // Поповер не закрываем, чтобы пользователь видел галочку и мог передумать
            });
            grid.appendChild(b);
        });
        pop.appendChild(grid);

        // Выделяем активный цвет галочкой по фактическому boardHex
        try {
            const ap = window?.moodboard?.coreMoodboard?.settingsApplier;
            const boardHex = (
                (ap && ap.get && ap.get().backgroundColor) ||
                this._currentBoardHex ||
                this._getCurrentBoardBackgroundHex() ||
                ''
            ).toLowerCase();
            const match = boardHex ? grid.querySelector(`[data-board="${boardHex}"]`) : null;
            if (match) match.classList.add('is-active');
        } catch (_) {}

        // позиционируем поповер
        const rect = anchorBtn.getBoundingClientRect();
        pop.style.position = 'absolute';
        pop.style.left = `${rect.left - this.element.getBoundingClientRect().left}px`;
        pop.style.top = `${rect.bottom - this.element.getBoundingClientRect().top + 6}px`;

        // (дополнительная подсветка не требуется — см. блок выше)

        this.element.appendChild(pop);
        this._paintPopover = pop;

        // закрытие по клику вне (сохраняем ссылку для cleanup при destroy)
        this._onDocClickOutside = (ev) => {
            if (!pop.contains(ev.target) && ev.target !== anchorBtn) {
                pop.remove();
                this._paintPopover = null;
                document.removeEventListener('click', this._onDocClickOutside, true);
            }
        };
        setTimeout(() => document.addEventListener('click', this._onDocClickOutside, true), 0);
    }

    destroy() {
        if (!this.element) return;

        if (this._paintPopover) {
            this._paintPopover.remove();
            this._paintPopover = null;
            document.removeEventListener('click', this._onDocClickOutside, true);
        }

        if (this._onGridCurrent) this.eventBus.off(Events.UI.GridCurrent, this._onGridCurrent);
        if (this._onPaintPick) this.eventBus.off(Events.UI.PaintPick, this._onPaintPick);

        this.element.remove();
        this.element = null;
        this._paintBtn = null;
    }
}


