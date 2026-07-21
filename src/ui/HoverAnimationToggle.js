import { Events } from '../core/events/Events.js';
import {
    HOVER_ANIMATION_STORAGE_KEY,
    readHoverAnimationEnabled,
} from './animation/HoverLiftController.js';

/** Иконка «анимация» (src/assets/icons/animation.svg), инлайн 16×16 */
const ANIMATION_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<path d="M4.51311 12C4.1118 11.9416 3.79336 11.8443 3.51321 11.6826C3.05313 11.417 2.67109 11.0349 2.40546 10.5748C2 9.87256 2 8.92972 2 7.04403C2 5.15834 2 4.21549 2.40546 3.51321C2.67109 3.05313 3.05313 2.67109 3.51321 2.40546C4.21549 2 5.15834 2 7.04403 2C8.92972 2 9.87256 2 10.5748 2.40546C11.0349 2.67109 11.417 3.05313 11.6826 3.51321C11.8443 3.79336 11.9416 4.1118 12 4.51311" stroke-linecap="round"></path>' +
    '<path d="M9.52169 17C9.11624 16.9417 8.7952 16.8443 8.51301 16.6813C8.053 16.4158 7.671 16.0338 7.40541 15.5737C7 14.8715 7 13.9288 7 12.0434C7 10.1579 7 9.2152 7.40541 8.51301C7.671 8.053 8.053 7.671 8.51301 7.40541C9.2152 7 10.1579 7 12.0434 7C13.9288 7 14.8715 7 15.5737 7.40541C16.0338 7.671 16.4158 8.053 16.6813 8.51301C16.8443 8.7952 16.9417 9.11624 17 9.52169" stroke-linecap="round"></path>' +
    '<path d="M12 17C12 15.1308 12 14.1962 12.4019 13.5C12.6652 13.0439 13.0439 12.6652 13.5 12.4019C14.1962 12 15.1308 12 17 12C18.8692 12 19.8038 12 20.5 12.4019C20.9561 12.6652 21.3348 13.0439 21.5981 13.5C22 14.1962 22 15.1308 22 17C22 18.8692 22 19.8038 21.5981 20.5C21.3348 20.9561 20.9561 21.3348 20.5 21.5981C19.8038 22 18.8692 22 17 22C15.1308 22 14.1962 22 13.5 21.5981C13.0439 21.3348 12.6652 20.9561 12.4019 20.5C12 19.8038 12 18.8692 12 17Z"></path>' +
    '</svg>';

/**
 * Та же иконка, но с диагональной чертой-перечёркиванием для состояния
 * «анимация выключена». Черта идёт из нижнего левого угла в правый верхний
 * и выходит за пределы трёх квадратов, создавая эффект «пронзания» иконки.
 */
const ANIMATION_ICON_OFF =
    ANIMATION_ICON.replace(
        '</svg>',
        '<line x1="1" y1="23" x2="23" y2="1" stroke="#444" stroke-width=".75" stroke-linecap="round"></line>' +
        '</svg>'
    );

/**
 * Тумблер hover-анимации объектов — круглая кнопка в отдельной панели
 * (как moodboard-mapbar), расположенная слева от moodboard-commentsbar.
 * Состояние сохраняется в localStorage, синхронизируется с HoverLiftController
 * через событие Events.UI.HoverAnimationToggle.
 */
export class HoverAnimationToggle {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.button = null;
        this.icon = null;
        this.enabled = readHoverAnimationEnabled();
        this._resizeObserver = null;
        this._onWindowResize = null;
    }

    attach() {
        this.element = document.createElement('div');
        this.element.className = 'moodboard-animbar';

        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.id = 'moodboard-animbar-button';
        this.button.className = 'moodboard-animbar__switch';
        this.button.setAttribute('role', 'switch');
        const thumb = document.createElement('span');
        thumb.className = 'moodboard-animbar__switch-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        this.button.appendChild(thumb);
        this.button.addEventListener('click', () => this._toggle());

        this.icon = document.createElement('span');
        this.icon.className = 'moodboard-animbar__icon';
        this.icon.setAttribute('aria-hidden', 'true');
        this.icon.innerHTML = ANIMATION_ICON;

        this.element.appendChild(this.button);
        this.element.appendChild(this.icon);
        this.container.appendChild(this.element);

        this._syncButton();
        this._emitState();
        this._applyDomState();
        this._reposition();

        const commentsbar = this.container.querySelector('.moodboard-commentsbar');
        if (commentsbar && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._reposition());
            this._resizeObserver.observe(commentsbar);
        }
        this._onWindowResize = () => this._reposition();
        window.addEventListener('resize', this._onWindowResize);
    }

    _toggle() {
        this.enabled = !this.enabled;
        try {
            window.localStorage?.setItem(HOVER_ANIMATION_STORAGE_KEY, this.enabled ? '1' : '0');
        } catch (_) {
            /* localStorage недоступен — сохранение пропускаем */
        }
        this._syncButton();
        this._emitState();
        this._applyDomState();
    }

    _emitState() {
        this.eventBus?.emit(Events.UI.HoverAnimationToggle, { enabled: this.enabled });
    }

    /**
     * Отключает CSS-hover-анимации DOM-элементов доски (например пинов
     * комментариев), которые не проходят через HoverLiftController.
     */
    _applyDomState() {
        this.container?.classList?.toggle('moodboard--hover-anim-off', !this.enabled);
    }

    _syncButton() {
        if (!this.button) return;
        if (this.icon) {
            this.icon.innerHTML = this.enabled ? ANIMATION_ICON : ANIMATION_ICON_OFF;
        }
        const label = this.enabled ? 'Выключить Hover Lift анимацию на объектах' : 'Включить Hover Lift анимацию на объектах';
        this.button.title = label;
        this.button.setAttribute('aria-label', label);
        this.button.setAttribute('aria-checked', String(this.enabled));
        this.button.classList.toggle('is-on', this.enabled);
        this.element?.classList.toggle('moodboard-animbar--off', !this.enabled);
    }

    /** Позиционирует панель вплотную слева от commentsbar */
    _reposition() {
        if (!this.element) return;
        const commentsbar = this.container.querySelector('.moodboard-commentsbar');
        if (!commentsbar) return;
        const cRect = commentsbar.getBoundingClientRect();
        const wRect = this.container.getBoundingClientRect();
        const gap = 8;
        const right = wRect.right - cRect.left + gap;
        this.element.style.right = `${Math.round(right)}px`;
    }

    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._onWindowResize) {
            window.removeEventListener('resize', this._onWindowResize);
            this._onWindowResize = null;
        }
        if (this.element) this.element.remove();
        this.element = null;
        this.button = null;
        this.icon = null;
    }
}
