import { Events } from '../../core/events/Events.js';
import { formatTime, pluralize, stripHtml } from './commentFormat.js';

const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const CHECKMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>`;

/**
 * Боковая панель со списком всех тредов доски.
 * Открывается/закрывается по Events.Comment.ListOpened (toggle).
 */
export class CommentListPanel {
    constructor(container, eventBus, core, commentService) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.commentService = commentService;

        this._panel = null;
        this._body = null;
        this._isOpen = false;

        this._onListOpened = () => this.toggle();
        this._onUpdate = () => { if (this._isOpen) this._renderList(); };
    }

    attach() {
        this._panel = document.createElement('div');
        this._panel.className = 'moodboard-comments-list';
        this._panel.style.display = 'none';

        const header = document.createElement('div');
        header.className = 'moodboard-comments-list__header';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'moodboard-comments-list__close';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        closeBtn.innerHTML = CLOSE_SVG;
        closeBtn.addEventListener('click', () => this.hide());

        const title = document.createElement('span');
        title.className = 'moodboard-comments-list__title';
        title.textContent = 'Комментарии';

        header.appendChild(title);
        header.appendChild(closeBtn);

        this._body = document.createElement('div');
        this._body.className = 'moodboard-comments-list__body';

        this._panel.appendChild(header);
        this._panel.appendChild(this._body);
        this.container.appendChild(this._panel);

        this.eventBus.on(Events.Comment.ListOpened, this._onListOpened);
        this.eventBus.on(Events.Comment.RemoteUpdated, this._onUpdate);
        this.eventBus.on(Events.Comment.MessageAdded, this._onUpdate);
        this.eventBus.on(Events.Comment.Resolved, this._onUpdate);
        this.eventBus.on(Events.Comment.ThreadDeleted, this._onUpdate);
        this.eventBus.on(Events.Comment.PinCreated, this._onUpdate);
        this.eventBus.on(Events.Comment.ColorChanged, this._onUpdate);
    }

    destroy() {
        this.eventBus.off(Events.Comment.ListOpened, this._onListOpened);
        this.eventBus.off(Events.Comment.RemoteUpdated, this._onUpdate);
        this.eventBus.off(Events.Comment.MessageAdded, this._onUpdate);
        this.eventBus.off(Events.Comment.Resolved, this._onUpdate);
        this.eventBus.off(Events.Comment.ThreadDeleted, this._onUpdate);
        this.eventBus.off(Events.Comment.PinCreated, this._onUpdate);
        this.eventBus.off(Events.Comment.ColorChanged, this._onUpdate);
        if (this._panel) {
            this._panel.remove();
            this._panel = null;
        }
        this._body = null;
    }

    toggle() {
        if (this._isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (!this._panel) return;
        this._isOpen = true;
        this._panel.style.display = 'flex';
        this._renderList();
    }

    hide() {
        if (!this._panel) return;
        this._isOpen = false;
        this._panel.style.display = 'none';
    }

    _renderList() {
        if (!this._body) return;
        const threads = this.commentService.getAllThreads();
        this._body.replaceChildren();

        if (!threads || threads.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'moodboard-comments-list__empty';
            empty.textContent = 'Пока нет комментариев';
            this._body.appendChild(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const thread of threads) {
            fragment.appendChild(this._buildCard(thread));
        }
        this._body.appendChild(fragment);
    }

    _buildCard(thread) {
        const root = document.createElement('div');
        root.className = 'moodboard-comments-list__card' +
            (thread.resolved ? ' moodboard-comments-list__card--resolved' : '');
        root.addEventListener('click', (e) => this._onCardClick(e, thread));

        const firstMsg = thread.messages?.items?.[0];
        const currentUser = this.commentService.currentUser;
        const isSelf = currentUser?.id != null && thread.created_by != null &&
            String(thread.created_by) === String(currentUser.id);
        const authorName = firstMsg?.author_name || (isSelf ? 'Вы' : 'Участник');
        const timeStr = firstMsg?.created_at ? formatTime(firstMsg.created_at) : '';
        const content = stripHtml(firstMsg?.content || '');

        const colorDot = document.createElement('span');
        colorDot.className = 'moodboard-comments-list__card-dot';
        if (thread.color) colorDot.style.background = thread.color;

        const meta = document.createElement('div');
        meta.className = 'moodboard-comments-list__card-meta';

        const author = document.createElement('span');
        author.className = 'moodboard-comments-list__card-author';
        author.textContent = authorName;

        const time = document.createElement('span');
        time.className = 'moodboard-comments-list__card-time';
        time.textContent = timeStr;

        meta.appendChild(author);
        meta.appendChild(time);

        const top = document.createElement('div');
        top.className = 'moodboard-comments-list__card-top';
        top.appendChild(colorDot);
        top.appendChild(meta);

        const body = document.createElement('div');
        body.className = 'moodboard-comments-list__card-body';
        body.textContent = content;

        const replyCount = (thread.messages?.items?.length || 0) - 1;
        let repliesEl = null;
        if (replyCount > 0) {
            repliesEl = document.createElement('div');
            repliesEl.className = 'moodboard-comments-list__card-replies';
            repliesEl.textContent = `${replyCount} ${pluralize(replyCount, 'ответ', 'ответа', 'ответов')}`;
        }

        const actions = document.createElement('div');
        actions.className = 'moodboard-comments-list__card-actions';

        const resolveBtn = document.createElement('button');
        resolveBtn.type = 'button';
        resolveBtn.className = 'moodboard-comments-list__resolve-btn' +
            (thread.resolved ? ' moodboard-comments-list__resolve-btn--resolved' : '');
        resolveBtn.setAttribute('aria-label', thread.resolved ? 'Вернуть' : 'Решить');
        resolveBtn.innerHTML = CHECKMARK_SVG + `<span>${thread.resolved ? 'Вернуть' : 'Решить'}</span>`;
        resolveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.commentService.resolveThread(thread.id, !thread.resolved).catch(console.error);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'moodboard-comments-list__delete-btn';
        deleteBtn.setAttribute('aria-label', 'Удалить');
        deleteBtn.innerHTML = TRASH_SVG;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.commentService.deleteThread(thread.id).catch(console.error);
        });

        actions.appendChild(resolveBtn);
        actions.appendChild(deleteBtn);

        root.appendChild(top);
        root.appendChild(body);
        if (repliesEl) root.appendChild(repliesEl);
        root.appendChild(actions);

        return root;
    }

    _onCardClick(e, thread) {
        const pos = this.commentService.getThreadWorldPosition(thread, this.core);
        if (pos) {
            this.eventBus.emit(Events.UI.MinimapCenterOn, { worldX: pos.x, worldY: pos.y });
            this.eventBus.emit(Events.Viewport.Changed);
        }
        this.commentService.openThread(thread.id);
    }
}
