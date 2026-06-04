/**
 * Композер: textarea + кнопка отправки + вложения.
 *
 * Одна ответственность: события ввода и отправки. Не знает про пиллы,
 * меню провайдеров и настройки — этим занимаются отдельные модули.
 *
 * Контракт колбэков:
 *   onSubmit(text, attachments)  — нажат Enter без Shift или клик по send в состоянии 'ready'
 *   onAbort()                    — клик по send в состоянии 'streaming'
 */

const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12"><path stroke="currentColor" stroke-linecap="round" stroke-width="1.2" d="m2.5 2.5 7 7m0-7-7 7"></path></svg>`;

export class ChatComposer {
    /**
     * @param {{ textarea: HTMLTextAreaElement, send: HTMLButtonElement, attach: HTMLButtonElement, fileInput: HTMLInputElement, attachmentsPreview: HTMLElement, statusBar?: HTMLElement }} refs
     * @param {{ onSubmit: (text: string, attachments: File[]) => void, onAbort: () => void }} handlers
     */
    constructor(refs, handlers) {
        this._textarea = refs.textarea;
        this._send = refs.send;
        this._attach = refs.attach ?? null;
        this._fileInput = refs.fileInput ?? null;
        this._attachmentsPreview = refs.attachmentsPreview ?? null;
        this._statusBar = refs.statusBar ?? null;
        this._handlers = handlers;
        this._listeners = [];
        /**
         * Внутреннее хранилище вложений. `sourceObjectId` нужен для дедупа
         * reference-картинок, которые приходят из box-select / клика по объекту:
         * один объект на доске = одно превью в композере.
         * @type {{ file: File, sourceObjectId: string|null }[]}
         */
        this._attachments = [];
    }

