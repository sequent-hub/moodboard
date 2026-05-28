/**
 * Композер: textarea + кнопка отправки.
 *
 * Одна ответственность: события ввода и отправки. Не знает про пиллы,
 * меню провайдеров и настройки — этим занимаются отдельные модули.
 *
 * Контракт колбэков:
 *   onSubmit(text)   — нажат Enter без Shift или клик по send в состоянии 'ready'
 *   onAbort()        — клик по send в состоянии 'streaming'
 */

export class ChatComposer {
    /**
     * @param {{ textarea: HTMLTextAreaElement, send: HTMLButtonElement, enhancePrompt?: HTMLButtonElement }} refs
     * @param {{ onSubmit: (text: string) => void, onAbort: () => void }} handlers
     */
    constructor(refs, handlers) {
        this._textarea = refs.textarea;
        this._send = refs.send;
        this._enhancePrompt = refs.enhancePrompt ?? null;
        this._handlers = handlers;
        this._listeners = [];
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
    }

    focus() {
        this._textarea.focus();
    }

    destroy() {
        for (const off of this._listeners) off();
        this._listeners = [];
    }

    _submit() {
        const text = this._textarea.value;
        const trimmed = text.trim();
        if (!trimmed || this._send.dataset.state === 'streaming') return;
        this._textarea.value = '';
        this._resizeTextarea();
        this._refreshSendState();
        this._handlers.onSubmit?.(trimmed);
    }

    _refreshSendState() {
        const hasText = this._textarea.value.trim().length > 0;
        this._send.dataset.state = hasText ? 'ready' : 'idle';
        this._send.disabled = false;
        if (this._enhancePrompt) {
            this._enhancePrompt.dataset.empty = hasText ? 'false' : 'true';
        }
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
