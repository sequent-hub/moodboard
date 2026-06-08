/**
 * Тонкий HTTP-клиент к /api/v2/ai.
 *
 * Одна ответственность: общение с backend-эндпоинтами AI.
 * В dev-режиме за same-origin стоит Node-заглушка (server/), в проде —
 * Laravel-пакет futurello/moodboard (контроллер AiController).
 * Контракт payload и SSE-формат у них одинаковый.
 *
 * Не знает ни про UI, ни про localStorage. Возвращает обычные данные
 * и async generator для стриминга.
 */

const DEFAULT_BASE_URL = '/api/v2/ai';

export class AiClient {
    /**
     * @param {object} options
     * @param {string} [options.baseUrl='/api/v2/ai']
     * @param {typeof fetch} [options.fetchImpl]
     */
    constructor(options = {}) {
        this._baseUrl = options.baseUrl || DEFAULT_BASE_URL;
        this._fetch = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
        if (!this._fetch) {
            throw new Error('AiClient: fetch is not available in this environment');
        }
    }

    /**
     * Список доступных провайдеров.
     *
     * @returns {Promise<Array<{id: string, label: string, enabled: boolean, supportedRatios: string[]|null}>>}
     *   supportedRatios — массив id форматов из FORMAT_OPTIONS (например ['1:1','3:2','2:3']),
     *   либо null, если провайдер не ограничивает доступные соотношения сторон.
     */
    async listProviders() {
        const res = await this._fetch(`${this._baseUrl}/providers`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            throw new Error(`AiClient.listProviders: ${res.status}`);
        }
        const json = await res.json();
        return Array.isArray(json?.providers) ? json.providers : [];
    }

    /**
     * Не-стриминговый чат.
     * @param {object} args
     * @param {string} args.provider
     * @param {Array<{role: string, content: string}>} args.messages
     * @param {string} [args.system]
     * @param {number} [args.temperature]
     * @param {number} [args.maxTokens]
     * @param {string} [args.model]
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<{text: string}>}
     */
    async chat({ provider, signal, ...payload }) {
        const res = await this._fetch(`${this._baseUrl}/${provider}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ ...payload, stream: false }),
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.chat (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Стриминговый чат. Возвращает объект с async iterable для дельт.
     * Отмена — через переданный AbortSignal.
     *
     * @param {object} args
     * @param {string} args.provider
     * @param {Array<{role: string, content: string}>} args.messages
     * @param {string} [args.system]
     * @param {number} [args.temperature]
     * @param {number} [args.maxTokens]
     * @param {string} [args.model]
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<{ deltas: AsyncGenerator<string> }>}
     */
    async chatStream({ provider, signal, ...payload }) {
        const res = await this._fetch(`${this._baseUrl}/${provider}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({ ...payload, stream: true }),
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.chatStream (${res.status}): ${detail}`);
        }
        if (!res.body) {
            throw new Error('AiClient.chatStream: empty response body');
        }
        return { deltas: parseClientSse(res.body, signal) };
    }

    /**
     * Генерация изображения через image-провайдера.
     * @param {object} args
     * @param {string} [args.provider='yandex-art']
     * @param {string} args.prompt
     * @param {string} [args.negativePrompt]
     * @param {number} [args.widthRatio]
     * @param {number} [args.heightRatio]
     * @param {number} [args.seed]
     * @param {string} [args.mimeType]
     * @param {string} [args.model]
     * @param {File[]} [args.referenceImages]
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<{operationId: string, imageBase64: string, mimeType: string}>}
     */
    async generateImage({ provider = 'yandex-art', signal, referenceImages: files, ...payload }) {
        const referenceImages = await filesToBase64(files);
        const body = referenceImages ? { ...payload, referenceImages } : payload;
        const res = await this._fetch(`${this._baseUrl}/${provider}/image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body),
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.generateImage (${res.status}): ${detail}`);
        }
        return res.json();
    }
}

/**
 * Минимальный парсер SSE на клиенте.
 * Контракт сервера (см. server/src/utils/sseWriter.js):
 *   data: {"delta":"..."}
 *   data: [DONE]
 *   event: error
 *   data: {"error":"..."}
 *
 * @param {ReadableStream<Uint8Array>} stream
 * @param {AbortSignal} [signal]
 */
async function* parseClientSse(stream, signal) {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const onAbort = () => {
        try { reader.cancel(); } catch (_) { /* noop */ }
    };
    if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);

                const parsed = parseSseEvent(rawEvent);
                if (!parsed) continue;

                if (parsed.event === 'error') {
                    const err = safeJson(parsed.data);
                    throw new Error(err?.error || 'AI stream error');
                }

                if (parsed.data === '[DONE]') return;

                const json = safeJson(parsed.data);
                if (json && typeof json.delta === 'string' && json.delta.length > 0) {
                    yield json.delta;
                }
            }
        }
    } finally {
        if (signal) signal.removeEventListener('abort', onAbort);
        try { reader.releaseLock(); } catch (_) { /* noop */ }
    }
}

function parseSseEvent(raw) {
    const lines = raw.split(/\r?\n/);
    let event = 'message';
    const dataParts = [];
    for (const line of lines) {
        if (!line || line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
            event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            dataParts.push(line.slice(5).trimStart());
        }
    }
    if (dataParts.length === 0) return null;
    return { event, data: dataParts.join('\n') };
}

function safeJson(text) {
    try { return JSON.parse(text); } catch { return null; }
}

async function safeReadError(res) {
    try {
        const text = await res.text();
        const json = safeJson(text);
        return json?.error ? json.error : (text || res.statusText);
    } catch {
        return res.statusText;
    }
}

/**
 * Конвертирует массив File в [{mimeType, data}] с base64-encoded данными.
 * Возвращает undefined, если массив пустой или не передан.
 *
 * @param {File[]|undefined} files
 * @returns {Promise<Array<{mimeType: string, data: string}>|undefined>}
 */
async function filesToBase64(files) {
    if (!Array.isArray(files) || files.length === 0) return undefined;
    return Promise.all(
        files.map(async (file) => {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return {
                mimeType: file.type || 'image/png',
                data: btoa(binary)
            };
        })
    );
}
