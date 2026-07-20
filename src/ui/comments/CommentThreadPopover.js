import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';
import { ChatComposer } from '../chat/ChatComposer.js';

const ARROW_UP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
const CHECKMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>`;

const PALETTE = ['#5B5FE9', '#1E88E5', '#00A88F', '#34A853', '#F2A600', '#F2622E', '#E5484D', '#9B51E0'];

function _pluralize(n, one, two, five) {
    const m = Math.abs(n) % 100;
    const m1 = m % 10;
    if (m >= 11 && m <= 19) return five;
    if (m1 === 1) return one;
    if (m1 >= 2 && m1 <= 4) return two;
    return five;
}

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
            wrap.className = 'comment-thread-msg';

            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'comment-thread-msg__avatar-wrap';
            if (msg.authorAvatar) {
                const img = document.createElement('img');
                img.className = 'comment-thread-msg__avatar';
                img.src = msg.authorAvatar;
                img.alt = '';
                avatarWrap.appendChild(img);
            } else {
                const initials = document.createElement('span');
                initials.className = 'comment-thread-msg__initials';
                initials.textContent = (msg.authorLabel || '?').charAt(0).toUpperCase();
                avatarWrap.appendChild(initials);
            }

            const col = document.createElement('div');
            col.className = 'comment-thread-msg__col';

            const meta = document.createElement('div');
            meta.className = 'comment-thread-msg__meta';
            const name = document.createElement('span');
            name.className = 'comment-thread-msg__name';
            name.textContent = msg.authorLabel || 'Участник';
            meta.appendChild(name);
            if (msg.created_at) {
                const time = document.createElement('span');
                time.className = 'comment-thread-msg__time';
                time.textContent = this._formatTime(msg.created_at);
                meta.appendChild(time);
            }

            const body = document.createElement('div');
            body.className = 'comment-thread-msg__body';
            body.textContent = msg.content || '';

            col.appendChild(meta);
            col.appendChild(body);
            wrap.appendChild(avatarWrap);
            wrap.appendChild(col);
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
            const diffMs = Date.now() - d.getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 1) return 'только что';
            if (diffMin < 60) return `${diffMin} ${_pluralize(diffMin, 'минуту', 'минуты', 'минут')} назад`;
            const diffH = Math.floor(diffMin / 60);
            if (diffH < 24) return `${diffH} ${_pluralize(diffH, 'час', 'часа', 'часов')} назад`;
            const diffD = Math.floor(diffH / 24);
            if (diffD < 8) return `${diffD} ${_pluralize(diffD, 'день', 'дня', 'дней')} назад`;
            return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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
        this._colorBtn = null;
        this._paletteEl = null;
        this._paletteOpen = false;
        this._onDocMouseDown = this._onDocMouseDown.bind(this);
        this._onThreadOpened = this._onThreadOpened.bind(this);
        this._onRemote = () => this._refreshIfOpen();
        this._onOpenDraftAt = this._onOpenDraftAt.bind(this);
        this._onOpenImageDraft = this._onOpenImageDraft.bind(this);
        this._onThreadDeleted = this._onThreadDeleted.bind(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'comment-thread-popover-layer';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            // Выше панелей свойств (text-properties-layer = 10050, *PropertiesPanel = 10000),
            // иначе открытый поверх объекта попап комментария оказывается под тулбаром свойств.
            zIndex: 10060,
        });
        this.container.appendChild(this.layer);

        this.eventBus.on(Events.Comment.ThreadOpened, this._onThreadOpened);
        this.eventBus.on(Events.Comment.RemoteUpdated, this._onRemote);
        this.eventBus.on(Events.Comment.MessageAdded, this._onRemote);
        this.eventBus.on(Events.Comment.OpenDraftAt, this._onOpenDraftAt);
        this.eventBus.on(Events.Comment.OpenImageDraft, this._onOpenImageDraft);
        this.eventBus.on(Events.Comment.ThreadDeleted, this._onThreadDeleted);
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
        this.eventBus.off(Events.Comment.OpenImageDraft, this._onOpenImageDraft);
        this.eventBus.off(Events.Comment.ThreadDeleted, this._onThreadDeleted);
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
        this.eventBus.emit(Events.Comment.DraftOpened, { x: worldPos.x, y: worldPos.y });
    }

    _onOpenDraftAt({ screenX, screenY }) {
        const worldLayer = this.core?.pixi?.worldLayer;
        if (!worldLayer) return;
        const local = worldLayer.toLocal(new PIXI.Point(screenX, screenY));
        this.openDraftAt({ x: local.x, y: local.y });
    }

    /**
     * Открывает черновик комментария, привязанный к центру объекта.
     * Если на объекте уже есть комментарии, смещает точку от занятых позиций.
     */
    _onOpenImageDraft({ objectId }) {
        if (!objectId) return;

        const posData = { objectId, position: null };
        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);

        if (!posData.position || !sizeData.size) return;

        const { x: left, y: top } = posData.position;
        const { width, height } = sizeData.size;

        const anchored = this.commentService.getAllThreads().filter(
            (t) => t.anchor_object_id === objectId
        );

        // anchor_dx/anchor_dy хранятся как смещение от top-left объекта,
        // поэтому центр = (width/2, height/2) в этом пространстве
        const { dx, dy } = this._findFreeCommentOffset(anchored, width / 2, height / 2);

        this.openDraftAt(
            { x: left + dx, y: top + dy },
            { anchor_object_id: objectId, anchor_dx: dx, anchor_dy: dy }
        );
    }

    /**
     * Ищет свободный anchor-offset от top-left объекта.
     * Начинает с центра (centerDx, centerDy), затем пробует 8 направлений шагами по 10px.
     * «Свободным» считается offset, удалённый от всех занятых не менее чем на 12px.
     */
    _findFreeCommentOffset(anchoredThreads, centerDx, centerDy) {
        const STEP = 10;
        const MIN_DIST = 12;

        const isFree = (dx, dy) => anchoredThreads.every((t) => {
            const ex = t.anchor_dx || 0;
            const ey = t.anchor_dy || 0;
            return Math.sqrt((dx - ex) ** 2 + (dy - ey) ** 2) >= MIN_DIST;
        });

        if (isFree(centerDx, centerDy)) return { dx: centerDx, dy: centerDy };

        const directions = [
            [1, 0], [0, 1], [-1, 0], [0, -1],
            [1, 1], [-1, 1], [1, -1], [-1, -1],
        ];

        for (let radius = 1; radius <= 20; radius++) {
            for (const [dirX, dirY] of directions) {
                const dx = centerDx + dirX * STEP * radius;
                const dy = centerDy + dirY * STEP * radius;
                if (isFree(dx, dy)) return { dx, dy };
            }
        }

        return { dx: centerDx + STEP, dy: centerDy };
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
        const wasDraft = this._draftWorld != null;
        this._draftWorld = null;
        if (this.popover) this.popover.style.display = 'none';
        this._closePalette();
        this._disarmOutsideClose();
        if (wasDraft) this.eventBus.emit(Events.Comment.DraftClosed, {});
        this.eventBus.emit(Events.Comment.PopoverClosed, {});
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
        // Смещение согласовано с _positionNearPinEl: wrap находится на -14px (PIN_SIZE/2)
        // от центра пина, попап — на +42px от левого края обёртки.
        const left = Math.round(pinLayer.left + 28);
        const top = Math.round(pinLayer.top - 14);
        this.popover.style.left = `${left}px`;
        this.popover.style.top = `${top}px`;
    }

    _positionNearPinEl(pinEl) {
        if (!this.popover || !pinEl) return;
        const wrap = pinEl.closest('.comment-pin-wrap') || pinEl;
        const left = Math.round(parseFloat(wrap.style.left || '0') + 42);
        const top = Math.round(parseFloat(wrap.style.top || '0'));
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
        el.className = 'comment-thread-popover';
        Object.assign(el.style, {
            position: 'absolute',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '280px',
            maxWidth: '360px',
        });

        // Шапка: [...] | ● | spacer | ✓ | ✕
        const header = document.createElement('div');
        header.className = 'comment-thread-popover__header';

        // Кнопка удаления треда
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'comment-thread-popover__delete-btn';
        deleteBtn.setAttribute('aria-label', 'Удалить тред');
        deleteBtn.innerHTML = TRASH_SVG;
        deleteBtn.addEventListener('click', () => this._onDeleteClick());

        // Обёртка кружка-цвета + всплывающая палитра
        const colorWrap = document.createElement('div');
        colorWrap.className = 'comment-thread-popover__color-wrap';

        const colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'comment-thread-popover__color-btn';
        colorBtn.setAttribute('aria-label', 'Цвет треда');
        colorBtn.style.background = PALETTE[0];
        this._colorBtn = colorBtn;

        const palette = document.createElement('div');
        palette.className = 'comment-thread-popover__palette';
        palette.hidden = true;
        for (const hex of PALETTE) {
            const sw = document.createElement('button');
            sw.type = 'button';
            sw.className = 'comment-thread-popover__palette-swatch';
            sw.style.background = hex;
            sw.dataset.color = hex;
            sw.addEventListener('click', () => {
                if (this.currentThreadId != null) {
                    this.commentService.setThreadColor(this.currentThreadId, hex).catch(console.error);
                }
                this._setActiveSwatchByColor(hex);
                this._closePalette();
            });
            palette.appendChild(sw);
        }
        this._paletteEl = palette;
        colorBtn.addEventListener('click', () => this._paletteOpen ? this._closePalette() : this._openPalette());
        colorWrap.appendChild(colorBtn);
        colorWrap.appendChild(palette);

        const spacer = document.createElement('div');
        spacer.style.flex = '1';

        const resolveBtn = document.createElement('button');
        resolveBtn.type = 'button';
        resolveBtn.className = 'comment-thread-popover__resolve';
        resolveBtn.setAttribute('aria-label', 'Отметить решённым');
        resolveBtn.innerHTML = CHECKMARK_SVG;
        resolveBtn.addEventListener('click', () => this._toggleResolve());

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'comment-thread-popover__close';
        close.textContent = '✕';
        close.addEventListener('click', () => this.hide());

        header.appendChild(deleteBtn);
        header.appendChild(colorWrap);
        header.appendChild(spacer);
        header.appendChild(resolveBtn);
        header.appendChild(close);

        const history = document.createElement('div');
        // Без moodboard-chat__history: его .is-visible в chat.css задаёт display:none.
        history.className = 'comment-thread-popover__history';

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
            this._resolveBtn.classList.toggle('comment-thread-popover__resolve--resolved', !!thread.resolved);
            this._resolveBtn.setAttribute('aria-label', thread.resolved ? 'Открыть снова' : 'Отметить решённым');
        }
        const titleEl = this.popover?.querySelector('.comment-thread-popover__title');
        if (titleEl) titleEl.textContent = thread.resolved ? 'Комментарий (решён)' : 'Комментарий';
        this._setActiveSwatchByColor(thread.color || null);
    }

    _setActiveSwatchByColor(color) {
        if (this._colorBtn) this._colorBtn.style.background = color || PALETTE[0];
        if (!this._paletteEl) return;
        for (const sw of this._paletteEl.querySelectorAll('.comment-thread-popover__palette-swatch')) {
            sw.classList.toggle('comment-thread-popover__palette-swatch--active', sw.dataset.color === color);
        }
    }

    _onThreadDeleted({ threadId }) {
        if (String(threadId) === String(this.currentThreadId)) {
            this.hide();
        }
    }

    async _onDeleteClick() {
        if (this.currentThreadId == null) return;
        try {
            await this.commentService.deleteThread(this.currentThreadId);
            this.hide();
        } catch (err) {
            console.error('Comment delete failed:', err);
        }
    }

    _renderMessages(messages) {
        this.messageList?.render(messages);
    }

    _toListMessage(m) {
        const uid = this.commentService.currentUser?.id;
        const isSelf = uid != null && m.user_id != null && String(m.user_id) === String(uid);
        const author = m.author_name || (isSelf ? 'Вы' : 'Участник');
        const cu = this.commentService.currentUser;
        const avatarUrl = m.author_avatar || (isSelf ? cu?.avatar || null : null);
        return {
            id: String(m.id),
            role: isSelf ? 'user' : 'assistant',
            content: this._stripHtml(m.content || ''),
            authorLabel: author,
            authorAvatar: avatarUrl || null,
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
                this.eventBus.emit(Events.Comment.DraftClosed, {});
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
        if (this.popover.contains(e.target)) {
            if (this._paletteOpen && !this._paletteEl?.contains(e.target) && !this._colorBtn?.contains(e.target)) {
                this._closePalette();
            }
            return;
        }
        this.hide();
    }

    _openPalette() {
        if (this._paletteEl) this._paletteEl.hidden = false;
        this._paletteOpen = true;
    }

    _closePalette() {
        if (this._paletteEl) this._paletteEl.hidden = true;
        this._paletteOpen = false;
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
