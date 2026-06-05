/**
 * Управляет прогрессивным схлопыванием кнопок тулбара в кнопку «Ещё»,
 * когда высота экрана не позволяет отобразить все инструменты.
 *
 * Алгоритм: физический перенос DOM-узлов (не копии) — все handlers/попапы
 * кнопок сохраняются без переподключения.
 */
export class ToolbarResponsiveController {
    constructor(toolbar) {
        this.toolbar = toolbar;
        this._observer = null;
        this._overflowBtn = null;
        this._overflowMenu = null;
        /** @type {Element[]} все схлопываемые элементы в исходном порядке */
        this._collapsibleOrder = [];
        this._documentClickHandler = null;
        this._rafId = null;
    }

    attach() {
        this._buildCollapsibleOrder();
        this._createOverflowButton();
        this._createOverflowMenu();

        if (typeof ResizeObserver !== 'undefined') {
            this._observer = new ResizeObserver(() => {
                if (this._rafId != null) return;
                const schedule = typeof requestAnimationFrame !== 'undefined'
                    ? requestAnimationFrame
                    : (fn) => setTimeout(fn, 16);
                this._rafId = schedule(() => { this._rafId = null; this.recompute(); });
            });
            this._observer.observe(this.toolbar.container);
        }

        this.recompute();
    }

    /** Строим список схлопываемых элементов один раз (всё кроме select). */
    _buildCollapsibleOrder() {
        const el = this.toolbar.element;
        if (!el) return;
        let pastSelect = false;
        for (const child of el.children) {
            if (child.dataset && child.dataset.toolId === 'select') {
                pastSelect = true;
                continue;
            }
            if (pastSelect) this._collapsibleOrder.push(child);
        }
    }

