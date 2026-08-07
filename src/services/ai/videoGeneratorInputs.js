/**
 * Сбор входных данных узла-генератора видео из связей на холсте.
 *
 * Одна ответственность: чистые функции над массивом объектов доски.
 * Не знает ни про EventBus, ни про PIXI — поэтому покрывается unit-тестами
 * без окружения браузера.
 */

import { PORT_PROMPT, PORT_FIRST_FRAME, PORT_LAST_FRAME } from './generatorPorts.js';
import { findIncomingConnections } from './generatorConnections.js';
import { extractSourceText, extractSourceImage } from './imageGeneratorInputs.js';

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
export function collectVideoPromptInputs(objects, nodeId) {
    const connectedIds = new Set(
        findIncomingConnections(objects, nodeId, PORT_PROMPT).map((link) => link.sourceId)
    );

    const sources = [];
    let skipped = 0;

    (objects || []).forEach((obj) => {
        if (!obj?.id || !connectedIds.has(obj.id)) return;

        const text = extractSourceText(obj);
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
 * Кадр, подключённый к указанному порту.
 *
 * Порт кадра принимает ровно одно изображение: шлюз оперирует одним кадром на
 * позицию. Если подключено несколько объектов, берём первый по порядку доски —
 * порядок стабилен, поэтому результат воспроизводим.
 *
 * @param {Array<object>} objects
 * @param {string} nodeId
 * @param {string} portId
 * @returns {{id: string, src: string, name: string}|null}
 */
export function collectVideoFrameInput(objects, nodeId, portId) {
    const connectedIds = new Set(
        findIncomingConnections(objects, nodeId, portId).map((link) => link.sourceId)
    );
    if (connectedIds.size === 0) return null;

    const source = (objects || []).find((obj) => obj?.id && connectedIds.has(obj.id) && extractSourceImage(obj));
    if (!source) return null;

    return { id: source.id, ...extractSourceImage(source) };
}

/**
 * Все входы узла разом: промт, первый и последний кадр.
 *
 * @param {Array<object>} objects
 * @param {string} nodeId
 * @returns {{prompt: string, firstFrame: object|null, lastFrame: object|null}}
 */
export function collectVideoGeneratorInputs(objects, nodeId) {
    return {
        prompt: collectVideoPromptInputs(objects, nodeId).prompt,
        firstFrame: collectVideoFrameInput(objects, nodeId, PORT_FIRST_FRAME),
        lastFrame: collectVideoFrameInput(objects, nodeId, PORT_LAST_FRAME),
    };
}
