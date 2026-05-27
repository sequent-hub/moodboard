/**
 * Хранилище истории чата в localStorage.
 *
 * Одна ответственность: CRUD сообщений в localStorage по ключу.
 * Не зависит ни от UI, ни от транспорта — легко тестируется.
 *
 * Формат сообщения:
 *   { id, role: 'user'|'assistant'|'system', content, ts, provider? }
 */

const DEFAULT_KEY = 'moodboard.ai.chat.history.v1';
const MAX_MESSAGES = 200;

export class ChatHistoryStore {
    /**
     * @param {object} options
     * @param {Storage} [options.storage] - localStorage по умолчанию
     * @param {string} [options.key]
     * @param {number} [options.maxMessages]
     */
    constructor(options = {}) {
        this._storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this._key = options.key || DEFAULT_KEY;
        this._max = options.maxMessages || MAX_MESSAGES;
    }

    load() {
        if (!this._storage) return [];
        try {
            const raw = this._storage.getItem(this._key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    save(messages) {
        if (!this._storage) return;
        const trimmed = Array.isArray(messages)
            ? messages.slice(-this._max)
            : [];
        try {
            this._storage.setItem(this._key, JSON.stringify(trimmed));
        } catch {
            /* квоты/недоступность — игнорируем */
        }
    }

    clear() {
        if (!this._storage) return;
        try { this._storage.removeItem(this._key); } catch { /* noop */ }
    }
}
