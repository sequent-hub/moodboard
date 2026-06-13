/**
 * Контроллер сессии генерации 3D-модели (Hunyuan 3D).
 *
 * Одна ответственность: оркестрирует submit -> poll-цикл через AiClient,
 * держит состояние джоба и уведомляет подписчиков об изменениях.
 * Не знает про DOM, доску и UI.
 *
 * Состояние:
 *   - status: 'idle' | 'submitting' | 'polling' | 'done' | 'error'
 *   - progress: number (0–100)
 *   - stage: 'geometry' | 'texture' | 'convert' | null
 *   - error: string | null
 *   - jobId: string | null
 *   - result: { previewBase64, mimeType, modelUrl, format } | null
 */

const POLL_INTERVAL_MS = 2500;
const JOB_TIMEOUT_MS = 600_000; // 600с: покрывает оба джоба (генерация + конвертация)

export class Model3dSessionController {
    /**
     * @param {object} deps
     * @param {import('./AiClient.js').AiClient} deps.aiClient
     */
    constructor({ aiClient }) {
        this._client = aiClient;
        this._listeners = new Set();
        this._abort = null;

        this._state = {
            status: 'idle',
            progress: 0,
            stage: null,
            error: null,
            jobId: null,
            result: null
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
     * Запускает двухфазный джоб: генерация -> (опционально) конвертация.
     * @param {object} args
     * @param {string} [args.mode='image'] 'text'|'image'|'multi'
     * @param {string} [args.prompt]
     * @param {File} [args.image]
     * @param {Array<{file: File, viewType: string}>} [args.multiViewImages]
     * @param {string} [args.model='3.1']
     * @param {string} [args.generateType]
     * @param {number} [args.faceCount]
     * @param {boolean} [args.pbr]
     * @param {string} [args.downloadFormat='glb']
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<void>}
     */
    async start({ mode = 'image', prompt, image, multiViewImages, model = '3.1', generateType, faceCount, pbr, downloadFormat = 'glb', signal: externalSignal } = {}) {
        if (this._abort) this.abort();

        const abort = new AbortController();
        this._abort = abort;
        const { signal } = abort;

        if (externalSignal) {
            if (externalSignal.aborted) { abort.abort(); return; }
            externalSignal.addEventListener('abort', () => abort.abort(), { once: true });
        }

        this._setState({ status: 'submitting', progress: 0, stage: null, error: null, jobId: null, result: null });

        const timeoutId = setTimeout(() => {
            if (this._abort === abort) {
                abort.abort();
                this._setState({ status: 'error', error: 'Таймаут: джоб превысил 600 секунд' });
            }
        }, JOB_TIMEOUT_MS);

        try {
            const { jobId } = await this._client.submit3dModel({
                mode, prompt, image, multiViewImages, model, generateType, faceCount, pbr, downloadFormat, signal
            });
            if (signal.aborted) return;

            this._setState({ status: 'polling', jobId });

            const genResult = await this._pollLoop(jobId, signal, downloadFormat);
            if (!genResult || signal.aborted) return;

            if (!genResult.needsConvert) {
                const { previewBase64, mimeType, modelUrl, format } = genResult;
                this._setState({ status: 'done', progress: 100, stage: null, result: { previewBase64, mimeType, modelUrl, format } });
                return;
            }

            // Фаза 2: конвертация GLB -> FBX/STL
            const { previewBase64: genPreview, mimeType: genMime, sourceGlbUrl } = genResult;
            this._setState({ stage: 'convert', progress: 0 });

            const { jobId: convertJobId } = await this._client.submitConvert3d({
                glbUrl: sourceGlbUrl, format: downloadFormat, signal
            });
            if (signal.aborted) return;

            this._setState({ jobId: convertJobId });

            const convResult = await this._pollConvertLoop(convertJobId, signal, downloadFormat);
            if (!convResult || signal.aborted) return;

            this._setState({
                status: 'done',
                progress: 100,
                stage: null,
                result: { previewBase64: genPreview, mimeType: genMime, modelUrl: convResult.modelUrl, format: convResult.format }
            });
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

    async _pollLoop(jobId, signal, format) {
        while (!signal.aborted) {
            await sleep(POLL_INTERVAL_MS, signal);
            if (signal.aborted) return null;

            let data;
            try {
                data = await this._client.poll3dModel(jobId, signal, undefined, format);
            } catch (err) {
                if (err?.name === 'AbortError' || signal.aborted) return null;
                this._setState({ status: 'error', error: err?.message || 'Ошибка поллинга' });
                return null;
            }

            const { status, progress, stage, error } = data;

            if (status === 'done') {
                return data;
            }

            if (status === 'error') {
                this._setState({ status: 'error', error: error || 'Ошибка джоба' });
                return null;
            }

            // 'pending' | 'running' — обновляем прогресс
            this._setState({
                progress: progress ?? this._state.progress,
                stage: stage ?? this._state.stage
            });
        }
        return null;
    }

    async _pollConvertLoop(jobId, signal, format) {
        while (!signal.aborted) {
            await sleep(POLL_INTERVAL_MS, signal);
            if (signal.aborted) return null;

            let data;
            try {
                data = await this._client.pollConvert3d(jobId, signal, format);
            } catch (err) {
                if (err?.name === 'AbortError' || signal.aborted) return null;
                this._setState({ status: 'error', error: err?.message || 'Ошибка конвертации' });
                return null;
            }

            const { status, progress, error } = data;

            if (status === 'done') {
                return data;
            }

            if (status === 'error') {
                this._setState({ status: 'error', error: error || 'Ошибка конвертации' });
                return null;
            }

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
                console.error('[Model3dSession] listener error:', err);
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
