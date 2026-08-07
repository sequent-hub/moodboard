/**
 * Контракт узла-генератора видео.
 *
 * Одна ответственность: данные и чистые функции. Никакого DOM и PIXI —
 * модуль импортируют и объект сцены, и слой управления, и движок запуска,
 * и тесты.
 *
 * Устроен по образцу контракта генератора изображений: параметры лежат в
 * отдельном `params`, результаты — в массиве `results` с активным индексом,
 * порты объявлены списком. Идентификаторы портов и правило совместимости
 * общие для обоих узлов и живут в `generatorPorts.js`.
 */

import {
    PORT_PROMPT,
    PORT_FIRST_FRAME,
    PORT_LAST_FRAME,
    PORT_VIDEO_REFERENCE,
    PORT_VIDEO_OUT,
    PORT_FIRST_FRAME_OUT,
    PORT_LAST_FRAME_OUT,
    PORT_OUTSET,
    PORT_STACK_STEP,
} from './generatorPorts.js';

export {
    PORT_PROMPT,
    PORT_FIRST_FRAME,
    PORT_LAST_FRAME,
    PORT_VIDEO_REFERENCE,
    PORT_VIDEO_OUT,
    PORT_FIRST_FRAME_OUT,
    PORT_LAST_FRAME_OUT,
} from './generatorPorts.js';

export const VIDEO_GENERATOR_TYPE = 'video-generator';

/** Версия схемы properties. Растёт при несовместимых изменениях. */
export const VIDEO_GENERATOR_SCHEMA_VERSION = 1;

/**
 * Высота зоны нижней панели инструментов, world-пиксели.
 * Панель лежит поверх кадра и места в карточке не занимает.
 */
export const VIDEO_FOOTER_HEIGHT = 46;

export const VIDEO_MIN_WIDTH = 260;
export const VIDEO_MIN_BODY_HEIGHT = 160;
export const VIDEO_DEFAULT_WIDTH = 380;

/**
 * Порты, которые узел рисует, но связь пока не принимает.
 *
 * Шлюз ai-service подтверждённо принимает ровно одно изображение — полем
 * `reference_image`, оно занято первым кадром. Ключ под последний кадр
 * отправляется на пробу и контрактом не подтверждён, входа видео у шлюза нет
 * вовсе. Пока проба на dev не подтвердит поля, порты видны погашенными:
 * рабочая связь, которая роняет генерацию в 502, хуже отсутствующей.
 */
export const LAST_FRAME_PORT_ENABLED = false;
export const VIDEO_REFERENCE_PORT_ENABLED = false;

/**
 * Выходы кадров из готового видео. Извлечения кадров в мосте нет — порты
 * объявлены под будущий функционал и погашены.
 */
export const FRAME_OUT_PORTS_ENABLED = false;

/** Статусы одного результата генерации. */
export const VIDEO_RESULT_STATUS = {
    Pending: 'pending',
    Done: 'done',
    Error: 'error',
};

/** Соотношения сторон, которые узел умеет показывать. */
export const VIDEO_GENERATOR_RATIOS = ['16:9', '9:16'];

/**
 * Свойства нового узла.
 *
 * Значения по умолчанию совпадают с условиями генерации Veo 3.1, уже
 * настроенными на холсте: 16:9, 720p, 4 секунды.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
export function createDefaultVideoGeneratorProperties(overrides = {}) {
    const { params: paramsOverride, ...rest } = overrides;

    return {
        schemaVersion: VIDEO_GENERATOR_SCHEMA_VERSION,
        params: {
            modelId: null,
            ratio: '16:9',
            resolution: '720p',
            duration: 4,
            ...(paramsOverride || {}),
        },
        prompt: '',
        results: [],
        activeResultIndex: 0,
        ...rest,
    };
}

/**
 * Приводит произвольные (в том числе старые или битые) properties к текущей схеме.
 * Неизвестные поля сохраняются — они могут принадлежать более новой версии клиента.
 *
 * @param {object} [props]
 * @returns {object}
 */
export function normalizeVideoGeneratorProperties(props = {}) {
    const source = props && typeof props === 'object' ? props : {};
    const params = source.params && typeof source.params === 'object' ? source.params : {};

    const results = Array.isArray(source.results)
        ? source.results.filter((item) => item && typeof item === 'object').map(normalizeVideoResult)
        : [];

    const activeIndex = Number.isInteger(source.activeResultIndex) ? source.activeResultIndex : 0;

    return {
        ...source,
        schemaVersion: VIDEO_GENERATOR_SCHEMA_VERSION,
        params: {
            ...params,
            modelId: typeof params.modelId === 'string' && params.modelId ? params.modelId : null,
            ratio: VIDEO_GENERATOR_RATIOS.includes(params.ratio) ? params.ratio : '16:9',
            resolution: typeof params.resolution === 'string' && params.resolution ? params.resolution : '720p',
            duration: clampDuration(params.duration),
        },
        prompt: typeof source.prompt === 'string' ? source.prompt : '',
        results,
        activeResultIndex: results.length === 0 ? 0 : Math.min(Math.max(0, activeIndex), results.length - 1),
    };
}

function normalizeVideoResult(result) {
    const status = Object.values(VIDEO_RESULT_STATUS).includes(result.status)
        ? result.status
        : VIDEO_RESULT_STATUS.Pending;

    return {
        ...result,
        status,
        videoUrl: typeof result.videoUrl === 'string' ? result.videoUrl : null,
        error: typeof result.error === 'string' ? result.error : null,
    };
}

/**
 * @param {*} value
 * @returns {number}
 */
