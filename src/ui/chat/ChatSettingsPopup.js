/**
 * Попап настроек чата (системный промпт, temperature, maxTokens, очистить историю).
 *
 * Одна ответственность: построить контент попапа, прокинуть значения
 * наружу при изменении, открывать/закрывать по триггеру.
 */

export class ChatSettingsPopup {
    /**
     * @param {{ trigger: HTMLElement, popup: HTMLElement }} refs
     * @param {{
     *   getSettings: () => { systemPrompt: string, temperature: number, maxTokens: number },
     *   onChange: (patch: object) => void,
     *   onClearHistory: () => void
     * }} handlers
     */
    constructor(refs, handlers) {
        this._trigger = refs.trigger;
        this._popup = refs.popup;
        this._handlers = handlers;
        this._listeners = [];
        this._docClickHandler = null;
        this._isOpen = false;
        this._fields = null;
    }

    attach() {
        this._buildContent();
        this._on(this._trigger, 'click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
    }

    refresh() {
        if (!this._fields) return;
        const s = this._handlers.getSettings?.() || {};
        if (document.activeElement !== this._fields.system) {
            this._fields.system.value = s.systemPrompt || '';
        }
        if (document.activeElement !== this._fields.temperature) {
            this._fields.temperature.value = formatNumber(s.temperature);
        }
        if (document.activeElement !== this._fields.maxTokens) {
            this._fields.maxTokens.value = String(s.maxTokens ?? '');
        }
    }

    toggle() {
        if (this._isOpen) this.close();
        else this.open();
    }

    open() {
        this.refresh();
        this._popup.classList.add('is-open');
        this._isOpen = true;
        this._docClickHandler = (e) => {
            if (!this._popup.contains(e.target) && !this._trigger.contains(e.target)) {
                this.close();
            }
        };
        document.addEventListener('mousedown', this._docClickHandler);
    }

    close() {
        if (!this._isOpen) return;
        this._popup.classList.remove('is-open');
        this._isOpen = false;
        if (this._docClickHandler) {
            document.removeEventListener('mousedown', this._docClickHandler);
            this._docClickHandler = null;
        }
    }

    destroy() {
        this.close();
        for (const off of this._listeners) off();
        this._listeners = [];
        this._fields = null;
    }

    _buildContent() {
        const fields = {};
        const fragment = document.createDocumentFragment();

        fragment.appendChild(this._buildField({
            label: 'Системный промпт',
            input: () => {
                const ta = document.createElement('textarea');
                ta.className = 'moodboard-chat__settings-textarea';
                ta.rows = 3;
                fields.system = ta;
                this._on(ta, 'change', () => this._handlers.onChange?.({ systemPrompt: ta.value }));
                return ta;
            }
        }));

        fragment.appendChild(this._buildField({
            label: 'Temperature (0–1)',
            input: () => {
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = '0.1';
                inp.min = '0';
                inp.max = '2';
                inp.className = 'moodboard-chat__settings-input';
                fields.temperature = inp;
                this._on(inp, 'change', () => {
                    const v = Number(inp.value);
                    if (!Number.isNaN(v)) this._handlers.onChange?.({ temperature: v });
                });
                return inp;
            }
        }));

        fragment.appendChild(this._buildField({
            label: 'Max tokens',
            input: () => {
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.step = '100';
                inp.min = '1';
                inp.className = 'moodboard-chat__settings-input';
                fields.maxTokens = inp;
                this._on(inp, 'change', () => {
                    const v = Number.parseInt(inp.value, 10);
                    if (!Number.isNaN(v) && v > 0) this._handlers.onChange?.({ maxTokens: v });
                });
                return inp;
            }
        }));

        const row = document.createElement('div');
        row.className = 'moodboard-chat__settings-popup-row';
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'moodboard-chat__settings-clear';
        clearBtn.textContent = 'Очистить историю';
        this._on(clearBtn, 'click', () => {
            this._handlers.onClearHistory?.();
            this.close();
        });
        row.appendChild(clearBtn);
        fragment.appendChild(row);

        this._popup.replaceChildren(fragment);
        this._fields = fields;
    }

    _buildField({ label, input }) {
        const wrap = document.createElement('div');
        wrap.className = 'moodboard-chat__settings-field';
        const labelEl = document.createElement('div');
        labelEl.className = 'moodboard-chat__settings-label';
        labelEl.textContent = label;
        wrap.appendChild(labelEl);
        wrap.appendChild(input());
        return wrap;
    }

    _on(el, type, handler) {
        el.addEventListener(type, handler);
        this._listeners.push(() => el.removeEventListener(type, handler));
    }
}

function formatNumber(n) {
    if (typeof n !== 'number' || Number.isNaN(n)) return '';
    return String(Math.round(n * 100) / 100);
}