    _createOverflowButton() {
        this._overflowBtn = document.createElement('button');
        this._overflowBtn.className = 'moodboard-toolbar__button moodboard-toolbar__button--overflow';
        this._overflowBtn.dataset.tool = 'overflow';
        this._overflowBtn.dataset.toolId = 'overflow';

        // Иконка «three dots vertical» (lucide MoreVertical, inline SVG)
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.style.display = 'block';
        for (const cy of ['5', '12', '19']) {
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', '12');
            c.setAttribute('cy', cy);
            c.setAttribute('r', '1');
            svg.appendChild(c);
        }
        this._overflowBtn.appendChild(svg);

        this.toolbar.createTooltip(this._overflowBtn, 'Ещё');

        this._overflowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleMenu();
        });

        this._overflowBtn.style.display = 'none';
        this.toolbar.element.appendChild(this._overflowBtn);
    }

    _createOverflowMenu() {
        this._overflowMenu = document.createElement('div');
        this._overflowMenu.className = 'moodboard-toolbar__popup moodboard-toolbar__popup--overflow';
        this._overflowMenu.style.display = 'none';
        this.toolbar.container.appendChild(this._overflowMenu);

        // Клики по кнопкам внутри меню — маршрутизируем через actionRouter
        this._overflowMenu.addEventListener('click', (e) => {
            const button = e.target.closest('.moodboard-toolbar__button');
            if (!button || button.disabled) return;
            this.toolbar.actionRouter.routeToolbarAction(button, button.dataset.tool, button.dataset.toolId);
            setTimeout(() => this._closeMenu(), 50);
        });

        this._documentClickHandler = (e) => {
            if (!this._overflowMenu || this._overflowMenu.style.display === 'none') return;
            const inMenu = this._overflowMenu.contains(e.target);
            const onBtn = this._overflowBtn && this._overflowBtn.contains(e.target);
            if (!inMenu && !onBtn) this._closeMenu();
        };
        document.addEventListener('click', this._documentClickHandler);
    }

    _toggleMenu() {
        if (this._overflowMenu.style.display === 'none') this._openMenu();
        else this._closeMenu();
    }

    _openMenu() {
        this._positionMenu();
        this._overflowMenu.style.display = 'flex';
    }

    _closeMenu() {
        if (this._overflowMenu) this._overflowMenu.style.display = 'none';
    }

    _positionMenu() {
        const btnRect = this._overflowBtn.getBoundingClientRect();
        const containerRect = this.toolbar.container.getBoundingClientRect();
        const left = Math.round(this.toolbar.element.offsetWidth + 8);
        const top = Math.round(btnRect.top - containerRect.top);
        this._overflowMenu.style.left = `${left}px`;
        this._overflowMenu.style.top = `${top}px`;
    }

    /** Расстояние от верха контейнера до зоны, где можно рисовать тулбар (ниже топбара + 16px). */
    _getTopReserve() {
        const container = this.toolbar.container;
        const cRect = container.getBoundingClientRect();
        const workspace = container.parentElement;
        if (!workspace) return 72;

        const topbar = workspace.querySelector('.moodboard-topbar');
        if (topbar) {
            const r = topbar.getBoundingClientRect();
            return Math.round(r.bottom - cRect.top) + 16;
        }
        const topbarWrapper = workspace.querySelector('.moodboard-workspace__topbar');
        if (topbarWrapper) {
            let maxBottom = cRect.top;
            for (const child of topbarWrapper.children) {
                const r = child.getBoundingClientRect();
                if (r.bottom > maxBottom) maxBottom = r.bottom;
            }
            if (maxBottom > cRect.top + 10) return Math.round(maxBottom - cRect.top) + 16;
        }
        return 72;
    }

    /** Расстояние от низа контейнера до зоны, где можно рисовать тулбар (выше чата + 16px). */
    _getBottomReserve() {
        const container = this.toolbar.container;
        const cRect = container.getBoundingClientRect();
        const workspace = container.parentElement;
        if (!workspace) return 64;

        const chatEl = workspace.querySelector('.moodboard-chat');
        if (chatEl) {
            const r = chatEl.getBoundingClientRect();
            return Math.round(cRect.bottom - r.top) + 16;
        }
        return 64;
    }

    recompute() {
        if (!this.toolbar.element || !this._overflowBtn) return;
        const el = this.toolbar.element;

        // 1. Возвращаем все схлопнутые элементы обратно в тулбар (в исходном порядке)
        for (const item of this._collapsibleOrder) {
            if (item.parentNode !== el) el.insertBefore(item, this._overflowBtn);
        }
        // Убеждаемся, что overflow-кнопка стоит последней
        el.appendChild(this._overflowBtn);
        this._overflowBtn.style.display = 'none';

        // Восстанавливаем видимость разделителей
        for (const item of this._collapsibleOrder) {
            if (item.classList.contains('moodboard-toolbar__divider')) item.style.display = '';
        }

        // 2. Вычисляем доступную высоту и обновляем отступы контейнера
        const topReserve = this._getTopReserve();
        const bottomReserve = this._getBottomReserve();
        this.toolbar.container.style.paddingTop = `${topReserve}px`;
        this.toolbar.container.style.paddingBottom = `${bottomReserve}px`;
        const availableHeight = Math.max(60, this.toolbar.container.clientHeight - topReserve - bottomReserve);

        // 3. Схлопываем снизу вверх, пока тулбар не влезет
        // Используем scrollHeight (естественная высота контента) а не offsetHeight,
        // т.к. flex-shrink может сжать элемент до доступной высоты, скрыв реальное переполнение.
        let overflowCount = 0;
        while (overflowCount < this._collapsibleOrder.length && el.scrollHeight > availableHeight) {
            const idx = this._collapsibleOrder.length - 1 - overflowCount;
            if (idx < 0) break;
            const item = this._collapsibleOrder[idx];
            // Вставляем в начало меню → в меню порядок сверху вниз совпадает с исходным
            this._overflowMenu.insertBefore(item, this._overflowMenu.firstChild);
            overflowCount++;
            this._overflowBtn.style.display = '';
        }

        // 4. Скрываем висячие разделители в конце видимого набора
        this._hideTrailingDividers();

        // 5. Обновляем позицию меню если оно открыто
        if (this._overflowMenu.style.display !== 'none') this._positionMenu();
    }

    _hideTrailingDividers() {
        const el = this.toolbar.element;
        const children = Array.from(el.children).filter(c => c !== this._overflowBtn);
        for (let i = children.length - 1; i >= 0; i--) {
            if (children[i].classList.contains('moodboard-toolbar__divider')) {
                children[i].style.display = 'none';
            } else {
                break;
            }
        }
    }

    destroy() {
        if (this._rafId != null) {
            if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._rafId);
            else clearTimeout(this._rafId);
            this._rafId = null;
        }
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
        if (this._documentClickHandler) {
            document.removeEventListener('click', this._documentClickHandler);
            this._documentClickHandler = null;
        }

        // Возвращаем схлопнутые элементы в тулбар перед удалением меню
        if (this.toolbar.element && this._overflowMenu) {
            for (const item of this._collapsibleOrder) {
                if (item.parentNode === this._overflowMenu) {
                    this._overflowMenu.removeChild(item);
                    this.toolbar.element.appendChild(item);
                }
            }
        }

        if (this._overflowMenu) { this._overflowMenu.remove(); this._overflowMenu = null; }
        if (this._overflowBtn) { this._overflowBtn.remove(); this._overflowBtn = null; }

        // Сбрасываем отступы контейнера
        if (this.toolbar.container) {
            this.toolbar.container.style.paddingTop = '';
            this.toolbar.container.style.paddingBottom = '';
        }
        this._collapsibleOrder = [];
    }
}
