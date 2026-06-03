import { ICONS } from './icons.js';

export class ChatExtendedPromptModal {
    /**
     * @param {HTMLElement} container - workspace-контейнер
     * @param {HTMLTextAreaElement} sourceTextarea
     * @param {HTMLElement} triggerBtn
     */
    constructor(container, sourceTextarea, triggerBtn) {
        this._container = container;
        this._sourceTextarea = sourceTextarea;
        this._triggerBtn = triggerBtn;
        this._refs = null;
        this._listeners = [];
        this._isVisible = false;
    }

    attach() {
        this._refs = this._buildDom();
        this._container.appendChild(this._refs.overlay);

        this._on(this._triggerBtn, 'click', () => this.show());
        this._on(this._refs.closeBtn, 'click', () => this.hide());
        this._on(this._refs.overlay, 'click', (e) => {
            if (e.target === this._refs.overlay) this.hide();
        });

        this._on(this._refs.textarea, 'input', () => {
            this._sourceTextarea.value = this._refs.textarea.value;
            this._sourceTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        });

        this._on(this._refs.clearBtn, 'click', () => {
            this._refs.textarea.value = '';
            this._refs.textarea.focus();
            this._sourceTextarea.value = '';
            this._sourceTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    show() {
        this._refs.textarea.value = this._sourceTextarea.value;
        this._refs.overlay.classList.add('is-visible');
        this._isVisible = true;

        setTimeout(() => {
            this._refs.textarea.focus();
            this._refs.textarea.selectionStart = this._refs.textarea.value.length;
        }, 10);
    }

    hide() {
        this._refs.overlay.classList.remove('is-visible');
        this._isVisible = false;
        this._sourceTextarea.focus();
    }

    destroy() {
        for (const off of this._listeners) off();
        this._listeners = [];
        if (this._refs?.overlay && this._refs.overlay.parentNode === this._container) {
            this._container.removeChild(this._refs.overlay);
        }
        this._refs = null;
    }

    _on(el, type, handler) {
        el.addEventListener(type, handler);
        this._listeners.push(() => el.removeEventListener(type, handler));
    }

    _buildDom() {
        const overlay = document.createElement('div');
        overlay.className = 'moodboard-chat__extended-overlay';

        const modal = document.createElement('div');
        modal.className = 'moodboard-chat__extended-modal';

        const header = document.createElement('div');
        header.className = 'moodboard-chat__extended-header';

        const title = document.createElement('div');
        title.className = 'moodboard-chat__extended-title';
        title.textContent = 'Запрос';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'moodboard-chat__extended-close';
        closeBtn.innerHTML = ICONS.close || 'Закрыть';

        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'moodboard-chat__extended-body';

        const textarea = document.createElement('textarea');
        textarea.className = 'moodboard-chat__extended-textarea';
        textarea.placeholder = 'Опишите то, что хотите сгенерировать';

        const actions = document.createElement('div');
        actions.className = 'moodboard-chat__extended-actions';

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'moodboard-chat__extended-clear';
        clearBtn.textContent = 'Очистить';

        actions.appendChild(clearBtn);

        body.appendChild(textarea);
        body.appendChild(actions);

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);

        return { overlay, modal, header, title, closeBtn, body, textarea, clearBtn };
    }
}