export function clampDuration(value) {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num)) return 4;
    return Math.min(60, Math.max(1, num));
}

/**
 * Идёт ли сейчас генерация: есть хотя бы один незавершённый результат.
 *
 * @param {object} props нормализованные properties
 * @returns {boolean}
 */
export function isVideoGeneratorRunning(props) {
    const results = props?.results;
    return Array.isArray(results) && results.some((r) => r?.status === VIDEO_RESULT_STATUS.Pending);
}

/**
 * Текст ошибки последней генерации или null.
 *
 * @param {object} props нормализованные properties
 * @returns {string|null}
 */
export function getVideoGeneratorError(props) {
    const results = Array.isArray(props?.results) ? props.results : [];
    if (results.some((r) => r?.status === VIDEO_RESULT_STATUS.Pending)) return null;
    const failed = results.find((r) => r?.status === VIDEO_RESULT_STATUS.Error && r?.error);
    return failed ? failed.error : null;
}

/**
 * Готовое видео узла: активный результат, а если он не готов — первый готовый.
 *
 * @param {object} props нормализованные properties
 * @returns {{videoUrl: string, mimeType: string|null}|null}
 */
export function getReadyVideoResult(props) {
    const results = Array.isArray(props?.results) ? props.results : [];
    const isReady = (r) => r?.status === VIDEO_RESULT_STATUS.Done && typeof r?.videoUrl === 'string' && r.videoUrl.trim();

    const activeIndex = Number.isInteger(props?.activeResultIndex) ? props.activeResultIndex : 0;
    const candidate = isReady(results[activeIndex]) ? results[activeIndex] : results.find(isReady);
    if (!candidate) return null;

    return { videoUrl: candidate.videoUrl.trim(), mimeType: candidate.mimeType || null };
}

/**
 * Порты узла в нормализованных координатах bbox (0..1 от левого-верхнего угла).
 *
 * Входы идут слева столбиком снизу вверх, выходы — справа. На уровне нижней
 * панели стоят рабочие порты (первый кадр и результат), погашенные подняты
 * выше: так рабочая пара всегда рядом с кнопкой запуска.
 * Все вынесены наружу на PORT_OUTSET, поэтому anchor.x выходит за диапазон 0..1.
 *
 * @param {{width: number, height: number}} size
 * @returns {Array<{id: string, kind: string, dataType: string, label: string, enabled: boolean, anchor: {x: number, y: number}}>}
 */
export function getVideoGeneratorPorts(size = {}) {
    const width = Math.max(1, Number(size.width) || 1);
    const height = Math.max(1, Number(size.height) || 1);

    const footerCenter = height - VIDEO_FOOTER_HEIGHT / 2;
    const level = (step) => clampUnit((footerCenter - step * PORT_STACK_STEP) / height);
    const outset = PORT_OUTSET / width;

    return [
        {
            id: PORT_FIRST_FRAME,
            kind: 'input',
            dataType: 'image',
            label: 'Первый кадр',
            enabled: true,
            anchor: { x: -outset, y: level(0) },
        },
        {
            id: PORT_PROMPT,
            kind: 'input',
            dataType: 'text',
            label: 'Текст',
            enabled: true,
            anchor: { x: -outset, y: level(1) },
        },
        {
            id: PORT_LAST_FRAME,
            kind: 'input',
            dataType: 'image',
            label: 'Последний кадр',
            enabled: LAST_FRAME_PORT_ENABLED,
            anchor: { x: -outset, y: level(2) },
        },
        {
            id: PORT_VIDEO_REFERENCE,
            kind: 'input',
            dataType: 'video',
            label: 'Референс-видео',
            enabled: VIDEO_REFERENCE_PORT_ENABLED,
            anchor: { x: -outset, y: level(3) },
        },
        {
            id: PORT_VIDEO_OUT,
            kind: 'output',
            dataType: 'video',
            label: 'Результат',
            enabled: true,
            anchor: { x: 1 + outset, y: level(0) },
        },
        {
            id: PORT_FIRST_FRAME_OUT,
            kind: 'output',
            dataType: 'image',
            label: 'Первый кадр результата',
            enabled: FRAME_OUT_PORTS_ENABLED,
            anchor: { x: 1 + outset, y: level(1) },
        },
        {
            id: PORT_LAST_FRAME_OUT,
            kind: 'output',
            dataType: 'image',
            label: 'Последний кадр результата',
            enabled: FRAME_OUT_PORTS_ENABLED,
            anchor: { x: 1 + outset, y: level(2) },
        },
    ];
}

function clampUnit(value) {
    return Math.min(1, Math.max(0, value));
}

/**
 * Высота карточки под выбранное соотношение сторон.
 *
 * Кадр занимает узел целиком, поэтому высота узла равна высоте кадра: запаса
 * на панель нет, иначе кадр 1:1 давал бы прямоугольный узел.
 *
 * @param {string} ratio
 * @param {number} width
 * @param {number} currentHeight
 * @returns {number}
 */
export function heightForVideoRatio(ratio, width, currentHeight) {
    const [w, h] = String(ratio || '').split(':').map((part) => Number.parseFloat(part));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return Math.max(VIDEO_MIN_BODY_HEIGHT, currentHeight);
    }

    return Math.max(VIDEO_MIN_BODY_HEIGHT, Math.round((Math.max(VIDEO_MIN_WIDTH, width) * h) / w));
}

/** Высота узла по умолчанию — кадр 16:9 при ширине по умолчанию. */
export const VIDEO_DEFAULT_HEIGHT = heightForVideoRatio('16:9', VIDEO_DEFAULT_WIDTH, VIDEO_MIN_BODY_HEIGHT);
