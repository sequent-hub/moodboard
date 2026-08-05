/**
 * Сбор входных данных узла-генератора из связей на холсте.
 *
 * Одна ответственность: чистые функции над массивом объектов доски.
 * Не знает ни про EventBus, ни про PIXI — поэтому покрывается unit-тестами
 * без окружения браузера.
 */

import { PORT_PROMPT, PORT_IMAGE_IN, IMAGE_GENERATOR_TYPE, RESULT_STATUS } from './imageGeneratorContract.js';

/** Типы объектов, из которых узел умеет брать текст. */
const TEXT_SOURCE_TYPES = new Set(['text', 'simple-text', 'note', 'shape']);

/** Типы объектов-картинок: их содержимое лежит в src одинаково. */
const IMAGE_SOURCE_TYPES = new Set(['image', 'revit-screenshot-img', 'model3d-screenshot-img']);

/** Расширения, по которым файл считается картинкой, когда mimeType не заполнен. */
const IMAGE_FILE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif']);

/** Порты, в которые узел принимает данные. */
const INPUT_PORTS = new Set([PORT_PROMPT, PORT_IMAGE_IN]);

/**
 * Возвращает связи, входящие в указанный узел.
 *
 * Связь считается входящей, если один из её концов привязан к узлу.
 * Направление рисования пользователю не навязываем: коннектор от текста к узлу
 * и от узла к тексту дают один и тот же смысл.
 *
 * Связи без `portId` (нарисованные до появления портов или мимо порта) считаются
 * входом промта — иначе доска, сохранённая раньше, перестала бы работать.
 *
 * @param {Array<object>} objects
 * @param {string} nodeId
 * @param {string|null} [portId=null] конкретный порт или все входные
 * @returns {Array<{connector: object, sourceId: string, portId: string}>}
 */
export function findIncomingConnections(objects, nodeId, portId = null) {
    if (!Array.isArray(objects) || !nodeId) return [];

    const links = [];

    objects.forEach((obj) => {
        if (obj?.type !== 'connector') return;

        const start = obj.properties?.start;
        const end = obj.properties?.end;

        let terminalAtNode = null;
        let otherTerminal = null;

        if (end?.boundId === nodeId) {
            terminalAtNode = end;
            otherTerminal = start;
        } else if (start?.boundId === nodeId) {
            terminalAtNode = start;
            otherTerminal = end;
        }

        if (!terminalAtNode || !otherTerminal?.boundId) return;

        const linkPort = typeof terminalAtNode.portId === 'string' ? terminalAtNode.portId : PORT_PROMPT;
        if (!INPUT_PORTS.has(linkPort)) return;
        if (portId !== null && linkPort !== portId) return;

        links.push({ connector: obj, sourceId: otherTerminal.boundId, portId: linkPort });
    });

    return links;
}

/**
 * Достаёт текст из объекта-источника.
 *
 * У текстовых объектов содержимое хранится как HTML (его рисует HtmlTextLayer),
 * поэтому разметку снимаем, а блочные переносы сохраняем.
 *
 * @param {object} object
 * @returns {string}
 */
export function extractSourceText(object) {
    if (!object || !TEXT_SOURCE_TYPES.has(object.type)) return '';

    const raw = object.properties?.content ?? object.content ?? '';
    if (typeof raw !== 'string') return '';

    return htmlToPlainText(raw);
}

/**
 * @param {string} html
 * @returns {string}
 */
