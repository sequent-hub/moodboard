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
