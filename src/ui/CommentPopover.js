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
        this.header = null;
        this.body = null;
        this.footer = null;
        this.input = null;
        this.button = null;
        this.currentId = null;
        // Память комментариев: { [objectId]: string[] }
        this.commentsById = new Map();
        this._onDocMouseDown = this._onDocMouseDown.bind(this);
        this._onSubmit = this._onSubmit.bind(this);
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
            // По желанию можно очистить: this.commentsById.delete(objectId);
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
        this._renderBodyFor(id);
    }

    showFor(id) {
        if (!this.layer) return;
        if (!this.popover) {
            this.popover = this._createPopover();
            this.layer.appendChild(this.popover);
            document.addEventListener('mousedown', this._onDocMouseDown, true);
        }
        this.popover.style.display = 'flex';
        this.reposition();
        // автофокус в input
        if (this.input) this.input.focus();
    }

    hide() {
        this.currentId = null;
        if (this.popover) this.popover.style.display = 'none';
        document.removeEventListener('mousedown', this._onDocMouseDown, true);
    }

    _createPopover() {
        const el = document.createElement('div');
        el.className = 'comment-popover';
        Object.assign(el.style, { position: 'absolute', pointerEvents: 'auto', display: 'flex', flexDirection: 'column' });
        // Header
        this.header = document.createElement('div');
        this.header.className = 'comment-popover__header';
        const title = document.createElement('div');
        title.className = 'comment-popover__title';
        title.textContent = 'Комментарий';
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'comment-popover__close';
        close.textContent = '✕';
        close.addEventListener('click', () => this.hide());
        this.header.appendChild(title);
        this.header.appendChild(close);
        // Body
        this.body = document.createElement('div');
        this.body.className = 'comment-popover__body';
        Object.assign(this.body.style, { overflowY: 'auto', maxHeight: '240px' });
        // Footer
        this.footer = document.createElement('div');
        this.footer.className = 'comment-popover__footer';
        const form = document.createElement('form');
        form.className = 'comment-popover__form';
        form.addEventListener('submit', this._onSubmit);
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.placeholder = 'Напишите комментарий';
        this.input.className = 'comment-popover__input';
        this.button = document.createElement('button');
        this.button.type = 'submit';
        this.button.textContent = 'Добавить';
        this.button.className = 'comment-popover__button';
        form.appendChild(this.input);
        form.appendChild(this.button);
        this.footer.appendChild(form);

        el.appendChild(this.header);
        el.appendChild(this.body);
        el.appendChild(this.footer);
        return el;
    }

    _onDocMouseDown(e) {
        if (!this.popover || this.popover.style.display === 'none') return;
        // ИСПРАВЛЕНИЕ: Защита от null элементов
        if (this.popover && e.target && this.popover.contains(e.target)) return; // клик внутри окна — не закрываем
        this.hide();
    }

    _onSubmit(e) {
        e.preventDefault();
        if (!this.input || !this.currentId) return;
        const text = this.input.value.trim();
        if (!text) return;
        // Записываем в список комментов текущего объекта
        const list = this.commentsById.get(this.currentId) || [];
        list.push(text);
        this.commentsById.set(this.currentId, list);
        // Перерисовываем body
        this._renderBodyFor(this.currentId);
        this.input.value = '';
        this.input.focus();
        // В дальнейшем можно сохранить в объекте/сервере
    }

    _renderBodyFor(id) {
        if (!this.body) return;
        this.body.innerHTML = '';
        const list = this.commentsById.get(id) || [];
        list.forEach((text) => {
            const row = document.createElement('div');
            row.className = 'comment-popover__row';
            row.textContent = text;
            this.body.appendChild(row);
        });
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
        this.popover.style.minHeight = '180px';
    }
}