export function htmlToPlainText(html) {
    return String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

/**
 * Собирает промт узла из подключённых текстовых объектов.
 *
 * Порядок источников — порядок объектов на доске: он стабилен между
 * перезагрузками, поэтому промт не «прыгает» от запуска к запуску.
 *
 * @param {Array<object>} objects
 * @param {string} nodeId
 * @returns {{prompt: string, sources: Array<{id: string, text: string}>, skipped: number}}
 */
export function collectGeneratorInputs(objects, nodeId) {
    const links = findIncomingConnections(objects, nodeId, PORT_PROMPT);
    const byId = new Map((objects || []).map((obj) => [obj?.id, obj]));

    const connectedIds = new Set(links.map((link) => link.sourceId));

    const sources = [];
    let skipped = 0;

    (objects || []).forEach((obj) => {
        if (!obj?.id || !connectedIds.has(obj.id)) return;

        const text = extractSourceText(byId.get(obj.id));
        if (text) {
            sources.push({ id: obj.id, text });
        } else {
            skipped += 1;
        }
    });

    return {
        prompt: sources.map((s) => s.text).join('\n'),
        sources,
        skipped,
    };
}

/**
 * Достаёт ссылку на картинку из объекта-источника.
 *
 * Кроме обычных изображений источником считаются результат другого узла-генератора
 * (берётся активный готовый кадр) и файловое вложение с картинкой.
 *
 * @param {object} object
 * @returns {{src: string, name: string}|null}
 */
export function extractSourceImage(object) {
    if (!object) return null;

    if (IMAGE_SOURCE_TYPES.has(object.type)) {
        return makeImageSource(object, resolveObjectSrc(object));
    }

    if (object.type === IMAGE_GENERATOR_TYPE) {
        return makeImageSource(object, resolveGeneratorResultUrl(object));
    }

    if (object.type === 'file' && isImageFile(object)) {
        return makeImageSource(object, resolveObjectSrc(object));
    }

    return null;
}

/**
 * Собирает референсные картинки узла из подключённых объектов.
 *
 * Порядок источников — порядок объектов на доске, как и у промта.
 *
 * @param {Array<object>} objects
 * @param {string} nodeId
 * @returns {{sources: Array<{id: string, src: string, name: string}>, skipped: number}}
 */
export function collectGeneratorImageInputs(objects, nodeId) {
    const links = findIncomingConnections(objects, nodeId, PORT_IMAGE_IN);
    const connectedIds = new Set(links.map((link) => link.sourceId));

    const sources = [];
    let skipped = 0;

    (objects || []).forEach((obj) => {
        if (!obj?.id || !connectedIds.has(obj.id)) return;

        const image = extractSourceImage(obj);
        if (image) {
            sources.push({ id: obj.id, ...image });
        } else {
            skipped += 1;
        }
    });

    return { sources, skipped };
}

/**
 * @param {object} object
 * @returns {string}
 */
function resolveObjectSrc(object) {
    const src = object?.src || object?.properties?.src || object?.properties?.url || object?.url;
    return typeof src === 'string' ? src.trim() : '';
}

/**
 * Готовый кадр узла-генератора: активный, а если он ещё не готов — первый готовый.
 *
 * @param {object} object
 * @returns {string}
 */
function resolveGeneratorResultUrl(object) {
    const results = Array.isArray(object?.properties?.results) ? object.properties.results : [];
    const isReady = (result) => result?.status === RESULT_STATUS.Done && typeof result?.imageUrl === 'string' && result.imageUrl.trim();

    const activeIndex = Number.isInteger(object?.properties?.activeResultIndex) ? object.properties.activeResultIndex : 0;
    const active = results[activeIndex];
    if (isReady(active)) return active.imageUrl.trim();

    const ready = results.find(isReady);
    return ready ? ready.imageUrl.trim() : '';
}

/**
 * @param {object} object
 * @returns {boolean}
 */
function isImageFile(object) {
    const mimeType = object?.properties?.mimeType;
    if (typeof mimeType === 'string' && mimeType.startsWith('image/')) return true;

    const fileName = object?.properties?.fileName;
    if (typeof fileName !== 'string') return false;

    const extension = fileName.split('.').pop();
    return typeof extension === 'string' && IMAGE_FILE_EXTENSIONS.has(extension.toLowerCase());
}

/**
 * @param {object} object
 * @param {string} src
 * @returns {{src: string, name: string}|null}
 */
function makeImageSource(object, src) {
    if (!src) return null;
    return { src, name: resolveImageName(object, src) };
}

/**
 * @param {object} object
 * @param {string} src
 * @returns {string}
 */
function resolveImageName(object, src) {
    const explicitName = object?.properties?.fileName || object?.properties?.name || object?.name;
    if (typeof explicitName === 'string' && explicitName.trim()) return explicitName.trim();

    if (!src.startsWith('data:')) {
        const lastPathPart = src.split(/[?#]/)[0].split('/').pop();
        if (lastPathPart) return lastPathPart;
    }

    return 'board-reference.png';
}
