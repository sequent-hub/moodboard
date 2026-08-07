/**
 * Контракт узла-генератора изображений.
 *
 * Одна ответственность: данные и чистые функции. Никакого DOM и PIXI —
 * модуль импортируют и объект сцены, и слой управления, и движок запуска,
 * и тесты.
 *
 * Схема свойств рассчитана на рост функционала: параметры генерации лежат
 * в отдельном `params`, результаты — в массиве `results` с активным индексом,
 * порты объявлены списком с типом данных. Добавление истории генераций,
 * новых параметров или новых портов не требует миграции сохранённых досок.
 */

import {
    PORT_PROMPT,
    PORT_IMAGE_IN,
    PORT_IMAGE_OUT,
    PORT_OUTSET,
    PORT_STACK_STEP,
} from './generatorPorts.js';

/**
 * Идентификаторы портов, их геометрия и правило совместимости переехали в
 * общий `generatorPorts.js`: связь соединяет узлы разных типов, и правило
 * обязано знать про порты видео тоже. Реэкспорт оставлен, чтобы прежние
 * импортёры контракта не менялись.
 */
export {
    PORT_PROMPT,
    PORT_IMAGE_IN,
    PORT_IMAGE_OUT,
    PORT_ICON_SIZE,
    PORT_CHIP_SIZE,
    PORT_STACK_GAP,
    PORT_STACK_STEP,
    PORT_OUTSET,
    PORT_LINE_STOP,
    canConnectPorts,
    canConnectTerminals,
} from './generatorPorts.js';

export const IMAGE_GENERATOR_TYPE = 'image-generator';

/**
 * Версия схемы properties. Растёт при несовместимых изменениях.
 *
 * 2 — картинка занимает весь узел, панель лежит поверх неё. Высота под
 * соотношение сторон считается без запаса на панель, поэтому доски версии 1
 * приводятся к новой геометрии функцией `migrateGeneratorSize`.
 */
export const IMAGE_GENERATOR_SCHEMA_VERSION = 2;

/**
 * Высота зоны нижней панели инструментов, world-пиксели.
 *
 * Панель лежит поверх изображения и места в карточке не занимает: константа
 * нужна, чтобы развести с панелью то, что не должно под неё попадать —
 * подсказку в пустом узле и уровень портов.
 */
export const GENERATOR_FOOTER_HEIGHT = 46;

export const GENERATOR_MIN_WIDTH = 260;
export const GENERATOR_MIN_BODY_HEIGHT = 160;
export const GENERATOR_DEFAULT_WIDTH = 380;

/** Статусы одного результата генерации. */
export const RESULT_STATUS = {
    Pending: 'pending',
    Done: 'done',
    Error: 'error',
};

/** Соотношения сторон, которые узел показывает в панели. */
export const GENERATOR_RATIOS = ['auto', '1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9'];

export const GENERATOR_MAX_COUNT = 6;

/**
 * Свойства нового узла.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
export function createDefaultGeneratorProperties(overrides = {}) {
    const { params: paramsOverride, ...rest } = overrides;

    return {
        schemaVersion: IMAGE_GENERATOR_SCHEMA_VERSION,
        params: {
            modelId: null,
            count: 1,
            ratio: 'auto',
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
export function normalizeGeneratorProperties(props = {}) {
    const source = props && typeof props === 'object' ? props : {};
    const params = source.params && typeof source.params === 'object' ? source.params : {};

    const results = Array.isArray(source.results)
        ? source.results.filter((item) => item && typeof item === 'object').map(normalizeResult)
        : [];

    const count = clampCount(params.count);
    const ratio = GENERATOR_RATIOS.includes(params.ratio) ? params.ratio : 'auto';

    const activeIndex = Number.isInteger(source.activeResultIndex) ? source.activeResultIndex : 0;

    return {
        ...source,
        schemaVersion: IMAGE_GENERATOR_SCHEMA_VERSION,
        params: {
            ...params,
            modelId: typeof params.modelId === 'string' && params.modelId ? params.modelId : null,
            count,
            ratio,
        },
        prompt: typeof source.prompt === 'string' ? source.prompt : '',
        results,
        activeResultIndex: results.length === 0 ? 0 : Math.min(Math.max(0, activeIndex), results.length - 1),
    };
}

function normalizeResult(result) {
    const status = Object.values(RESULT_STATUS).includes(result.status) ? result.status : RESULT_STATUS.Pending;
    return {
        ...result,
        status,
        imageUrl: typeof result.imageUrl === 'string' ? result.imageUrl : null,
        error: typeof result.error === 'string' ? result.error : null,
    };
}

export function clampCount(value) {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num)) return 1;
    return Math.min(GENERATOR_MAX_COUNT, Math.max(1, num));
}

/**
 * Идёт ли сейчас генерация: есть хотя бы один незавершённый результат.
 *
 * @param {object} props нормализованные properties
 * @returns {boolean}
 */
export function isGeneratorRunning(props) {
    const results = props?.results;
    return Array.isArray(results) && results.some((r) => r?.status === RESULT_STATUS.Pending);
}

/**
 * Текст ошибки последней генерации или null.
 *
 * @param {object} props нормализованные properties
 * @returns {string|null}
 */
export function getGeneratorError(props) {
    const results = Array.isArray(props?.results) ? props.results : [];
    if (results.some((r) => r?.status === RESULT_STATUS.Pending)) return null;
    const failed = results.find((r) => r?.status === RESULT_STATUS.Error && r?.error);
    return failed ? failed.error : null;
}

/**
 * Картинки, которые нужно показать в теле карточки.
 *
 * @param {object} props нормализованные properties
 * @returns {Array<{status: string, imageUrl: string|null, error: string|null}>}
 */
