import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { ChatComposer } from '../chat/ChatComposer.js';

const ARROW_UP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;

/** Лента сообщений треда (структура как ChatMessageList, автор вместо роли). */
class CommentMessageList {
    constructor(root) {
        this._root = root;
        this._lastCount = 0;
    }

    render(messages) {
        if (!messages.length) {
            this._root.classList.remove('is-visible');
            this._root.replaceChildren();
            this._lastCount = 0;
            return;
        }
        this._root.classList.add('is-visible');
        const fragment = document.createDocumentFragment();
        for (const msg of messages) {
            const wrap = document.createElement('div');
            wrap.className = 'moodboard-chat__msg moodboard-chat__msg--user';
            const role = document.createElement('div');
            role.className = 'moodboard-chat__msg-role';
            role.textContent = msg.authorLabel || 'Участник';
            const body = document.createElement('div');
            body.className = 'moodboard-chat__msg-body';
            body.textContent = msg.content || '';
            if (msg.created_at) {
                const time = document.createElement('div');
                time.className = 'comment-thread-popover__time';
                time.textContent = this._formatTime(msg.created_at);
                wrap.appendChild(role);
                wrap.appendChild(time);
            } else {
                wrap.appendChild(role);
            }
            wrap.appendChild(body);
            fragment.appendChild(wrap);
        }
        this._root.replaceChildren(fragment);
        if (messages.length !== this._lastCount) {
            this._root.scrollTop = this._root.scrollHeight;
        }
        this._lastCount = messages.length;
    }

    _formatTime(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
        } catch (_) {
            return '';
        }
    }
}

/**
 * Popover треда комментариев (замена CommentPopover).
 */
