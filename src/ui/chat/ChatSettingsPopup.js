/**
 * Попап доп-настроек генерации изображения + «Очистить историю».
 *
 * Секция изображения (seed, негативный промпт, фон, формат файла,
 * авто-расширение, водяной знак) — поля отображаются только когда текущая
 * модель изображения поддерживает соответствующую настройку.
 *
 * Видео-настройки в этой панели НЕ живут — они вынесены в тулбар
 * (см. ChatVideoToolbarPills). Поэтому кнопка-триггер скрывается целиком,
 * когда у текущей модели изображения нет ни одной поддерживаемой настройки.
 *
 * Одна ответственность: построить контент попапа, прокинуть значения
 * наружу при изменении, открывать/закрывать по триггеру.
 */

export class ChatSettingsPopup {
    /**
     * @param {{ trigger: HTMLElement, popup: HTMLElement }} refs
     * @param {{
     *   getSettings: () => {
     *     systemPrompt: string, temperature: number, maxTokens: number,
     *     seed: number|null, negativePrompt: string,
     *     background: string|null, outputFormat: string|null,
     *     promptExtend: boolean, watermark: boolean
     *   },
     *   getCapability?: () => import('../../services/ai/imageModelCapabilities.js').ImageModelCapability|null,
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
        // Обёртка секции доп-настроек — скрывается целиком, когда модель ничего не поддерживает
        this._imageGenSection = null;
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

        const imageVisible = this._refreshImageGenSection(s);

        // Кнопка-триггер видна только когда для текущей модели есть хотя бы
        // одна поддерживаемая настройка генерации изображения. Видео-настройки
        // живут в тулбаре (ChatVideoToolbarPills), не в этой панели.
        this._setTriggerVisible(imageVisible);
    }

    _setTriggerVisible(visible) {
        const host = this._trigger?.parentNode || this._trigger;
        if (host) host.style.display = visible ? 'inline-flex' : 'none';
        if (!visible && this._isOpen) this.close();
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
        this._imageGenSection = null;
    }

    _buildContent() {
        const fields = {};
        const fragment = document.createDocumentFragment();

        // Секция доп-настроек генерации изображения
        const imageGenSection = document.createElement('div');
        imageGenSection.className = 'moodboard-chat__settings-image-section';
        imageGenSection.style.display = 'none';

        const sectionDivider = document.createElement('div');
        sectionDivider.className = 'moodboard-chat__settings-divider';
        sectionDivider.style.cssText = 'border-top:1px solid #E5E7EB;margin:2px 0;';
        imageGenSection.appendChild(sectionDivider);

        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'moodboard-chat__settings-label';
        sectionTitle.textContent = 'Параметры генерации';
        sectionTitle.style.marginTop = '4px';
        imageGenSection.appendChild(sectionTitle);

        // Seed
        const seedField = this._buildField({
            label: 'Seed (число)',
            input: () => {
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.min = '0';
                inp.step = '1';
                inp.placeholder = 'Случайный';
                inp.className = 'moodboard-chat__settings-input';
                fields.seed = inp;
                this._on(inp, 'change', () => {
                    const raw = inp.value.trim();
                    const v = raw === '' ? null : Number.parseInt(raw, 10);
                    this._handlers.onChange?.({ seed: (v !== null && !Number.isNaN(v)) ? v : null });
                });
                return inp;
            }
        });
        seedField.dataset.imageGenField = 'seed';
        imageGenSection.appendChild(seedField);

        // Негативный промпт
        const negField = this._buildField({
            label: 'Негативный промпт',
            input: () => {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.placeholder = 'Что исключить из изображения';
                inp.className = 'moodboard-chat__settings-input';
                fields.negativePrompt = inp;
                this._on(inp, 'change', () => {
                    this._handlers.onChange?.({ negativePrompt: inp.value });
                });
                return inp;
            }
        });
        negField.dataset.imageGenField = 'negativePrompt';
        imageGenSection.appendChild(negField);

        // Фон (background)
        const bgField = this._buildField({
            label: 'Фон',
            input: () => {
                const sel = document.createElement('select');
                sel.className = 'moodboard-chat__settings-input';
                [
                    { value: '', label: 'По умолчанию' },
                    { value: 'opaque', label: 'Непрозрачный' },
                    { value: 'auto', label: 'Авто' }
                ].forEach(({ value, label }) => {
                    const opt = document.createElement('option');
                    opt.value = value;
                    opt.textContent = label;
                    sel.appendChild(opt);
                });
                fields.background = sel;
                this._on(sel, 'change', () => {
                    this._handlers.onChange?.({ background: sel.value || null });
                });
                return sel;
            }
        });
        bgField.dataset.imageGenField = 'background';
        imageGenSection.appendChild(bgField);

        // Формат файла (outputFormat)
        const fmtField = this._buildField({
            label: 'Формат файла',
            input: () => {
                const sel = document.createElement('select');
                sel.className = 'moodboard-chat__settings-input';
                [
                    { value: '', label: 'По умолчанию' },
                    { value: 'png', label: 'PNG' },
                    { value: 'jpeg', label: 'JPEG' },
                    { value: 'webp', label: 'WebP' }
                ].forEach(({ value, label }) => {
                    const opt = document.createElement('option');
                    opt.value = value;
                    opt.textContent = label;
                    sel.appendChild(opt);
                });
                fields.outputFormat = sel;
                this._on(sel, 'change', () => {
                    this._handlers.onChange?.({ outputFormat: sel.value || null });
                });
                return sel;
            }
        });
        fmtField.dataset.imageGenField = 'outputFormat';
        imageGenSection.appendChild(fmtField);

        // Авто-расширение промпта
        const extField = this._buildCheckboxField({
            label: 'Авто-расширение промпта',
            key: 'promptExtend',
            fields,
            onChange: (v) => this._handlers.onChange?.({ promptExtend: v })
        });
        extField.dataset.imageGenField = 'promptExtend';
        imageGenSection.appendChild(extField);

        // Водяной знак
        const wmField = this._buildCheckboxField({
            label: 'Водяной знак',
            key: 'watermark',
            fields,
            onChange: (v) => this._handlers.onChange?.({ watermark: v })
        });
        wmField.dataset.imageGenField = 'watermark';
        imageGenSection.appendChild(wmField);

        fragment.appendChild(imageGenSection);
        this._imageGenSection = imageGenSection;

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

    /**
     * Показывает/скрывает поля секции генерации и синхронизирует значения
     * в зависимости от текущих возможностей модели.
     */
    _refreshImageGenSection(s) {
        if (!this._imageGenSection || !this._fields) return false;
        const isImage = this._handlers.getContentType?.() === 'image';
        const cap = isImage ? (this._handlers.getCapability?.() ?? null) : null;
        const sup = cap?.supports ?? {};

        const anyVisible = !!(sup.seed || sup.negativePrompt || sup.background || sup.outputFormat || sup.promptExtend || sup.watermark);
        this._imageGenSection.style.display = anyVisible ? '' : 'none';

        // Показываем/скрываем отдельные поля по флагам
        for (const el of this._imageGenSection.querySelectorAll('[data-image-gen-field]')) {
            const flag = el.dataset.imageGenField;
            el.style.display = sup[flag] ? '' : 'none';
        }

        // Синхронизируем значения только если поле не активно
        if (sup.seed && document.activeElement !== this._fields.seed) {
            this._fields.seed.value = s.seed != null ? String(s.seed) : '';
        }
        if (sup.negativePrompt && document.activeElement !== this._fields.negativePrompt) {
            this._fields.negativePrompt.value = s.negativePrompt || '';
        }
        if (sup.background) {
            this._fields.background.value = s.background || '';
        }
        if (sup.outputFormat) {
            this._fields.outputFormat.value = s.outputFormat || '';
        }
        if (sup.promptExtend && this._fields.promptExtend) {
            this._fields.promptExtend.checked = Boolean(s.promptExtend);
        }
        if (sup.watermark && this._fields.watermark) {
            this._fields.watermark.checked = Boolean(s.watermark);
        }
        return anyVisible;
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

    _buildCheckboxField({ label, key, fields, onChange }) {
        const wrap = document.createElement('div');
        wrap.className = 'moodboard-chat__settings-field';
        wrap.style.flexDirection = 'row';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'moodboard-chat__settings-checkbox';
        fields[key] = cb;
        this._on(cb, 'change', () => onChange(cb.checked));

        const labelEl = document.createElement('label');
        labelEl.className = 'moodboard-chat__settings-label';
        labelEl.style.textTransform = 'none';
        labelEl.style.cursor = 'pointer';
        labelEl.textContent = label;

        wrap.appendChild(cb);
        wrap.appendChild(labelEl);
        return wrap;
    }

    _on(el, type, handler) {
        el.addEventListener(type, handler);
        this._listeners.push(() => el.removeEventListener(type, handler));
    }
}
