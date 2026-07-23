/**
 * Контроллер сессии генерации видео.
 *
 * Одна ответственность: оркестрирует submit -> poll-цикл через AiClient,
 * держит состояние джоба и уведомляет подписчиков об изменениях.
 * Не знает про DOM, доску и UI.
 *
 * Состояние:
 *   - status:   'idle' | 'submitting' | 'polling' | 'done' | 'error'
 *   - progress: number (0–100)
 *   - error:    string | null
 *   - jobId:    string | null
 *   - result:   { videoUrl: string, mimeType: string } | null
 */

const POLL_INTERVAL_MS = 3000;
const JOB_TIMEOUT_MS   = 300_000; // 300с — видео генерируется до нескольких минут

export class VideoSessionController {
    /**
     * @param {object} deps
     * @param {import('./AiClient.js').AiClient} deps.aiClient
     */
    constructor({ aiClient }) {
        this._client    = aiClient;
        this._listeners = new Set();
        this._abort     = null;

        this._state = {
            status:   'idle',
            progress: 0,
            error:    null,
            jobId:    null,
            result:   null,
        };
    }

    getState() {
        return this._state;
    }

    /**
     * @param {function} listener
     * @returns {function} unsubscribe
     */
    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    /**
     * Запускает джоб генерации видео.
     * @param {object} args
     * @param {string} args.provider
     * @param {string} args.prompt
     * @param {string} [args.negativePrompt]
     * @param {string} [args.model]
     * @param {string} [args.ratio]
     * @param {string} [args.resolution]
     * @param {number} [args.duration]
     * @param {number} [args.seed]
     * @param {File[]} [args.referenceImages]
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<void>}
     */
    async start({ provider, signal: externalSignal, ...rest } = {}) {
        if (this._abort) this.abort();

        const abort = new AbortController();
        this._abort = abort;
        const { signal } = abort;

        if (externalSignal) {
            if (externalSignal.aborted) { abort.abort(); return; }
            externalSignal.addEventListener('abort', () => abort.abort(), { once: true });
        }

        this._setState({ status: 'submitting', progress: 0, error: null, jobId: null, result: null });

        const timeoutId = setTimeout(() => {
            if (this._abort === abort) {
                abort.abort();
                this._setState({ status: 'error', error: 'Таймаут: джоб превысил 300 секунд' });
            }
        }, JOB_TIMEOUT_MS);

        try {
            const { jobId } = await this._client.submitVideo({ provider, signal, ...rest });
            if (signal.aborted) return;

            this._setState({ status: 'polling', jobId });

            const result = await this._pollLoop(jobId, signal, provider);
            if (!result || signal.aborted) return;

            const { videoUrl, mimeType } = result;
            this._setState({ status: 'done', progress: 100, result: { videoUrl, mimeType } });
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) return;
            this._setState({ status: 'error', error: err?.message || 'Ошибка запроса' });
        } finally {
            clearTimeout(timeoutId);
            if (this._abort === abort) this._abort = null;
        }
    }

    /** Прерывает submit или поллинг. */
    abort() {
        if (this._abort) {
            try { this._abort.abort(); } catch { /* noop */ }
            this._abort = null;
        }
    }

    async _pollLoop(jobId, signal, provider) {
        while (!signal.aborted) {
            await sleep(POLL_INTERVAL_MS, signal);
            if (signal.aborted) return null;

            let data;
            try {
                data = await this._client.pollVideo(jobId, signal, provider);
            } catch (err) {
                if (err?.name === 'AbortError' || signal.aborted) return null;
                this._setState({ status: 'error', error: err?.message || 'Ошибка поллинга' });
                return null;
            }

            const { status, progress, error } = data;

            if (status === 'done') return data;

            if (status === 'error') {
                this._setState({ status: 'error', error: error || 'Ошибка джоба' });
                return null;
            }

            // 'pending' | 'running' — обновляем прогресс
            this._setState({ progress: progress ?? this._state.progress });
        }
        return null;
    }

    _setState(patch) {
        this._state = { ...this._state, ...patch };
        this._emit();
    }

    _emit() {
        for (const listener of this._listeners) {
            try { listener(this._state); } catch (err) {
                console.error('[VideoSession] listener error:', err);
            }
        }
    }
}

/**
 * Promise, который разрешается через ms миллисекунд или отклоняется по AbortSignal.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const id = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(id);
            reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}
