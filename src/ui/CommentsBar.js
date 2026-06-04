import { Events } from '../core/events/Events.js';

const ICONS = {
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    messages: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
};

function svg(paths) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/**
 * Нижняя правая панель управления комментариями.
 * Источник правды для UI-фильтра «показывать решённые»: эмитит
 * Comment.ResolvedFilterChanged, CommentPinLayer применяет фильтр к пинам.
 */
export class CommentsBar {
    constructor(container, eventBus) {
        this.container = container;
        this.eventBus = eventBus;
        this.element = null;
        this.filterBtn = null;
        this.filterIcon = null;
        this.filterLabel = null;
        /** true — решённые комментарии видны (по умолчанию) */
        this.showResolved = true;
    }

    attach() {
        this.element = document.createElement('div');
        this.element.className = 'moodboard-commentsbar';

        this.filterBtn = document.createElement('button');
        this.filterBtn.type = 'button';
        this.filterBtn.className = 'moodboard-commentsbar__filter';
        this.filterIcon = document.createElement('span');
        this.filterIcon.className = 'moodboard-commentsbar__icon';
        this.filterLabel = document.createElement('span');
        this.filterLabel.className = 'moodboard-commentsbar__label';
        this.filterBtn.appendChild(this.filterIcon);
        this.filterBtn.appendChild(this.filterLabel);
        this.filterBtn.addEventListener('click', () => this._toggleResolved());

        const divider = document.createElement('span');
        divider.className = 'moodboard-commentsbar__divider';

        this.listBtn = document.createElement('button');
        this.listBtn.type = 'button';
        this.listBtn.className = 'moodboard-commentsbar__button';
        this.listBtn.title = 'Все комментарии';
        this.listBtn.setAttribute('aria-label', 'Все комментарии');
        this.listBtn.innerHTML = svg(ICONS.messages);
        this.listBtn.addEventListener('click', () => {
            this.eventBus.emit(Events.Comment.ListOpened, {});
        });

        this.element.appendChild(this.filterBtn);
        this.element.appendChild(divider);
        this.element.appendChild(this.listBtn);
        this.container.appendChild(this.element);

        this._syncFilter();
    }

    _toggleResolved() {
        this.showResolved = !this.showResolved;
        this._syncFilter();
        this.eventBus.emit(Events.Comment.ResolvedFilterChanged, {
            showResolved: this.showResolved,
        });
    }

    _syncFilter() {
        if (!this.filterBtn) return;
        const label = this.showResolved ? 'Скрыть решённые' : 'Показать все';
        this.filterIcon.innerHTML = svg(this.showResolved ? ICONS.eyeOff : ICONS.eye);
        this.filterLabel.textContent = label;
        this.filterBtn.title = label;
        this.filterBtn.setAttribute('aria-pressed', String(!this.showResolved));
    }

    destroy() {
        if (this.element) this.element.remove();
        this.element = null;
        this.filterBtn = null;
        this.filterIcon = null;
        this.filterLabel = null;
        this.listBtn = null;
    }
}
