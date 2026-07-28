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

/** Пауза между опросами статуса генерации изображения. */
const IMAGE_POLL_INTERVAL_MS = 4000;

/** Предохранитель клиента: серверный дедлайн короче, но ждать бесконечно нельзя. */
const IMAGE_POLL_LIMIT_MS = 20 * 60 * 1000;

export class ChatSessionController {
    /**
     * @param {object} deps
     * @param {import('./AiClient.js').AiClient} deps.aiClient
     * @param {import('./ChatHistoryStore.js').ChatHistoryStore} deps.historyStore
     * @param {Storage} [deps.settingsStorage]
     * @param {string} [deps.moodboardId]
     */
    constructor({ aiClient, historyStore, settingsStorage, moodboardId }) {
        this._client = aiClient;
        this._history = historyStore;
        this._settingsStorage = settingsStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
        this._listeners = new Set();
        this._abort = null;
        this._aborts = new Map();
        this._moodboardId = moodboardId || null;
        this._pollingJobIds = new Set();
        this._resumeAbort = null;

        const messages = this._history.load().map(restoreLoadedMessage);

        this._state = {
            messages,
            providerId: null,
            presetId: DEFAULT_PRESET_ID,
            settings: this._loadSettings(),
            // Незавершённые генерации живут на сервере, поэтому чат сразу
            // возвращается в состояние ожидания, а не показывает «Прервано».
            status: messages.some((m) => m.pending) ? 'streaming' : 'idle',
            error: null,
            availableProviders: []
        };
    }

    getState() {
        return this._state;
    }

    /**
     * Привязка генераций к мудборду: по нему сервер отдаёт список задач,
     * когда локальной истории чата нет (другой браузер или устройство).
     */
    setMoodboardId(moodboardId) {
        this._moodboardId = moodboardId || null;
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
        this.abort();
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
        try { this._resumeAbort?.abort(); } catch { /* noop */ }
        this._resumeAbort = null;
    }

    /**
     * Помечает изображение как размещённое на холсте.
     *
     * Без этой отметки картинка, полученная при закрытом холсте, либо не попала
     * бы на доску вовсе, либо легла бы туда второй раз при каждом открытии.
     */
    markPlacedOnBoard(id) {
        this._patchMessage(id, { placedOnBoard: true }, { silent: true });
    }