    attach() {
        this._on(this._textarea, 'input', () => {
            this._resizeTextarea();
            this._refreshSendState();
        });
        this._on(this._textarea, 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                this._submit();
            }
        });
        this._on(this._send, 'click', () => {
            if (this._send.dataset.state === 'streaming') {
                this._handlers.onAbort?.();
            } else {
                this._submit();
            }
        });
        if (this._attach && this._fileInput) {
            this._on(this._attach, 'click', () => this._fileInput.click());
            this._on(this._fileInput, 'change', () => this._handleFileChange());
        }
        this._resizeTextarea();
        this._refreshSendState();
    }

    /**
     * Внешнее состояние стриминга — управляет иконкой кнопки send.
     * @param {'idle'|'streaming'} status
     */
    setStreaming(isStreaming) {
        if (isStreaming) {
            this._send.dataset.state = 'streaming';
            this._send.disabled = false;
        } else {
            this._refreshSendState();
        }
        if (this._statusBar) {
            this._statusBar.classList.toggle('is-visible', isStreaming);
            this._statusBar.classList.toggle('is-generating', isStreaming);
        }
    }

    focus() {
        this._textarea.focus();
    }

    /**
     * @param {File} file
     * @param {{ sourceObjectId?: string|null }} [options] — `sourceObjectId`
     *   передаётся для reference-картинок с доски; дубликаты по этому id игнорируются.
     */
    addAttachment(file, options = {}) {
        if (!file) return;
        const sourceObjectId = options?.sourceObjectId ?? null;
        if (sourceObjectId && this._attachments.some((entry) => entry.sourceObjectId === sourceObjectId)) {
            return;
        }
        this._attachments.push({ file, sourceObjectId });
        this._renderAttachmentsPreview();
        this._refreshSendState();
    }

    hasAttachmentForObject(sourceObjectId) {
        if (!sourceObjectId) return false;
        return this._attachments.some((entry) => entry.sourceObjectId === sourceObjectId);
    }

    /**
     * Удаляет превью конкретного объекта доски. Вызывается при снятии фокуса с изображения.
     * @param {string} sourceObjectId
     */
    removeAttachmentForObject(sourceObjectId) {
        if (!sourceObjectId) return;
        const before = this._attachments.length;
        this._attachments = this._attachments.filter((entry) => entry.sourceObjectId !== sourceObjectId);
        if (this._attachments.length !== before) {
            this._renderAttachmentsPreview();
            this._refreshSendState();
        }
    }

    /**
     * Удаляет все превью, добавленные с доски (sourceObjectId !== null).
     * Файловые вложения (скрепка) не затрагиваются.
     */
    removeAllBoardAttachments() {
        const before = this._attachments.length;
        this._attachments = this._attachments.filter((entry) => entry.sourceObjectId === null);
        if (this._attachments.length !== before) {
            this._renderAttachmentsPreview();
            this._refreshSendState();
        }
    }

    destroy() {
        for (const off of this._listeners) off();
        this._listeners = [];
        this._attachments = [];
    }

    _submit() {
        const text = this._textarea.value;
        const trimmed = text.trim();
        const hasAttachments = this._attachments.length > 0;
        if (!trimmed && !hasAttachments) return;
        if (this._send.dataset.state === 'streaming') return;
        const attachments = this._attachments.map((entry) => entry.file);
        this._handlers.onSubmit?.(trimmed, attachments);
    }

    _refreshSendState() {
        const hasText = this._textarea.value.trim().length > 0;
        const hasAttachments = this._attachments.length > 0;
        this._send.dataset.state = (hasText || hasAttachments) ? 'ready' : 'idle';
        this._send.disabled = false;
    }

    _handleFileChange() {
        const files = Array.from(this._fileInput.files || []);
        if (!files.length) return;
        for (const file of files) {
            this._attachments.push({ file, sourceObjectId: null });
        }
        this._fileInput.value = '';
        this._renderAttachmentsPreview();
        this._refreshSendState();
    }

    _renderAttachmentsPreview() {
        const container = this._attachmentsPreview;
        if (!container) return;

        container.innerHTML = '';
        const inputRow = container.closest('.moodboard-chat__input-row');
        if (this._attachments.length === 0) {
            container.classList.remove('is-visible');
            inputRow?.classList.remove('has-attachments');
            this._textarea.placeholder = 'Опишите то, что хотите сгенерировать';
            return;
        }

        container.classList.add('is-visible');
        inputRow?.classList.add('has-attachments');
        this._textarea.placeholder = 'Опишите правку, изменение или стилевое направление эталонного изображения';
        for (let i = 0; i < this._attachments.length; i++) {
            const entry = this._attachments[i];
            const item = this._buildAttachmentItem(entry.file, i);
            container.appendChild(item);
        }
    }

    _buildAttachmentItem(file, index) {
        const item = document.createElement('div');
        item.className = 'moodboard-chat__attachment-item';
        item.title = file.name;

        const isImage = file.type.startsWith('image/');

        if (isImage) {
            const img = document.createElement('img');
            img.className = 'moodboard-chat__attachment-thumb';
            img.alt = file.name;
            const url = URL.createObjectURL(file);
            img.src = url;
            img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
            item.appendChild(img);
        } else {
            const icon = document.createElement('div');
            icon.className = 'moodboard-chat__attachment-icon';
            const ext = file.name.split('.').pop()?.toUpperCase() ?? '?';
            icon.textContent = ext;
            item.appendChild(icon);
        }

        const badge = document.createElement('div');
        badge.className = 'moodboard-chat__attachment-badge';
        badge.textContent = String(index + 1);
        item.appendChild(badge);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'moodboard-chat__attachment-remove';
        remove.setAttribute('aria-label', `Удалить ${file.name}`);
        remove.innerHTML = CLOSE_SVG;
        remove.addEventListener('click', () => {
            this._attachments.splice(index, 1);
            this._renderAttachmentsPreview();
            this._refreshSendState();
        });
        item.appendChild(remove);

        return item;
    }

    _resizeTextarea() {
        this._textarea.style.height = 'auto';
        const nextHeight = Math.max(47, Math.ceil(this._textarea.scrollHeight));
        this._textarea.style.height = `${nextHeight}px`;
    }

    _on(el, type, handler) {
        el.addEventListener(type, handler);
        this._listeners.push(() => el.removeEventListener(type, handler));
    }
}
