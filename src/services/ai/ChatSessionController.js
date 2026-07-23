import { CHAT_PRESETS, DEFAULT_PRESET_ID, getPresetById } from './ChatPresets.js';

/**
 * Контроллер сессии чата.
 *
 * Одна ответственность: держит состояние диалога и оркестрирует
 * вызовы AiClient + сохранение в ChatHistoryStore. Не знает про DOM.
 *
 * Связь с UI — через слушателей (subscribe), а не через прямые ссылки.
 *
 * Состояние:
 *   - messages: список сообщений (с временным assistant-сообщением во время стриминга)
 *   - providerId: текущий image-провайдер (gemini-image/...)
 *   - presetId: текущий пресет промпта
 *   - settings: { systemPrompt, temperature, maxTokens }
 *   - status: 'idle' | 'streaming' | 'error'
 *   - error: string|null
 *
 * События для подписчиков (один колбэк на всё, для простоты):
 *   - 'state'        — любое изменение состояния (UI делает rerender)
 */

export const DEFAULT_SETTINGS = {
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 2000
};

const SETTINGS_STORAGE_KEY = 'moodboard.ai.chat.settings.v1';

export class ChatSessionController {
    /**
     * @param {object} deps
     * @param {import('./AiClient.js').AiClient} deps.aiClient
     * @param {import('./ChatHistoryStore.js').ChatHistoryStore} deps.historyStore
     * @param {Storage} [deps.settingsStorage]
     */
    constructor({ aiClient, historyStore, settingsStorage }) {
        this._client = aiClient;
        this._history = historyStore;
        this._settingsStorage = settingsStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this._listeners = new Set();
        this._abort = null;
        this._aborts = new Map();

        this._state = {
            messages: this._history.load().map((m) => (m.pending ? { ...m, pending: false, error: m.error || 'Прервано' } : m)),
            providerId: null,
            presetId: DEFAULT_PRESET_ID,
            settings: this._loadSettings(),
            status: 'idle',
            error: null,
            availableProviders: []
        };
    }

    getState() {
        return this._state;
    }

    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    setProvider(providerId) {
        if (!providerId || providerId === this._state.providerId) return;
        this._state = { ...this._state, providerId };
        this._emit();
    }

    setPreset(presetId) {
        const preset = getPresetById(presetId);
        const next = { ...this._state, presetId: preset.id };
        if (!this._state.settings.systemPrompt || this._isPresetSystemPrompt(this._state.settings.systemPrompt)) {
            next.settings = { ...this._state.settings, systemPrompt: preset.systemPrompt };
            this._saveSettings(next.settings);
        }
        this._state = next;
        this._emit();
    }

    updateSettings(patch) {
        const settings = { ...this._state.settings, ...patch };
        this._state = { ...this._state, settings };
        this._saveSettings(settings);
        this._emit();
    }

    setAvailableProviders(list) {
        this._state = { ...this._state, availableProviders: Array.isArray(list) ? list : [] };
        const enabled = this._state.availableProviders.filter((p) => p.enabled);
        if (enabled.length > 0 && !enabled.some((p) => p.id === this._state.providerId)) {
            this._state = { ...this._state, providerId: enabled[0].id };
        }
        this._emit();
    }

    clearHistory() {
        if (this._abort) this.abort();
        this._state = { ...this._state, messages: [], status: 'idle', error: null };
        this._history.save([]);
        this._emit();
    }

    abort() {
        for (const controller of this._aborts.values()) {
            try { controller.abort(); } catch { /* noop */ }
        }
        this._aborts.clear();
        this._abort = null;
    }

