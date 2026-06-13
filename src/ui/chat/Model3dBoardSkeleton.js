/**
 * DOM-скелетон 3D-модели на полотне доски.
 *
 * Одна ответственность: показывать анимированную заглушку в том месте,
 * где появится сгенерированная 3D-модель. Не знает про сессию и вьюпорт —
 * экранный прямоугольник ему задаёт ChatWindow (он же держит мировые координаты
 * и пересчитывает позицию при pan/zoom).
 *
 * Lifecycle: attach(container) → setRect(rect)* → enter() → detach() → destroy()
 * attach/detach идемпотентны.
 */
export class Model3dBoardSkeleton {
    /**
     * @param {object} [opts]
     * @param {string} [opts.iconSvg] HTML-строка иконки (например ICONS.cube)
     */
    constructor({ iconSvg = '' } = {}) {
        this._el = null;
        this._iconSvg = iconSvg;
    }

    /**
     * @param {HTMLElement} container
     */
    attach(container) {
        if (this._el) return;

        const el = document.createElement('div');
        el.className = 'moodboard-chat__3d-skeleton moodboard-chat__3d-skeleton--enter';

        if (this._iconSvg) {
            const icon = document.createElement('span');
            icon.className = 'moodboard-chat__3d-skeleton-icon';
            icon.innerHTML = this._iconSvg;
            el.appendChild(icon);
        }

        this._el = el;
        (container ?? document.body).appendChild(el);

        // Принудительный reflow фиксирует стартовое состояние (--enter) до enter(),
        // иначе браузер смерджит кадры и transition не запустится.
        void el.offsetWidth;
    }

    /**
     * Задаёт экранный прямоугольник (CSS-пиксели вьюпорта, position: fixed).
     * @param {{ left:number, top:number, width:number, height:number, radius?:number }} rect
     * @param {{ animate?: boolean }} [opts]
     */
    setRect({ left, top, width, height, radius }, { animate = false } = {}) {
        if (!this._el) return;
        const el = this._el;

        if (!animate) el.style.transition = 'none';

        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(top)}px`;
        el.style.width = `${Math.round(width)}px`;
        el.style.height = `${Math.round(height)}px`;
        if (typeof radius === 'number') {
            el.style.borderRadius = `${Math.max(2, Math.round(radius))}px`;
        }

        if (!animate) {
            void el.offsetWidth;
            el.style.removeProperty('transition');
        }
    }

    /** Запускает анимацию появления. */
    enter() {
        if (!this._el) return;
        this._el.classList.remove('moodboard-chat__3d-skeleton--enter');
        this._el.classList.add('moodboard-chat__3d-skeleton--entered');
    }

    /** @returns {boolean} */
    isAttached() {
        return !!this._el;
    }

    detach() {
        if (this._el && this._el.parentNode) {
            this._el.parentNode.removeChild(this._el);
        }
        this._el = null;
    }

    destroy() {
        this.detach();
    }
}
