import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';

const PIN_SIZE = 28;

/**
 * HTML-оверлей пинов комментариев. Перепроекция world→screen через toGlobal.
 *
 * Структура DOM каждого пина:
 *   <div.comment-pin-wrap>   ← positioned absolute, 28×28, pointer-events:none
 *     <button.comment-pin>   ← overflow:hidden (clip avatar), pointer-events:auto
 *       <img.comment-pin__avatar>  | или
 *       <span.comment-pin__initials>
 *     </button>
 *     <span.comment-pin__badge>   ← sibling кнопки, не клипируется её overflow
 *   </div>
 *
 * Такая структура позволяет добавить overflow:hidden на кнопку (для круглого аватара)
 * без обрезания бейджа, который позиционируется за пределами кнопки.
 */
export class CommentPinLayer {
    constructor(container, eventBus, core, commentService) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.commentService = commentService;
        this.layer = null;
        /** @type {Map<number, HTMLElement>} кнопки пинов */
        this.pinEls = new Map();
        /** @type {Map<number, HTMLElement>} wrapper-divы (positioned), родители кнопки + бейджа */
        this.pinWraps = new Map();
        this._onReproject = () => this.reprojectAll();
        this._onPinClick = this._onPinClick.bind(this);
        this._onPinPointerDown = this._onPinPointerDown.bind(this);
        this._onRemote = () => this.rebuild();
        /** Показывать ли resolved-пины. По умолчанию true. Управляется CommentsBar. */
        this.showResolved = true;
        this._onResolvedFilterChanged = ({ showResolved }) => {
            this.showResolved = !!showResolved;
            this._applyResolvedFilter();
        };
        /** true — последний pointerup завершил drag; следующий click должен быть проигнорирован */
        this._lastDragWasMoved = false;
        /** Черновой пин (показывается до создания первого сообщения треда) */
        this._draftWrap = null;
        this._onDraftOpened = this._onDraftOpened.bind(this);
        this._onDraftClosed = this._onDraftClosed.bind(this);
        /** @type {{ threadId: number, startClientX: number, startClientY: number, startWorldX: number, startWorldY: number, moved: boolean } | null} */
        this._activeDrag = null;
        this._docMoveHandler = null;
        this._docUpHandler = null;
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'comment-pin-layer';
        Object.assign(this.layer.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            zIndex: 22,
        });
        this.container.appendChild(this.layer);

        const ev = [
            [Events.Comment.ResolvedFilterChanged, this._onResolvedFilterChanged],
            [Events.Viewport.Changed, this._onReproject],
            [Events.Tool.PanUpdate, this._onReproject],
            [Events.UI.ZoomPercent, this._onReproject],
            [Events.Object.TransformUpdated, this._onReproject],
            [Events.Comment.RemoteUpdated, this._onRemote],
            [Events.Comment.PinCreated, this._onRemote],
            [Events.Comment.ThreadDeleted, this._onRemote],
            [Events.Comment.Resolved, this._onRemote],
            [Events.Comment.ColorChanged, this._onRemote],
            [Events.Comment.DraftOpened, this._onDraftOpened],
            [Events.Comment.DraftClosed, this._onDraftClosed],
        ];
        this._subs = ev;
        for (const [name, fn] of ev) this.eventBus.on(name, fn);

        if (typeof window !== 'undefined') {
            this._onResize = () => this._onReproject();
            window.addEventListener('resize', this._onResize);
        }

        this.rebuild();
    }

    destroy() {
        this._removeDragListeners();
        this._activeDrag = null;
        if (this._subs) {
            for (const [name, fn] of this._subs) this.eventBus.off(name, fn);
        }
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        this.pinEls.clear();
        this.pinWraps.clear();
        this._hideDraftPin();
        if (this.layer) this.layer.remove();
        this.layer = null;
    }

    rebuild() {
        if (!this.layer) return;
        const threads = this.commentService.getAllThreads();
        const ids = new Set(threads.map((t) => Number(t.id)));
        for (const id of [...this.pinWraps.keys()]) {
            if (!ids.has(id)) {
                this.pinWraps.get(id)?.remove();
                this.pinWraps.delete(id);
                this.pinEls.delete(id);
            }
        }
        for (const thread of threads) {
            this._ensurePinEl(thread);
        }
        this.reprojectAll();
        this._applyResolvedFilter();
    }

    _applyResolvedFilter() {
        for (const [id, wrap] of this.pinWraps) {
            const thread = this.commentService.getThread(id);
            if (!thread) continue;
            wrap.style.display = (!this.showResolved && thread.resolved) ? 'none' : '';
        }
    }

    reprojectAll() {
        for (const thread of this.commentService.getAllThreads()) {
            this._projectPin(thread);
        }
        this._projectDraftPin();
    }

    _ensurePinEl(thread) {
        const id = Number(thread.id);
        let wrap = this.pinWraps.get(id);
        let el = this.pinEls.get(id);

        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'comment-pin-wrap';
            wrap.style.pointerEvents = 'none';

            el = document.createElement('button');
            el.type = 'button';
            el.className = 'comment-pin';
            el.dataset.threadId = String(id);
            el.style.pointerEvents = 'auto';
            el.addEventListener('click', this._onPinClick);
            el.addEventListener('pointerdown', this._onPinPointerDown);

            wrap.appendChild(el);
            this.layer.appendChild(wrap);
            this.pinEls.set(id, el);
            this.pinWraps.set(id, wrap);
        }

        // Аватар автора: thread.author_avatar → currentUser.avatar (если автор текущий) → инициалы
        const cu = this.commentService.currentUser;
        const avatarUrl = thread.author_avatar ||
            (thread.created_by != null && cu?.id != null &&
             String(thread.created_by) === String(cu.id)
                ? cu.avatar || null
                : null);

        let img = el.querySelector('.comment-pin__avatar');
        let initials = el.querySelector('.comment-pin__initials');

        if (avatarUrl) {
            if (!img) {
                img = document.createElement('img');
                img.className = 'comment-pin__avatar';
                img.alt = '';
                el.insertBefore(img, el.firstChild);
            }
            img.src = avatarUrl;
            img.style.display = '';
            if (initials) initials.style.display = 'none';
        } else {
            if (img) img.style.display = 'none';
            if (!initials) {
                initials = document.createElement('span');
                initials.className = 'comment-pin__initials';
                el.insertBefore(initials, el.firstChild);
            }
            const name = thread.author_name || cu?.name || '';
            initials.textContent = name.charAt(0).toUpperCase() || '?';
            initials.style.display = '';
        }

        el.classList.toggle('comment-pin--resolved', !!thread.resolved);

        // Обводка цвета треда через CSS-переменную --pin-color.
        // Resolved-пин всегда зелёный (border-color задан классом comment-pin--resolved),
        // поэтому переменная применяется только к нерешённым пинам.
        if (thread.color && !thread.resolved) {
            el.style.setProperty('--pin-color', thread.color);
        } else {
            el.style.removeProperty('--pin-color');
        }

        // Зелёный индикатор-галочка для решённых тредов
        let resolvedBadge = wrap.querySelector('.comment-pin__resolved-badge');
        if (thread.resolved) {
            if (!resolvedBadge) {
                resolvedBadge = document.createElement('span');
                resolvedBadge.className = 'comment-pin__resolved-badge';
                resolvedBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
                wrap.appendChild(resolvedBadge);
            }
            resolvedBadge.style.display = '';
        } else if (resolvedBadge) {
            resolvedBadge.style.display = 'none';
        }

        // Бейдж — sibling кнопки внутри wrap; не клипируется overflow:hidden кнопки
        const unread = thread.unread_count || 0;
        let badge = wrap.querySelector('.comment-pin__badge');
        if (unread > 0 && !thread.resolved) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'comment-pin__badge';
                wrap.appendChild(badge);
            }
            badge.textContent = unread > 99 ? '99+' : String(unread);
            badge.style.display = '';
        } else if (badge) {
            badge.style.display = 'none';
        }

        el.setAttribute('aria-label', thread.resolved ? 'Решённый комментарий' : 'Комментарий');

        // Цвет пина через CSS-переменную; при null — дефолт из CSS
        wrap.style.setProperty('--pin-color', thread.color || '');
    }

    _onDraftOpened({ x, y }) {
        this._showDraftPin(x, y);
    }

    _onDraftClosed() {
        this._hideDraftPin();
    }

    _showDraftPin(worldX, worldY) {
        if (!this.layer) return;
        this._hideDraftPin();

        const wrap = document.createElement('div');
        wrap.className = 'comment-pin-wrap comment-pin-wrap--draft';
        wrap.style.pointerEvents = 'none';
        wrap.style.position = 'absolute';

        const btn = document.createElement('div');
        btn.className = 'comment-pin comment-pin--draft';

        const cu = this.commentService.currentUser;
        const avatarUrl = cu?.avatar || null;

        if (avatarUrl) {
            const img = document.createElement('img');
            img.className = 'comment-pin__avatar';
            img.src = avatarUrl;
            img.alt = '';
            btn.appendChild(img);
        } else {
            const initials = document.createElement('span');
            initials.className = 'comment-pin__initials';
            const name = cu?.name || '';
            initials.textContent = name.charAt(0).toUpperCase() || '?';
            btn.appendChild(initials);
        }

        wrap.appendChild(btn);
        this.layer.appendChild(wrap);
        this._draftWrap = wrap;
        this._draftWorld = { x: worldX, y: worldY };

        this._projectDraftPin();
    }

    _hideDraftPin() {
        if (this._draftWrap) {
            this._draftWrap.remove();
            this._draftWrap = null;
        }
        this._draftWorld = null;
    }

    _projectDraftPin() {
        if (!this._draftWrap || !this._draftWorld) return;
        const screen = this._worldPointToCss(this._draftWorld.x, this._draftWorld.y);
        if (!screen) return;
        const left = Math.round(screen.left - PIN_SIZE / 2);
        const top = Math.round(screen.top - PIN_SIZE / 2);
        this._draftWrap.style.left = `${left}px`;
        this._draftWrap.style.top = `${top}px`;
    }

    _onPinClick(e) {
        if (this._lastDragWasMoved) {
            this._lastDragWasMoved = false;
            return;
        }
        const id = Number(e.currentTarget?.dataset?.threadId);
        if (!Number.isFinite(id)) return;
        e.stopPropagation();
        this.eventBus.emit(Events.Comment.ThreadOpened, { threadId: id, pinEl: e.currentTarget });
    }

    _onPinPointerDown(e) {
        if (e.button !== 0) return;
        e.stopPropagation();
        const id = Number(e.currentTarget?.dataset?.threadId);
        if (!Number.isFinite(id)) return;
        const thread = this.commentService.getThread(id);
        if (!thread) return;
        const worldPos = this.commentService.getThreadWorldPosition(thread, this.core);
        this._activeDrag = {
            threadId: id,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startWorldX: worldPos?.x ?? thread.x,
            startWorldY: worldPos?.y ?? thread.y,
            moved: false,
        };
        this._docMoveHandler = (ev) => this._onDragMove(ev);
        this._docUpHandler = (ev) => this._onDragUp(ev);
        document.addEventListener('pointermove', this._docMoveHandler);
        document.addEventListener('pointerup', this._docUpHandler);
    }

    _onDragMove(e) {
        const drag = this._activeDrag;
        if (!drag) return;
        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        drag.moved = true;

        const containerRect = this.container.getBoundingClientRect();
        const worldPos = this._cssPointToWorld(
            e.clientX - containerRect.left,
            e.clientY - containerRect.top,
        );
        if (!worldPos) return;

        const thread = this.commentService.getThread(drag.threadId);
        if (!thread) return;
        // Мутируем напрямую (живой объект из Map) — только для визуального drag
        thread.x = worldPos.x;
        thread.y = worldPos.y;
        this._projectPin(thread);

        const el = this.pinEls.get(drag.threadId);
        if (el) el.style.cursor = 'grabbing';
    }

    _onDragUp(e) {
        const drag = this._activeDrag;
        this._removeDragListeners();
        this._activeDrag = null;
        if (!drag) return;

        const el = this.pinEls.get(drag.threadId);
        if (el) el.style.cursor = '';

        if (!drag.moved) return; // клик — click-событие обработает _onPinClick
        this._lastDragWasMoved = true;

        const thread = this.commentService.getThread(drag.threadId);
        if (!thread) return;

        let payload;
        if (thread.anchor_object_id && !thread.detached) {
            const pos = { objectId: thread.anchor_object_id, position: null };
            this.eventBus.emit(Events.Tool.GetObjectPosition, pos);
            if (pos.position) {
                payload = {
                    x: thread.x,
                    y: thread.y,
                    anchor_object_id: thread.anchor_object_id,
                    anchor_dx: thread.x - pos.position.x,
                    anchor_dy: thread.y - pos.position.y,
                };
            } else {
                payload = { x: thread.x, y: thread.y };
            }
        } else {
            payload = { x: thread.x, y: thread.y };
        }

        this.commentService.moveThread(drag.threadId, payload);
    }

    _removeDragListeners() {
        if (this._docMoveHandler) {
            document.removeEventListener('pointermove', this._docMoveHandler);
            this._docMoveHandler = null;
        }
        if (this._docUpHandler) {
            document.removeEventListener('pointerup', this._docUpHandler);
            this._docUpHandler = null;
        }
    }

    _projectPin(thread) {
        const wrap = this.pinWraps.get(Number(thread.id));
        if (!wrap) return;
        const worldPos = this.commentService.getThreadWorldPosition(thread, this.core);
        if (!worldPos) return;
        const screen = this._worldPointToCss(worldPos.x, worldPos.y);
        if (!screen) return;
        const left = Math.round(screen.left - PIN_SIZE / 2);
        const top = Math.round(screen.top - PIN_SIZE / 2);
        wrap.style.left = `${left}px`;
        wrap.style.top = `${top}px`;
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

    /** Зеркало _worldPointToCss: CSS-координата (относительно container) → world. */
    _cssPointToWorld(cssLeft, cssTop) {
        const worldLayer = this.core?.pixi?.worldLayer || this.core?.pixi?.app?.stage;
        const view = this.core?.pixi?.app?.view;
        if (!worldLayer || !view?.parentElement) return null;
        const containerRect = this.container.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;
        const gx = cssLeft - offsetLeft;
        const gy = cssTop - offsetTop;
        return worldLayer.toLocal(new PIXI.Point(gx, gy));
    }
}
