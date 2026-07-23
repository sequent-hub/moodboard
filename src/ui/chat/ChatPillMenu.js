/**
 * Универсальный «пилл с выпадающим меню».
 *
 * Используется и для переключателя моделей генерации,
 * и для пресетов промпта (Default/Design helper/...).
 *
 * Одна ответственность: отрисовать список опций по triggerEl,
 * показывать/скрывать меню, диспатчить onSelect(id).
 *
 * Не знает, какие именно опции — получает их извне.
 */

export class ChatPillMenu {
    /**
     * @param {{ trigger: HTMLElement, menu: HTMLElement, label: HTMLElement, icon?: HTMLElement }} refs
     * @param {{ onSelect: (id: string) => void, getOptions: () => Array<{id: string, label: string, enabled?: boolean, hint?: string, description?: string, icon?: string}>, getActiveId: () => string }} handlers
     */
    constructor(refs, handlers) {
        this._trigger = refs.trigger;
        this._menu = refs.menu;
        this._label = refs.label;
        this._icon = refs.icon || null;
        this._handlers = handlers;
        this._listeners = [];
        this._isOpen = false;
        this._docClickHandler = null;
    }

    attach() {
        this._on(this._trigger, 'click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        this._on(this._menu, 'click', (e) => {
            const item = e.target.closest('[data-option-id]');
            if (!item || item.hasAttribute('disabled')) return;
            const id = item.getAttribute('data-option-id');
            this.close();
            this._handlers.onSelect?.(id);
        });
    }

    refresh() {
        const options = this._handlers.getOptions?.() || [];
        const activeId = this._handlers.getActiveId?.();

        const fragment = document.createDocumentFragment();
        for (const opt of options) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'moodboard-chat__menu-item';
            if (opt.icon || opt.description) {
                btn.classList.add('moodboard-chat__menu-item--rich');
            }
            btn.setAttribute('data-option-id', opt.id);
            btn.setAttribute('role', 'menuitemradio');
            if (opt.enabled === false) btn.setAttribute('disabled', '');
            if (opt.id === activeId) btn.setAttribute('data-active', 'true');

            if (opt.icon) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'moodboard-chat__menu-item-icon';
                iconSpan.innerHTML = opt.icon;
                btn.appendChild(iconSpan);
            }

            const textWrap = document.createElement('span');
            textWrap.className = 'moodboard-chat__menu-item-text';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'moodboard-chat__menu-item-label';
            labelSpan.textContent = opt.label;
            textWrap.appendChild(labelSpan);

            if (opt.description) {
                const descSpan = document.createElement('span');
                descSpan.className = 'moodboard-chat__menu-item-description';
                descSpan.textContent = opt.description;
                textWrap.appendChild(descSpan);
            }

            btn.appendChild(textWrap);

            if (opt.hint) {
                const hintSpan = document.createElement('span');
                hintSpan.className = 'moodboard-chat__menu-item-hint';
                hintSpan.textContent = opt.hint;
                btn.appendChild(hintSpan);
            }

            fragment.appendChild(btn);
        }
        this._menu.replaceChildren(fragment);

        const active = options.find((o) => o.id === activeId);
        if (active) {
            this._label.textContent = active.label;
            if (this._icon && active.icon) this._icon.innerHTML = active.icon;
        }
    }

    toggle() {
        if (this._isOpen) this.close();
        else this.open();
    }

    open() {
        this.refresh();
        this._menu.classList.add('is-open');
        this._trigger.setAttribute('aria-expanded', 'true');
        this._isOpen = true;
        this._docClickHandler = (e) => {
            if (!this._menu.contains(e.target) && !this._trigger.contains(e.target)) {
                this.close();
            }
        };
        document.addEventListener('mousedown', this._docClickHandler);
    }

    close() {
        if (!this._isOpen) return;
        this._menu.classList.remove('is-open');
        this._trigger.setAttribute('aria-expanded', 'false');
        this._isOpen = false;
        if (this._docClickHandler) {
            document.removeEventListener('mousedown', this._docClickHandler);
            this._docClickHandler = null;
        }
    }

    destroy() {
        this.close();
        for (const off of this._listeners) off();
        this._listeners = [];
    }

    _on(el, type, handler) {
        el.addEventListener(type, handler);
        this._listeners.push(() => el.removeEventListener(type, handler));
    }
}