    /**
     * Подхватывает генерации, запущенные раньше: из локальной истории (холст
     * закрыли и открыли снова) и из списка задач на сервере (перезагрузка
     * страницы, другой браузер).
     */
    async resumeActiveJobs() {
        for (const message of this._state.messages) {
            if (message.pending && message.jobId) {
                this._watchImageJob({
                    messageId: message.id,
                    jobId: message.jobId,
                    provider: message.provider,
                    doneContent: ''
                });
            }
        }

        await this._pullServerJobs();
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
            const errors = await Promise.all(
                assistantMsgs.map((assistantMsg, index) => this._generateImage({
                    assistantMsg,
                    provider,
                    prompt: trimmed,
                    widthRatio: options.widthRatio,
                    heightRatio: options.heightRatio,
                    model: options.model,
                    referenceImages: options.referenceImages,
                    signal: abort.signal,
                    doneContent: imageCount > 1 ? `Изображение ${index + 1} из ${imageCount} добавлено на доску.` : ''
                }))
            );
            lastError = errors.filter(Boolean).pop() || null;
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

    /**
     * Ставит задачу генерации и ждёт её результат опросом статуса.
     *
     * @returns {Promise<string|null>} текст ошибки или null при успехе
     */
    async _generateImage({ assistantMsg, provider, prompt, widthRatio, heightRatio, model, referenceImages, signal, doneContent }) {
        try {
            if (signal?.aborted) throw makeAbortError();

            const submitted = await this._client.submitImage({
                provider,
                prompt,
                widthRatio,
                heightRatio,
                model,
                moodboardId: this._moodboardId || undefined,
                referenceImages,
                signal
            });

            const jobId = submitted?.jobId;
            if (!jobId) throw new Error('Сервис генерации не вернул идентификатор задачи');

            // jobId попадает в историю до первого опроса: только по нему генерацию
            // можно подобрать после закрытия холста или перезагрузки страницы.
            this._patchMessage(assistantMsg.id, { jobId, provider }, { silent: true });

            await this._pollImageJob({ messageId: assistantMsg.id, jobId, provider, signal, doneContent });
            return null;
        } catch (err) {
            const message = err?.name === 'AbortError' ? 'Отменено' : (err?.message || 'Ошибка запроса');
            this._updateAssistant(assistantMsg.id, { error: message });
            return message;
        }
    }

    /**
     * Опрашивает задачу до результата. Ошибки уходят наверх — вызывающий решает,
     * писать их в сообщение (новая генерация) или молча пометить (возобновление).
     */
    async _pollImageJob({ messageId, jobId, provider, signal, doneContent }) {
        if (this._pollingJobIds.has(jobId)) return;
        this._pollingJobIds.add(jobId);
        const startedAt = Date.now();

        try {
            for (;;) {
                if (signal?.aborted) throw makeAbortError();

                const result = await this._client.pollImage(jobId, signal, provider);

                if (result?.status === 'done') {
                    this._updateAssistant(messageId, {
                        error: null,
                        imageUrl: result.imageUrl,
                        mimeType: result.mimeType,
                        operationId: jobId,
                        placedOnBoard: false,
                        content: doneContent ?? ''
                    });
                    return;
                }

                if (result?.status === 'error') {
                    throw new Error(result?.error || 'Генерация не удалась');
                }

                if (Date.now() - startedAt > IMAGE_POLL_LIMIT_MS) {
                    throw new Error('Генерация не завершилась за отведённое время');
                }

                await sleep(IMAGE_POLL_INTERVAL_MS, signal);
            }
        } finally {
            this._pollingJobIds.delete(jobId);
        }
    }

    /**
     * Возобновляет опрос уже поставленной задачи (собственного submit здесь нет).
     */
    _watchImageJob({ messageId, jobId, provider, doneContent }) {
        if (!jobId || this._pollingJobIds.has(jobId)) return;
        if (!this._resumeAbort) this._resumeAbort = new AbortController();
        const signal = this._resumeAbort.signal;

        void this._pollImageJob({ messageId, jobId, provider, signal, doneContent })
            .catch((err) => {
                const message = err?.name === 'AbortError' ? 'Отменено' : (err?.message || 'Ошибка запроса');
                this._updateAssistant(messageId, { error: message });
            })
            .finally(() => this._syncStreamingStatus());
    }

    /**
     * Добирает задачи, которых нет в локальной истории: она могла не сохраниться
     * (перезагрузка на другом устройстве) или быть очищенной.
     */
    async _pullServerJobs() {
        if (typeof this._client.listImageJobs !== 'function') return;

        let jobs = [];
        try {
            jobs = await this._client.listImageJobs({ moodboardId: this._moodboardId || undefined });
        } catch {
            // Недоступность серверной синхронизации не должна ломать чат.
            return;
        }

        const knownJobIds = new Set(this._state.messages.map((m) => m.jobId).filter(Boolean));
        const restored = [];

        for (const job of jobs) {
            if (!job?.jobId || knownJobIds.has(job.jobId)) continue;

            const isFinished = job.status === 'done' || job.status === 'error';
            restored.push(makeMessage('user', job.prompt || ''));
            restored.push(makeMessage('assistant', '', {
                provider: job.provider,
                kind: 'image',
                batchId: `job_${job.jobId}`,
                jobId: job.jobId,
                pending: !isFinished,
                ...(job.status === 'done'
                    ? { imageUrl: job.imageUrl, mimeType: job.mimeType, placedOnBoard: false }
                    : {}),
                ...(job.status === 'error'
                    ? { error: job.error || 'Генерация не удалась' }
                    : {})
            }));
        }

        if (restored.length === 0) return;

        const messages = [...this._state.messages, ...restored];
        this._state = { ...this._state, messages };
        this._history.save(messages);
        this._emit();

        for (const message of restored) {
            if (message.pending && message.jobId) {
                this._watchImageJob({
                    messageId: message.id,
                    jobId: message.jobId,
                    provider: message.provider,
                    doneContent: ''
                });
            }
        }

        this._syncStreamingStatus();
    }

    _syncStreamingStatus() {
        const streaming = this._state.messages.some((m) => m.pending);
        if (streaming === (this._state.status === 'streaming')) return;
        this._state = { ...this._state, status: streaming ? 'streaming' : 'idle' };
        this._emit();
    }

    _patchMessage(id, patch, { silent = false } = {}) {
        let changed = false;
        const messages = this._state.messages.map((m) => {
            if (m.id !== id) return m;
            changed = true;
            return { ...m, ...patch };
        });
        if (!changed) return;

        this._state = { ...this._state, messages };
        this._history.save(messages);
        if (!silent) this._emit();
    }

    _updateAssistant(id, { error, imageBase64, imageUrl, mimeType, operationId, content, placedOnBoard }) {
        const messages = this._state.messages.map((m) =>
            m.id === id
                ? {
                    ...m,
                    pending: false,
                    error: error || undefined,
                    imageBase64: imageBase64 || m.imageBase64,
                    imageUrl: imageUrl || m.imageUrl,
                    mimeType: mimeType || m.mimeType,
                    operationId: operationId || m.operationId,
                    content: content ?? m.content,
                    ...(placedOnBoard === undefined ? {} : { placedOnBoard })
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

/**
 * Общий экземпляр сессии на страницу.
 *
 * Холст можно закрыть и открыть заново — ChatWindow при этом создаётся с нуля.
 * Если бы сессия жила внутри него, опрос генерации умирал бы вместе с окном, а
 * два экземпляра писали бы историю в один ключ localStorage, затирая друг друга.
 */
let sharedSession = null;

export function getSharedChatSession(deps) {
    if (!sharedSession) {
        sharedSession = new ChatSessionController(deps);
    }
    return sharedSession;
}

export function resetSharedChatSession() {
    sharedSession = null;
}

/**
 * Восстанавливает сообщение из localStorage.
 *
 * @param {object} message
 */
function restoreLoadedMessage(message) {
    const restored = { ...message };
    const hasImage = Boolean(restored.imageUrl || restored.imageBase64);

    // Сообщения, записанные до появления флага, уже лежат на доске. Без этой
    // подстановки вся история хлынула бы на холст при первом же открытии.
    if (hasImage && restored.placedOnBoard === undefined) {
        restored.placedOnBoard = true;
    }

    // Незавершённую генерацию без jobId возобновить нечем: она жила только
    // внутри закрытой вкладки.
    if (restored.pending && !restored.jobId) {
        restored.pending = false;
        restored.error = restored.error || 'Прервано';
    }

    return restored;
}

function makeAbortError() {
    const error = new Error('Отменено');
    error.name = 'AbortError';
    return error;
}

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(makeAbortError());
            return;
        }
        const onAbort = () => {
            clearTimeout(timer);
            reject(makeAbortError());
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
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
