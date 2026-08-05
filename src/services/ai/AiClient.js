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
     * @param {string} args.provider
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
    async generateImage({ provider, signal, referenceImages: files, ...payload }) {
        const referenceImages = await filesToBase64(await shrinkReferenceImages(files));
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

    /**
     * Ставит задачу генерации изображения и сразу возвращает её идентификатор.
     *
     * В отличие от generateImage, который держал один долгий запрос и потому
     * терял генерацию вместе с закрытым холстом, здесь генерация живёт на
     * сервере: её можно опросить позже, в том числе в новом окне мудборда.
     *
     * @param {object} args
     * @param {string} args.provider
     * @param {string} args.prompt
     * @param {string} [args.model]
     * @param {string} [args.mimeType]
     * @param {string} [args.moodboardId]
     * @param {File[]} [args.referenceImages]
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<{jobId: string, status: string}>}
     */
    async submitImage({ provider, signal, referenceImages: files, ...payload }) {
        if (!provider) throw new Error('AiClient.submitImage: provider is required');
        const referenceImages = await filesToBase64(await shrinkReferenceImages(files));
        const body = referenceImages ? { ...payload, referenceImages } : payload;
        const res = await this._fetch(`${this._baseUrl}/${provider}/image/jobs`, {
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
            throw new Error(`AiClient.submitImage (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Опрашивает статус задачи генерации изображения.
     *
     * @param {string} jobId
     * @param {AbortSignal} [signal]
     * @param {string} provider
     * @returns {Promise<{status: string, imageUrl?: string, mimeType?: string, error?: string}>}
     */
    async pollImage(jobId, signal, provider) {
        if (!provider) throw new Error('AiClient.pollImage: provider is required');
        const res = await this._fetch(`${this._baseUrl}/${provider}/image/jobs/${jobId}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.pollImage (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Незавершённые и недавно завершённые задачи генерации изображений.
     *
     * Источник правды при возобновлении: истории чата в localStorage может не
     * быть вовсе (другой браузер или устройство), а задачи на сервере есть.
     *
     * @param {object} [args]
     * @param {string} [args.moodboardId]
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<Array<object>>}
     */
    async listImageJobs({ moodboardId, signal } = {}) {
        const query = moodboardId ? `?moodboardId=${encodeURIComponent(moodboardId)}` : '';
        const res = await this._fetch(`${this._baseUrl}/image/jobs${query}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.listImageJobs (${res.status}): ${detail}`);
        }
        const json = await res.json();
        return Array.isArray(json?.jobs) ? json.jobs : [];
    }

    /**
     * Отправляет джоб генерации 3D-модели.
     * @param {object} args
     * @param {string} [args.provider] - провайдер для бэкенда (tencentcloud)
     * @param {string} [args.mode='image'] 'text'|'image'|'multi'
     * @param {string} [args.prompt]
     * @param {File} [args.image]
     * @param {Array<{file: File, viewType: string}>} [args.multiViewImages]
     * @param {string} [args.model] - slug модели (hunyuan-3d-pro | hunyuan-3d-rapid)
     * @param {object} [args.options] - provider-native опции (Model/EnablePBR/FaceCount/...)
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<{jobId: string}>}
     */
    async submit3dModel({ provider, mode = 'image', prompt, image, multiViewImages, model, options, signal }) {
        if (!provider) throw new Error('AiClient.submit3dModel: provider is required');
        if (!model) throw new Error('AiClient.submit3dModel: model is required');

        const body = { mode, model, ...(options || {}) };

        if (mode === 'text') {
            body.prompt = prompt;
        } else if (mode === 'multi') {
            if (Array.isArray(multiViewImages) && multiViewImages.length) {
                body.multiViewImages = await Promise.all(
                    multiViewImages.map(async ({ file, viewType }) => {
                        const [encoded] = await filesToBase64([file]);
                        return { ...encoded, viewType };
                    })
                );
            }
        } else {
            if (image) {
                const [encoded] = await filesToBase64([image]);
                body.image = encoded;
            }
        }

        const res = await this._fetch(`${this._baseUrl}/${provider}/model3d`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body),
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.submit3dModel (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Опрашивает статус джоба 3D-модели.
     * @param {string} jobId
     * @param {AbortSignal} [signal]
     * @param {string} [provider] - провайдер для бэкенда (tencentcloud)
     * @param {string} [format]
     * @returns {Promise<object>}
     */
    async poll3dModel(jobId, signal, provider, format) {
        if (!provider) throw new Error('AiClient.poll3dModel: provider is required');
        const url = `${this._baseUrl}/${provider}/model3d/${jobId}${format ? `?format=${format}` : ''}`;
        const res = await this._fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.poll3dModel (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Отправляет джоб генерации видео.
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
     * @returns {Promise<{jobId: string}>}
     */
    async submitVideo({ provider, signal, referenceImages: files, ...payload }) {
        const referenceImages = await filesToBase64(files);
        const body = referenceImages ? { ...payload, referenceImages } : payload;
        const res = await this._fetch(`${this._baseUrl}/${provider}/video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body),
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.submitVideo (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Опрашивает статус джоба генерации видео.
     * @param {string} jobId
     * @param {AbortSignal} [signal]
     * @param {string} provider
     * @returns {Promise<object>}
     */
    async pollVideo(jobId, signal, provider) {
        const res = await this._fetch(`${this._baseUrl}/${provider}/video/${jobId}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.pollVideo (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Отправляет джоб конвертации GLB -> FBX/STL.
     * @param {object} args
     * @param {string} args.glbUrl
     * @param {string} args.format 'fbx'|'stl'
     * @param {AbortSignal} [args.signal]
     * @returns {Promise<{jobId: string}>}
     */
    async submitConvert3d({ glbUrl, format, signal }) {
        const res = await this._fetch(`${this._baseUrl}/convert3d`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ glbUrl, format }),
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.submitConvert3d (${res.status}): ${detail}`);
        }
        return res.json();
    }

    /**
     * Опрашивает статус джоба конвертации.
     * @param {string} jobId
     * @param {AbortSignal} [signal]
     * @param {string} [format]
     * @returns {Promise<object>}
     */
    async pollConvert3d(jobId, signal, format) {
        const url = `${this._baseUrl}/convert3d/${jobId}${format ? `?format=${format}` : ''}`;
        const res = await this._fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal
        });
        if (!res.ok) {
            const detail = await safeReadError(res);
            throw new Error(`AiClient.pollConvert3d (${res.status}): ${detail}`);
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
    const fallback = res.statusText || `HTTP ${res.status}`;
    try {
        const text = await res.text();
        const json = safeJson(text);
        if (json?.error) {
            return typeof json.error === 'string' ? json.error : fallback;
        }
        // Не отдаём в UI сырой HTML/стектрейс (Laravel debug-страница) или
        // слишком длинное тело — показываем лаконичный статус вместо «простыни».
        const trimmed = (text || '').trim();
        if (!trimmed || trimmed.startsWith('<') || trimmed.length > 200) {
            return fallback;
        }
        return trimmed;
    } catch {
        return fallback;
    }
}

const REFERENCE_MAX_SIDE = 1536;
const REFERENCE_JPEG_QUALITY = 0.85;
const REFERENCE_SKIP_BYTES = 700 * 1024;

/**
 * Ужимает картинки-референсы перед base64-кодированием.
 *
 * base64 раздувает файл на треть, а на пути до генератора стоит nginx
 * ai-сервиса с client_max_body_size 1 МБ: исходное фото отдаёт 413 ещё
 * до модели. Референсу хватает 1536 px по длинной стороне.
 *
 * @param {File[]|undefined} files
 * @returns {Promise<File[]|undefined>}
 */
async function shrinkReferenceImages(files) {
    if (!Array.isArray(files) || files.length === 0) return files;
    return Promise.all(files.map((file) => shrinkReferenceImage(file)));
}

/**
 * @param {File} file
 * @returns {Promise<File|Blob>} исходный файл, если сжатие невозможно или бессмысленно
 */
async function shrinkReferenceImage(file) {
    const type = String(file?.type ?? '');
    if (!type.startsWith('image/') || type === 'image/svg+xml') return file;
    if (typeof createImageBitmap !== 'function') return file;

    let bitmap = null;
    try {
        bitmap = await createImageBitmap(file);
        const scale = Math.min(1, REFERENCE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size <= REFERENCE_SKIP_BYTES) return file;

        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const blob = await drawToJpegBlob(bitmap, width, height);
        if (!blob || blob.size >= file.size) return file;

        const name = `${String(file.name ?? 'reference').replace(/\.[^.]+$/, '')}.jpg`;
        return typeof File === 'function' ? new File([blob], name, { type: 'image/jpeg' }) : blob;
    } catch {
        return file;
    } finally {
        bitmap?.close?.();
    }
}

/**
 * @param {ImageBitmap} bitmap
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Blob|null>}
 */
async function drawToJpegBlob(bitmap, width, height) {
    const canvas = typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height)
        : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    if (!canvas) return null;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // JPEG не хранит альфу — без подложки прозрачные зоны PNG почернеют.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    if (typeof canvas.convertToBlob === 'function') {
        return canvas.convertToBlob({ type: 'image/jpeg', quality: REFERENCE_JPEG_QUALITY });
    }
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', REFERENCE_JPEG_QUALITY));
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
