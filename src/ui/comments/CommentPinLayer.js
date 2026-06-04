import * as PIXI from 'pixi.js';
import { Events } from '../../core/events/Events.js';

const PIN_SIZE = 28;

/**
 * HTML-оверлей пинов комментариев. Перепроекция world→screen через toGlobal.
 */
export class CommentPinLayer {
    constructor(container, eventBus, core, commentService) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.commentService = commentService;
        this.layer = null;
        /** @type {Map<number, HTMLElement>} */
        this.pinEls = new Map();
        this._onReproject = () => this.reprojectAll();
        this._onPinClick = this._onPinClick.bind(this);
        this._onRemote = () => this.rebuild();
        /** Показывать ли resolved-пины. По умолчанию true. */
        this.showResolved = true;
        this._filterBtn = null;
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

        this._filterBtn = document.createElement('button');
        this._filterBtn.type = 'button';
        this._filterBtn.className = 'comment-pin-layer__filter-btn';
        this._filterBtn.addEventListener('click', () => {
            this.showResolved = !this.showResolved;
            this._syncFilterBtn();
            this._applyResolvedFilter();
        });
        this.layer.appendChild(this._filterBtn);
        this._syncFilterBtn();

        const ev = [
            [Events.Viewport.Changed, this._onReproject],
            [Events.Tool.PanUpdate, this._onReproject],
            [Events.UI.ZoomPercent, this._onReproject],
            [Events.Object.TransformUpdated, this._onReproject],
            [Events.Comment.RemoteUpdated, this._onRemote],
            [Events.Comment.PinCreated, this._onRemote],
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
        if (this._subs) {
            for (const [name, fn] of this._subs) this.eventBus.off(name, fn);
        }
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        this.pinEls.clear();
        this._filterBtn = null;
        if (this.layer) this.layer.remove();
        this.layer = null;
    }

    rebuild() {
        if (!this.layer) return;
        const threads = this.commentService.getAllThreads();
        const ids = new Set(threads.map((t) => Number(t.id)));
        for (const id of [...this.pinEls.keys()]) {
            if (!ids.has(id)) {
                this.pinEls.get(id)?.remove();
                this.pinEls.delete(id);
            }
        }
        for (const thread of threads) {
            this._ensurePinEl(thread);
        }
        this.reprojectAll();
        this._applyResolvedFilter();
    }

    _syncFilterBtn() {
        if (!this._filterBtn) return;
        this._filterBtn.textContent = this.showResolved ? 'Скрыть решённые' : 'Показать все';
        this._filterBtn.setAttribute('aria-pressed', String(!this.showResolved));
    }

    _applyResolvedFilter() {
        for (const [id, el] of this.pinEls) {
            const thread = this.commentService.getThread(id);
            if (!thread) continue;
            el.style.display = (!this.showResolved && thread.resolved) ? 'none' : '';
        }
    }

    reprojectAll() {
        for (const thread of this.commentService.getAllThreads()) {
            this._projectPin(thread);
        }
    }

    _ensurePinEl(thread) {
        const id = Number(thread.id);
        let el = this.pinEls.get(id);
        if (!el) {
            el = document.createElement('button');
            el.type = 'button';
            el.className = 'comment-pin';
            el.dataset.threadId = String(id);
            Object.assign(el.style, {
                position: 'absolute',
                pointerEvents: 'auto',
                borderRadius: '50%',
                border: '2px solid #7c4dff',
                background: '#fff',
                padding: '0',
                cursor: 'pointer',
                boxSizing: 'border-box',
            });
            el.addEventListener('click', this._onPinClick);
            this.layer.appendChild(el);
            this.pinEls.set(id, el);
        }
        el.classList.toggle('comment-pin--resolved', !!thread.resolved);
        const unread = thread.unread_count || 0;
        let badge = el.querySelector('.comment-pin__badge');
        if (unread > 0 && !thread.resolved) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'comment-pin__badge';
                el.appendChild(badge);
            }
            badge.textContent = unread > 99 ? '99+' : String(unread);
            badge.style.display = '';
        } else if (badge) {
            badge.style.display = 'none';
        }
        el.setAttribute('aria-label', thread.resolved ? 'Решённый комментарий' : 'Комментарий');
    }

    _onPinClick(e) {
        const id = Number(e.currentTarget?.dataset?.threadId);
        if (!Number.isFinite(id)) return;
        e.stopPropagation();
        this.eventBus.emit(Events.Comment.ThreadOpened, { threadId: id, pinEl: e.currentTarget });
    }

    _projectPin(thread) {
        const el = this.pinEls.get(Number(thread.id));
        if (!el) return;
        const worldPos = this.commentService.getThreadWorldPosition(thread, this.core);
        if (!worldPos) return;
        const screen = this._worldPointToCss(worldPos.x, worldPos.y);
        if (!screen) return;
        const left = Math.round(screen.left - PIN_SIZE / 2);
        const top = Math.round(screen.top - PIN_SIZE / 2);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${PIN_SIZE}px`;
        el.style.height = `${PIN_SIZE}px`;
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
