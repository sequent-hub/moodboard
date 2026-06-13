/**
 * Конфигурация возможностей моделей генерации видео.
 *
 * Одна ответственность: данные и чистые helper-функции.
 * Никакого DOM, никаких импортов UI.
 *
 * ВНИМАНИЕ: provider-id (gemini-video, seedance, veo, kling, openai-video) — предварительные;
 * подлежат сверке с бэкендом Futurello перед включением в prod.
 *
 * @typedef {Object} VideoModelCapability
 * @property {string}      id              - уникальный идентификатор
 * @property {string}      label           - подпись в UI
 * @property {string}      description     - описание (провайдер · техническое имя)
 * @property {string}      provider        - идентификатор провайдера для бэкенда
 * @property {string}      model           - код модели для бэкенда
 * @property {string[]}    ratios          - поддерживаемые соотношения сторон
 * @property {string[]}    resolutions     - допустимые разрешения; [] = выбор не нужен
 * @property {number[]}    durations       - допустимые длительности в секундах
 * @property {number|null} defaultDuration - дефолтная длительность или null
 * @property {number}      maxCount        - максимальное количество видео в одном запросе
 * @property {{
 *   seed:             boolean,
 *   negativePrompt:   boolean,
 *   audio:            boolean,
 *   watermark:        boolean,
 *   personGeneration: boolean,
 *   cfgScale:         boolean
 * }} supports
 */

/** @type {VideoModelCapability[]} */
export const VIDEO_MODELS = [
    {
        id: 'gemini-omni-flash',
        label: 'Gemini-Omni-Flash',
        description: 'Google · gemini-omni-flash',
        provider: 'gemini-video',
        model: 'gemini-omni-flash',
        ratios: ['16:9', '9:16'],
        resolutions: [],
        durations: [4, 6, 8, 10],
        defaultDuration: 4,
        maxCount: 1,
        supports: { seed: true, negativePrompt: false, audio: true, watermark: false, personGeneration: false, cfgScale: false },
    },
    {
        id: 'seedance-2',
        label: 'Seedance 2.0',
        description: 'ByteDance · doubao-seedance-2-0',
        provider: 'seedance',
        model: 'doubao-seedance-2-0',
        ratios: ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'],
        resolutions: ['480p', '720p', '1080p'],
        durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        defaultDuration: 5,
        maxCount: 1,
        supports: { seed: true, negativePrompt: true, audio: true, watermark: true, personGeneration: false, cfgScale: false },
    },
    {
        id: 'veo-3-1',
        label: 'Veo 3.1',
        description: 'Google · veo-3.1-generate-preview',
        provider: 'veo',
        model: 'veo-3.1-generate-preview',
        ratios: ['16:9', '9:16'],
        resolutions: ['720p', '1080p'],
        durations: [4, 6, 8],
        defaultDuration: 4,
        maxCount: 1,
        supports: { seed: false, negativePrompt: true, audio: false, watermark: false, personGeneration: true, cfgScale: false },
    },
    {
        id: 'kling-3-pro',
        label: 'Kling 3.0 Pro',
        description: 'Kuaishou · kling-v3-pro',
        provider: 'kling',
        model: 'kling-v3-pro',
        ratios: ['16:9', '9:16', '1:1'],
        resolutions: ['720p', '1080p', '4K'],
        durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        defaultDuration: 5,
        maxCount: 1,
        supports: { seed: false, negativePrompt: true, audio: true, watermark: false, personGeneration: false, cfgScale: true },
    },
    {
        id: 'kling-2-5-turbo-pro',
        label: 'Kling 2.5 Turbo Pro',
        description: 'Kuaishou · kling-v2.5-turbo-pro',
        provider: 'kling',
        model: 'kling-v2.5-turbo-pro',
        ratios: ['16:9', '9:16', '1:1'],
        resolutions: [],
        durations: [5, 10],
        defaultDuration: 5,
        maxCount: 1,
        supports: { seed: false, negativePrompt: true, audio: false, watermark: false, personGeneration: false, cfgScale: true },
    },
    {
        id: 'sora-2',
        label: 'Sora 2',
        description: 'OpenAI · sora-2',
        provider: 'openai-video',
        model: 'sora-2',
        ratios: ['16:9', '9:16'],
        resolutions: [],
        durations: [4, 8, 12],
        defaultDuration: 4,
        maxCount: 1,
        supports: { seed: false, negativePrompt: false, audio: false, watermark: false, personGeneration: false, cfgScale: false },
    },
];

/**
 * Возвращает объект возможностей видео-модели по id или null, если модель не найдена.
 * @param {string} id
 * @returns {VideoModelCapability|null}
 */
export function getVideoModelCapability(id) {
    return VIDEO_MODELS.find((m) => m.id === id) ?? null;
}