export function getVisibleResults(props) {
    return Array.isArray(props?.results) ? props.results : [];
}

/**
 * Порты узла в нормализованных координатах bbox (0..1 от левого-верхнего угла).
 *
 * Входные порты идут слева столбиком снизу вверх: изображение — на уровне нижней
 * панели, текст — на шаг выше. Выходной — справа, на уровне панели.
 * Все вынесены наружу на PORT_OUTSET, поэтому anchor.x выходит за диапазон 0..1.
 *
 * @param {{width: number, height: number}} size
 * @returns {Array<{id: string, kind: string, dataType: string, label: string, enabled: boolean, anchor: {x: number, y: number}}>}
 */
export function getGeneratorPorts(size = {}) {
    const width = Math.max(1, Number(size.width) || 1);
    const height = Math.max(1, Number(size.height) || 1);
    const footerCenter = height - GENERATOR_FOOTER_HEIGHT / 2;
    const footerCenterY = clampUnit(footerCenter / height);
    const promptY = clampUnit((footerCenter - PORT_STACK_STEP) / height);
    const outset = PORT_OUTSET / width;

    return [
        {
            id: PORT_PROMPT,
            kind: 'input',
            dataType: 'text',
            label: 'Текст',
            enabled: true,
            anchor: { x: -outset, y: promptY },
        },
        {
            id: PORT_IMAGE_IN,
            kind: 'input',
            dataType: 'image',
            label: 'Изображение',
            enabled: true,
            anchor: { x: -outset, y: footerCenterY },
        },
        {
            id: PORT_IMAGE_OUT,
            kind: 'output',
            dataType: 'image',
            label: 'Результат',
            enabled: true,
            anchor: { x: 1 + outset, y: footerCenterY },
        },
    ];
}

function clampUnit(value) {
    return Math.min(1, Math.max(0, value));
}

/**
 * Высота карточки под выбранное соотношение сторон.
 *
 * Картинка занимает узел целиком, поэтому высота узла равна высоте кадра:
 * запаса на панель нет, иначе кадр 1:1 давал бы прямоугольный узел.
 * 'auto' оставляет текущую высоту: пользователь тянет её вручную.
 *
 * @param {string} ratio
 * @param {number} width
 * @param {number} currentHeight
 * @returns {number}
 */
export function heightForRatio(ratio, width, currentHeight) {
    if (!ratio || ratio === 'auto') return Math.max(GENERATOR_MIN_BODY_HEIGHT, currentHeight);

    const [w, h] = String(ratio).split(':').map((part) => Number.parseFloat(part));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return Math.max(GENERATOR_MIN_BODY_HEIGHT, currentHeight);
    }

    return Math.max(GENERATOR_MIN_BODY_HEIGHT, Math.round((Math.max(GENERATOR_MIN_WIDTH, width) * h) / w));
}

/**
 * Высота узла со старой доски (схема 1), пересчитанная под новую геометрию.
 *
 * В схеме 1 к высоте кадра прибавлялась высота панели, поэтому у сохранённых
 * узлов кадр ниже узла на GENERATOR_FOOTER_HEIGHT. Пересчёт возможен только
 * при фиксированном соотношении сторон: высоту при 'auto' пользователь задавал
 * руками, угадывать за него нечего.
 *
 * Функция чистая и идемпотентная: для уже пересчитанного узла вернёт null.
 *
 * @param {{width?: number, height?: number, properties?: object}} objectData
 * @returns {{height: number}|null} новая высота или null, если менять нечего
 */
export function migrateGeneratorSize(objectData) {
    const props = objectData?.properties;
    if (!props || typeof props !== 'object') return null;

    const version = Number(props.schemaVersion);
    if (Number.isFinite(version) && version >= IMAGE_GENERATOR_SCHEMA_VERSION) return null;

    const ratio = props.params?.ratio;
    if (!ratio || ratio === 'auto' || !GENERATOR_RATIOS.includes(ratio)) return null;

    const width = Math.max(GENERATOR_MIN_WIDTH, Number(objectData.width) || GENERATOR_DEFAULT_WIDTH);
    const currentHeight = Number(objectData.height) || 0;
    const height = heightForRatio(ratio, width, currentHeight);

    return height === currentHeight ? null : { height };
}

/**
 * Раскладка ячеек под изображения: результаты идут в ряд слева направо,
 * как в Magnific.
 *
 * @param {number} count
 * @param {number} bodyWidth
 * @param {number} bodyHeight
 * @param {number} [gap=6]
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 */
export function layoutResultCells(count, bodyWidth, bodyHeight, gap = 6) {
    const total = Math.max(0, Number(count) || 0);
    if (total === 0) return [];

    const gaps = gap * (total - 1);
    const cellWidth = Math.max(1, (bodyWidth - gaps) / total);

    return Array.from({ length: total }, (_, index) => ({
        x: index * (cellWidth + gap),
        y: 0,
        width: cellWidth,
        height: Math.max(1, bodyHeight),
    }));
}

/**
 * Геометрия «cover»: картинка заполняет ячейку целиком, лишнее обрезается.
 *
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {{width: number, height: number}} cell
 * @returns {{scale: number, x: number, y: number, width: number, height: number}}
 */
export function coverFit(sourceWidth, sourceHeight, cell) {
    const sw = Math.max(1, Number(sourceWidth) || 1);
    const sh = Math.max(1, Number(sourceHeight) || 1);
    const cw = Math.max(1, Number(cell?.width) || 1);
    const ch = Math.max(1, Number(cell?.height) || 1);

    const scale = Math.max(cw / sw, ch / sh);
    const width = sw * scale;
    const height = sh * scale;

    return {
        scale,
        width,
        height,
        x: (cw - width) / 2,
        y: (ch - height) / 2,
    };
}
