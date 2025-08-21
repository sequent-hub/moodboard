import { Events } from '../core/events/Events.js';

/**
 * CommentPopover — всплывающее окно для объектов типа comment
 */
export class CommentPopover {
    constructor(container, eventBus, core) {
        this.container = container;
        this.eventBus = eventBus;
        this.core = core;
        this.layer = null;
        this.popover = null;
        this.currentId = null;
        this._onDocMouseDown = this._onDocMouseDown.bind(this);
    }

    attach() {
        this.layer = document.createElement('div');
        this.layer.className = 'comment-popover-layer';
        Object.assign(this.layer.style, {
            position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: 25
        });
        this.container.appendChild(this.layer);

        // Подписки
        this.eventBus.on(Events.Tool.SelectionAdd, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionRemove, () => this.updateFromSelection());
        this.eventBus.on(Events.Tool.SelectionClear, () => this.hide());
        this.eventBus.on(Events.Tool.DragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.GroupDragUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.ResizeUpdate, () => this.reposition());
        this.eventBus.on(Events.Tool.RotateUpdate, () => this.reposition());
        this.eventBus.on(Events.UI.ZoomPercent, () => this.reposition());
        this.eventBus.on(Events.Tool.PanUpdate, () => this.reposition());
        this.eventBus.on(Events.Object.Deleted, ({ objectId }) => {
            if (this.currentId && objectId === this.currentId) this.hide();
        });
    }

    destroy() {
        this.hide();
        if (this.layer) this.layer.remove();
        this.layer = null;
    }

    updateFromSelection() {
        // Показываем только для одиночного выделения комментария
        const ids = this.core?.selectTool ? Array.from(this.core.selectTool.selectedObjects || []) : [];
        if (!ids || ids.length !== 1) { this.hide(); return; }
        const id = ids[0];
        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(id) : null;
        if (!pixi) { this.hide(); return; }
        const mb = pixi._mb || {};
        if (mb.type !== 'comment') { this.hide(); return; }
        this.currentId = id;
        this.showFor(id);
    }

    showFor(id) {
        if (!this.layer) return;
        if (!this.popover) {
            this.popover = this._createPopover();
            this.layer.appendChild(this.popover);
            document.addEventListener('mousedown', this._onDocMouseDown, true);
        }
        this.popover.style.display = 'block';
        this.reposition();
    }

    hide() {
        this.currentId = null;
        if (this.popover) this.popover.style.display = 'none';
        document.removeEventListener('mousedown', this._onDocMouseDown, true);
    }

    _createPopover() {
        const el = document.createElement('div');
        el.className = 'comment-popover';
        Object.assign(el.style, { position: 'absolute', pointerEvents: 'auto' });
        // Header
        const header = document.createElement('div');
        header.className = 'comment-popover__header';
        const title = document.createElement('div');
        title.className = 'comment-popover__title';
        title.textContent = 'Комментарий';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'comment-popover__close';
        close.textContent = '✕';
        close.addEventListener('click', () => this.hide());
        header.appendChild(title);
        header.appendChild(close);
        // Body (пустой, под содержание)
        const body = document.createElement('div');
        body.className = 'comment-popover__body';
        body.textContent = '';
        el.appendChild(header);
        el.appendChild(body);
        return el;
    }

    _onDocMouseDown(e) {
        if (!this.popover || this.popover.style.display === 'none') return;
        if (this.popover.contains(e.target)) return; // клик внутри окна — не закрываем
        this.hide();
    }

    reposition() {
        if (!this.popover || !this.currentId) return;
        const pixi = this.core?.pixi?.objects?.get ? this.core.pixi.objects.get(this.currentId) : null;
        if (!pixi) { this.hide(); return; }

        const b = pixi.getBounds(); // глобальные координаты PIXI
        const res = (this.core.pixi.app.renderer?.resolution) || 1;
        const view = this.core.pixi.app.view;
        const containerRect = this.container.getBoundingClientRect();
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;

        const left = offsetLeft + (b.x + b.width) / res + 12; // справа от объекта + зазор
        const top = offsetTop + b.y / res; // по верхнему краю

        this.popover.style.left = `${Math.round(left)}px`;
        this.popover.style.top = `${Math.round(top)}px`;
    }
}
