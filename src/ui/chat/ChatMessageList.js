/**
 * Рендер ленты сообщений чата.
 *
 * Одна ответственность: превратить массив messages в DOM с автоскроллом.
 * Не управляет состоянием, не слушает события — только render(messages).
 */

const ROLE_LABELS = {
    user: 'Вы',
    assistant: 'Ассистент',
    system: 'Системный'
};

export class ChatMessageList {
    /**
     * @param {HTMLElement} root - контейнер с классом .moodboard-chat__history
     */
    constructor(root) {
        this._root = root;
        this._lastCount = 0;
    }

    /**
     * @param {Array<{id: string, role: string, content: string, pending?: boolean, error?: string}>} messages
     */
    render(messages) {
        const visible = messages.filter((m) => m.role !== 'system');

        if (visible.length === 0) {
            this._root.classList.remove('is-visible');
            this._root.replaceChildren();
            this._lastCount = 0;
            return;
        }

        this._root.classList.add('is-visible');

        const fragment = document.createDocumentFragment();
        for (const msg of visible) {
            fragment.appendChild(this._renderMessage(msg));
        }
        this._root.replaceChildren(fragment);

        if (visible.length !== this._lastCount) {
            this._scrollToBottom();
        } else {
            this._scrollToBottomIfNearBottom();
        }
        this._lastCount = visible.length;
    }

    _renderMessage(msg) {
        const wrap = document.createElement('div');
        wrap.className = `moodboard-chat__msg moodboard-chat__msg--${msg.role}`;
        if (msg.error) wrap.classList.add('moodboard-chat__msg--error');

        const role = document.createElement('div');
        role.className = 'moodboard-chat__msg-role';
        role.textContent = ROLE_LABELS[msg.role] || msg.role;
        wrap.appendChild(role);

        const body = document.createElement('div');
        body.className = 'moodboard-chat__msg-body';

        if (msg.error) {
            body.textContent = msg.error;
        } else if (msg.pending && !msg.content) {
            body.textContent = '…';
        } else {
            body.textContent = msg.content;
            if (msg.pending) {
                const cursor = document.createElement('span');
                cursor.className = 'moodboard-chat__msg-cursor';
                body.appendChild(cursor);
            }
        }

        wrap.appendChild(body);
        return wrap;
    }

    _scrollToBottom() {
        this._root.scrollTop = this._root.scrollHeight;
    }

    _scrollToBottomIfNearBottom() {
        const distanceFromBottom = this._root.scrollHeight - this._root.scrollTop - this._root.clientHeight;
        if (distanceFromBottom < 80) this._scrollToBottom();
    }
}