export class CommentThreadPopover {
    constructor(container, eventBus, core, commentService) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.commentService = commentService;
        this.layer = null;
        this.popover = null;
        this.messageList = null;
        this.composer = null;
        this.currentThreadId = null;
        this._draftWorld = null;
        this._onDocMouseDown = this._onDocMouseDown.bind(this);
        this._onThreadOpened = this._onThreadOpened.bind(this);
        this._onRemote = () => this._refreshIfOpen();
        this._onOpenDraftAt = this._onOpenDraftAt.bind(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'comment-thread-popover-layer';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            zIndex: 26,
        });
        this.container.appendChild(this.layer);

        this.eventBus.on(Events.Comment.ThreadOpened, this._onThreadOpened);
        this.eventBus.on(Events.Comment.RemoteUpdated, this._onRemote);
        this.eventBus.on(Events.Comment.MessageAdded, this._onRemote);
        this.eventBus.on(Events.Comment.OpenDraftAt, this._onOpenDraftAt);
        this.eventBus.on(Events.Viewport.Changed, () => this.reposition());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.reposition());
        this.eventBus.on(Events.UI.ZoomPercent, () => this.reposition());
    }

    destroy() {
        this.hide();
        this.eventBus.off(Events.Comment.ThreadOpened, this._onThreadOpened);
        this.eventBus.off(Events.Comment.RemoteUpdated, this._onRemote);
        this.eventBus.off(Events.Comment.MessageAdded, this._onRemote);
        this.eventBus.off(Events.Comment.OpenDraftAt, this._onOpenDraftAt);
        if (this.layer) this.layer.remove();
        this.layer = null;
        if (this.composer) this.composer.destroy();
    }

    openDraftAt(worldPos, anchor = null) {
        this._draftWorld = { ...worldPos, anchor };
        this.currentThreadId = null;
        this._showPopover('Новый комментарий');
        this._renderMessages([]);
        this.repositionAtWorld(worldPos.x, worldPos.y);
        this.composer?.focus();
    }

    _onOpenDraftAt({ screenX, screenY }) {
        const worldLayer = this.core?.pixi?.worldLayer;
        if (!worldLayer) return;
        const local = worldLayer.toLocal(new PIXI.Point(screenX, screenY));
        this.openDraftAt({ x: local.x, y: local.y });
    }

    _onThreadOpened({ threadId, pinEl }) {
        if (threadId == null && this._draftWorld) return;
        this._draftWorld = null;
        this.currentThreadId = threadId;
        const thread = this.commentService.getThread(threadId);
        if (!thread) return;
        this._showPopover(thread.resolved ? 'Комментарий (решён)' : 'Комментарий');
        this._renderThread(thread);
        if (pinEl) {
            this._positionNearPinEl(pinEl);
        } else {
            const pos = this.commentService.getThreadWorldPosition(thread, this.core);
            if (pos) this.repositionAtWorld(pos.x, pos.y);
        }
        this.composer?.focus();
    }

    hide() {
        this.currentThreadId = null;
        this._draftWorld = null;
        if (this.popover) this.popover.style.display = 'none';
        this._disarmOutsideClose();
    }

    reposition() {
        if (!this.popover || this.popover.style.display === 'none') return;
        if (this._draftWorld) {
            this.repositionAtWorld(this._draftWorld.x, this._draftWorld.y);
            return;
        }
        if (this.currentThreadId == null) return;
        const thread = this.commentService.getThread(this.currentThreadId);
        const pos = this.commentService.getThreadWorldPosition(thread, this.core);
        if (pos) this.repositionAtWorld(pos.x, pos.y);
    }

    repositionAtWorld(worldX, worldY) {
        if (!this.popover) return;
        const pinLayer = this._worldPointToCss(worldX, worldY);
        if (!pinLayer) return;
        const left = Math.round(pinLayer.left + 16);
        const top = Math.round(pinLayer.top);
        this.popover.style.left = `${left}px`;
        this.popover.style.top = `${top}px`;
    }

    _positionNearPinEl(pinEl) {
        if (!this.popover || !pinEl) return;
        const left = Math.round(parseFloat(pinEl.style.left || '0') + 32);
        const top = Math.round(parseFloat(pinEl.style.top || '0'));
        this.popover.style.left = `${left}px`;
        this.popover.style.top = `${top}px`;
    }

    _showPopover(title) {
        if (!this.layer) return;
        if (!this.popover) {
            this.popover = this._createPopover();
            this.layer.appendChild(this.popover);
        }
        const titleEl = this.popover.querySelector('.comment-thread-popover__title');
        if (titleEl) titleEl.textContent = title;
        this.popover.classList.toggle('comment-thread-popover--draft', this.currentThreadId == null);
        this.popover.style.display = 'flex';
        this._armOutsideClose();
    }

    /**
     * Подписка на закрытие по клику снаружи откладывается на следующий тик:
     * попап открывается на pointerdown, а нативный mousedown того же клика
     * приходит сразу после — без задержки он бы мгновенно закрыл попап.
     */
    _armOutsideClose() {
        this._disarmOutsideClose();
        this._outsideCloseTimer = setTimeout(() => {
            this._outsideCloseTimer = null;
            document.addEventListener('mousedown', this._onDocMouseDown, true);
        }, 0);
    }

    _disarmOutsideClose() {
        if (this._outsideCloseTimer) {
            clearTimeout(this._outsideCloseTimer);
            this._outsideCloseTimer = null;
        }
        document.removeEventListener('mousedown', this._onDocMouseDown, true);
    }

    _createPopover() {
        const el = document.createElement('div');
        el.className = 'comment-thread-popover moodboard-chat';
        Object.assign(el.style, {
            position: 'absolute',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '280px',
            maxWidth: '360px',
        });

        const header = document.createElement('div');
        header.className = 'comment-thread-popover__header';
        const title = document.createElement('div');
        title.className = 'comment-thread-popover__title moodboard-chat__msg-role';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'comment-thread-popover__close';
        close.textContent = '✕';
        close.addEventListener('click', () => this.hide());
        const resolveBtn = document.createElement('button');
        resolveBtn.type = 'button';
        resolveBtn.className = 'comment-thread-popover__resolve';
        resolveBtn.textContent = 'Resolve';
        resolveBtn.addEventListener('click', () => this._toggleResolve());
        header.appendChild(title);
        header.appendChild(resolveBtn);
        header.appendChild(close);

        const history = document.createElement('div');
        history.className = 'moodboard-chat__history comment-thread-popover__history';

        const footer = document.createElement('div');
        footer.className = 'moodboard-chat__input-row comment-thread-popover__footer';
        const textarea = document.createElement('textarea');
        textarea.className = 'moodboard-chat__textarea';
        textarea.placeholder = 'Напишите комментарий…';
        textarea.rows = 2;
        const send = document.createElement('button');
        send.type = 'button';
        send.className = 'moodboard-chat__send';
        send.dataset.state = 'ready';
        send.innerHTML = ARROW_UP_SVG;
        footer.appendChild(textarea);
        footer.appendChild(send);

        el.appendChild(header);
        el.appendChild(history);
        el.appendChild(footer);

        this.messageList = new CommentMessageList(history);
        this.composer = new ChatComposer(
            { textarea, send },
            {
                onSubmit: (text) => this._onSubmit(text),
                onAbort: () => {},
            }
        );
        this.composer.attach();
        this._resolveBtn = resolveBtn;
        return el;
    }

    _renderThread(thread) {
        const messages = (thread.messages?.items || []).map((m) => this._toListMessage(m));
        this._renderMessages(messages);
        if (this._resolveBtn) {
            this._resolveBtn.textContent = thread.resolved ? 'Открыть снова' : 'Resolve';
        }
    }

    _renderMessages(messages) {
        this.messageList?.render(messages);
    }

    _toListMessage(m) {
        const uid = this.commentService.currentUser?.id;
        const isSelf = uid != null && m.user_id != null && String(m.user_id) === String(uid);
        const author = m.author_name || (isSelf ? 'Вы' : 'Участник');
        return {
            id: String(m.id),
            role: isSelf ? 'user' : 'assistant',
            content: this._stripHtml(m.content || ''),
            authorLabel: author,
            created_at: m.created_at,
        };
    }

    _stripHtml(html) {
        if (!html || typeof html !== 'string') return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || '').trim();
    }

    async _onSubmit(text) {
        const trimmed = text.trim();
        if (!trimmed) return;
        try {
            if (this._draftWorld) {
                const payload = {
                    x: this._draftWorld.x,
                    y: this._draftWorld.y,
                    content: trimmed,
                };
                const anchor = this._draftWorld.anchor;
                if (anchor?.anchor_object_id) {
                    payload.anchor_object_id = anchor.anchor_object_id;
                    payload.anchor_dx = anchor.anchor_dx;
                    payload.anchor_dy = anchor.anchor_dy;
                }
                const thread = await this.commentService.createThread(payload);
                this._draftWorld = null;
                this.currentThreadId = thread?.id ?? null;
                if (thread) {
                    if (this.popover) this.popover.classList.remove('comment-thread-popover--draft');
                    this._renderThread(thread);
                }
            } else if (this.currentThreadId != null) {
                await this.commentService.addReply(this.currentThreadId, trimmed);
                const thread = this.commentService.getThread(this.currentThreadId);
                if (thread) this._renderThread(thread);
            }
        } catch (err) {
            console.error('Comment submit failed:', err);
        }
    }

    async _toggleResolve() {
        if (this.currentThreadId == null) return;
        const thread = this.commentService.getThread(this.currentThreadId);
        if (!thread) return;
        try {
            await this.commentService.resolveThread(this.currentThreadId, !thread.resolved);
            const updated = this.commentService.getThread(this.currentThreadId);
            if (updated) this._renderThread(updated);
        } catch (err) {
            console.error('Comment resolve failed:', err);
        }
    }

    _refreshIfOpen() {
        if (this.popover?.style.display === 'none') return;
        if (this.currentThreadId != null) {
            const thread = this.commentService.getThread(this.currentThreadId);
            if (thread) this._renderThread(thread);
        }
    }

    _onDocMouseDown(e) {
        if (!this.popover || this.popover.style.display === 'none') return;
        if (this.popover.contains(e.target)) return;
        this.hide();
    }

    _worldPointToCss(worldX, worldY) {
        const worldLayer = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
        const view = this.core?.pixi?.app?.view;
        if (!worldLayer || !view?.parentElement) return null;
        const containerRect = this.container.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;
        const g = worldLayer.toGlobal(new PIXI.Point(worldX, worldY));
        return { left: offsetLeft + g.x, top: offsetTop + g.y };
    }
}