    /**
     * Отправляет user-сообщение и создаёт изображение через выбранный image-провайдер.
     * @param {string} text
     * @param {{provider?: string, widthRatio?: number, heightRatio?: number, model?: string, imageCount?: number}} [options]
     */
    async send(text, options = {}) {
        const trimmed = (text || '').trim();
        if (!trimmed) return;

        const provider = options.provider;
        if (!provider) throw new Error('Provider is required for image generation');
        const imageCount = normalizeImageCount(options.imageCount);
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const userMsg = makeMessage('user', trimmed);
        const assistantMsgs = Array.from({ length: imageCount }, (_, index) => makeMessage(
            'assistant',
            imageCount > 1 ? `Генерируется изображение ${index + 1} из ${imageCount}…` : '',
            { provider, pending: true, kind: 'image', batchId }
        ));

        this._state = {
            ...this._state,
            messages: [...this._state.messages, userMsg, ...assistantMsgs],
            status: 'streaming',
            error: null
        };
        this._history.save(this._state.messages);
        this._emit();

        const abort = new AbortController();
        this._aborts.set(batchId, abort);
        this._abort = abort;
        let lastError = null;

        try {
            await Promise.all(
                assistantMsgs.map((assistantMsg, index) => {
                    if (abort.signal.aborted) {
                        lastError = 'Отменено';
                        this._updateAssistant(assistantMsg.id, { error: lastError });
                        return Promise.resolve();
                    }

                    return this._client
                        .generateImage({
                            provider,
                            prompt: trimmed,
                            widthRatio: options.widthRatio,
                            heightRatio: options.heightRatio,
                            model: options.model,
                            referenceImages: options.referenceImages,
                            signal: abort.signal
                        })
                        .then((result) => {
                            this._updateAssistant(assistantMsg.id, {
                                error: null,
                                imageBase64: result.imageBase64,
                                mimeType: result.mimeType,
                                operationId: result.operationId,
                                content: imageCount > 1 ? `Изображение ${index + 1} из ${imageCount} добавлено на доску.` : ''
                            });
                        })
                        .catch((err) => {
                            const msg = err?.name === 'AbortError' ? 'Отменено' : (err?.message || 'Ошибка запроса');
                            lastError = msg;
                            this._updateAssistant(assistantMsg.id, { error: msg });
                        });
                })
            );
        } finally {
            this._aborts.delete(batchId);
            this._abort = this._aborts.size > 0 ? [...this._aborts.values()][this._aborts.size - 1] : null;
            const stillStreaming = this._state.messages.some((m) => m.pending);
            this._state = {
                ...this._state,
                status: stillStreaming ? 'streaming' : (lastError ? 'error' : 'idle'),
                error: stillStreaming ? this._state.error : lastError
            };
            this._history.save(this._state.messages);
            this._emit();
        }
    }

    _updateAssistant(id, { error, imageBase64, mimeType, operationId, content }) {
        const messages = this._state.messages.map((m) =>
            m.id === id
                ? {
                    ...m,
                    pending: false,
                    error: error || undefined,
                    imageBase64: imageBase64 || m.imageBase64,
                    mimeType: mimeType || m.mimeType,
                    operationId: operationId || m.operationId,
                    content: content ?? m.content
                }
                : m
        );
        this._state = {
            ...this._state,
            messages
        };
        this._history.save(messages);
        this._emit();
    }

    _emit() {
        for (const listener of this._listeners) {
            try { listener(this._state); } catch (err) { console.error('[ChatSession] listener error:', err); }
        }
    }

    _loadSettings() {
        if (!this._settingsStorage) return { ...DEFAULT_SETTINGS };
        try {
            const raw = this._settingsStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw) return { ...DEFAULT_SETTINGS };
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    _saveSettings(settings) {
        if (!this._settingsStorage) return;
        try {
            this._settingsStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch { /* noop */ }
    }

    _isPresetSystemPrompt(text) {
        return CHAT_PRESETS.some((p) => p.systemPrompt === text);
    }
}

function makeMessage(role, content, extra = {}) {
    return {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
        ts: Date.now(),
        ...extra
    };
}

function normalizeImageCount(value) {
    const count = Number.parseInt(value, 10);
    if (!Number.isFinite(count)) {
        return 1;
    }

    return Math.min(Math.max(count, 1), 4);
}
