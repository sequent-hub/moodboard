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
];

/**
 * Возвращает объект возможностей видео-модели по id или null, если модель не найдена.
 * @param {string} id
 * @returns {VideoModelCapability|null}
 */
export function getVideoModelCapability(id) {
    return VIDEO_MODELS.find((m) => m.id === id) ?? null;
}
