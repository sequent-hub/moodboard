/**
 * Конфигурация возможностей моделей генерации изображений.
 *
 * Одна ответственность: данные и чистые helper-функции.
 * Никакого DOM, никаких импортов UI.
 *
 * @typedef {Object} ImageModelCapability
 * @property {string}   id               - уникальный идентификатор
 * @property {string}   label            - подпись в UI (бренд/название модели)
 * @property {string}   description      - описание (провайдер · техническое имя)
 * @property {string}   provider         - идентификатор провайдера для бэкенда
 * @property {string}   model            - код модели для бэкенда
 * @property {string|undefined} quality  - 'high' | 'medium' | 'low' | undefined
 * @property {string[]} ratios           - поддерживаемые соотношения сторон (id из FORMAT_OPTIONS)
 * @property {string[]} resolutions      - допустимые разрешения; [] = выбор не нужен
 * @property {string|null} defaultResolution - дефолтное разрешение или null
 * @property {number}   maxCount         - максимальное количество изображений в одном запросе
 * @property {{
 *   seed:           boolean,
 *   negativePrompt: boolean,
 *   background:     boolean,
 *   outputFormat:   boolean,
 *   promptExtend:   boolean,
 *   watermark:      boolean
 * }} supports - флаги поддерживаемых доп-настроек
 */

/** @type {ImageModelCapability[]} */
export const IMAGE_MODELS = [
    {
        id: 'yandex-art',
        label: 'Yandex GPT',
        description: 'Yandex · Шедеврум',
        provider: 'yandex-art',
        model: 'yandex-art',
        quality: undefined,
        ratios: ['1:1', '16:9', '9:16', '3:4', '4:3'],
        resolutions: [],
        defaultResolution: null,
        maxCount: 1,
        supports: { seed: true, negativePrompt: true, background: false, outputFormat: false, promptExtend: false, watermark: false }
    },
    {
        id: 'nano-banana-pro',
        label: 'Nano Banana Pro',
        description: 'Google · Gemini 3 Pro Image',
        provider: 'gemini-image',
        model: 'gemini-3-pro-image',
        quality: undefined,
        ratios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
        resolutions: ['1K', '2K', '4K'],
        defaultResolution: '1K',
        maxCount: 4,
        supports: { seed: false, negativePrompt: false, background: false, outputFormat: false, promptExtend: false, watermark: false }
    },
    {
        id: 'nano-banana-2',
        label: 'Nano Banana 2',
        description: 'Google · Gemini 3.1 Flash Image',
        provider: 'gemini-image',
        model: 'gemini-3.1-flash-image',
        quality: undefined,
        ratios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
        resolutions: ['512', '1K', '2K', '4K'],
        defaultResolution: '1K',
        maxCount: 4,
        supports: { seed: false, negativePrompt: false, background: false, outputFormat: false, promptExtend: false, watermark: false }
    },
    {
        id: 'gpt-image-2-high',
        label: 'GPT-Image-2 High',
        description: 'OpenAI · gpt-image-2 · High',
        provider: 'openai-image',
        model: 'gpt-image-2',
        quality: 'high',
        ratios: ['1:1', '3:2', '2:3', '16:9', '9:16'],
        resolutions: ['1K', '2K', '4K'],
        defaultResolution: '1K',
        maxCount: 1,
        supports: { seed: false, negativePrompt: false, background: true, outputFormat: true, promptExtend: false, watermark: false }
    },
    {
        id: 'gpt-image-2-medium',
        label: 'GPT-Image-2 Medium',
        description: 'OpenAI · gpt-image-2 · Medium',
        provider: 'openai-image',
        model: 'gpt-image-2',
        quality: 'medium',
        ratios: ['1:1', '3:2', '2:3', '16:9', '9:16'],
        resolutions: ['1K', '2K', '4K'],
        defaultResolution: '1K',
        maxCount: 1,
        supports: { seed: false, negativePrompt: false, background: true, outputFormat: true, promptExtend: false, watermark: false }
    },
    {
        id: 'gpt-image-2-low',
        label: 'GPT-Image-2 Low',
        description: 'OpenAI · gpt-image-2 · Low',
        provider: 'openai-image',
        model: 'gpt-image-2',
        quality: 'low',
        ratios: ['1:1', '3:2', '2:3', '16:9', '9:16'],
        resolutions: ['1K', '2K', '4K'],
        defaultResolution: '1K',
        maxCount: 1,
        supports: { seed: false, negativePrompt: false, background: true, outputFormat: true, promptExtend: false, watermark: false }
    },
    {
        id: 'qwen-image-2-pro',
        label: 'Qwen Image 2 Pro',
        description: 'Alibaba · qwen-image-2.0-pro',
        provider: 'qwen-image',
        model: 'qwen-image-2.0-pro',
        quality: undefined,
        ratios: ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '21:9'],
        resolutions: [],
        defaultResolution: null,
        maxCount: 6,
        supports: { seed: true, negativePrompt: true, background: false, outputFormat: false, promptExtend: true, watermark: true }
    }
];

/**
 * Возвращает объект возможностей модели по id или null, если модель не найдена.
 * @param {string} id
 * @returns {ImageModelCapability|null}
 */
export function getImageModelCapability(id) {
    return IMAGE_MODELS.find((m) => m.id === id) ?? null;
}
