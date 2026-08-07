/**
 * Меню «связь дотянули в пустоту».
 *
 * Показывает список узлов, которые примут эту связь, и по выбору создаёт узел
 * рядом с точкой отпускания. Живёт в body с position: fixed — на момент показа
 * жест уже закончен, привязываться к контейнеру холста незачем, а всплытие над
 * панелями и модалками получается бесплатно.
 */

const ROOT_CLASS = 'mb-gen-drop';

export class GeneratorDropMenu {
    constructor() {
        this.element = null;
        this._onSelect = null;
        this._boundDocDown = this._onDocumentPointerDown.bind(this);
        this._boundKeyDown = this._onKeyDown.bind(this);
    }

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @param {Array<{type: string, label: string}>} items
     * @param {(item: object) => void} onSelect
     */
    open(clientX, clientY, items, onSelect) {
        this.close();
        if (!Array.isArray(items) || items.length === 0) return;

        this._onSelect = typeof onSelect === 'function' ? onSelect : null;

        const menu = document.createElement('div');
        menu.className = `${ROOT_CLASS} is-open`;

        items.forEach((item) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mb-imgen__menu-item';
            button.textContent = item.label;
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const handler = this._onSelect;
                this.close();
                handler?.(item);
            });
            menu.appendChild(button);
        });

        document.body.appendChild(menu);
        this.element = menu;
        this._place(clientX, clientY);

        // Слушатель ставится следующим кадром: pointerup, породивший меню,
        // ещё не догорел и закрыл бы его сразу.
        this._openTimer = window.setTimeout(() => {
            document.addEventListener('pointerdown', this._boundDocDown, true);
            document.addEventListener('keydown', this._boundKeyDown, true);
        }, 0);
    }

    close() {
        window.clearTimeout(this._openTimer);
        document.removeEventListener('pointerdown', this._boundDocDown, true);
        document.removeEventListener('keydown', this._boundKeyDown, true);
        this.element?.remove();
        this.element = null;
        this._onSelect = null;
    }

    destroy() {
        this.close();
    }

    _place(clientX, clientY) {
        const menu = this.element;
        if (!menu) return;

        const rect = menu.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width - 8);
        const maxTop = Math.max(0, window.innerHeight - rect.height - 8);
        menu.style.left = `${Math.min(clientX, maxLeft)}px`;
        menu.style.top = `${Math.min(clientY, maxTop)}px`;
    }

    _onDocumentPointerDown(event) {
        if (this.element?.contains(event.target)) return;
        this.close();
    }

    _onKeyDown(event) {
        if (event.key === 'Escape') this.close();
    }
}
