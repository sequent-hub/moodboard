/**
 * Каталог узлов-генераторов, которые холст умеет создавать сам.
 *
 * Нужен там, где узел создаётся не кнопкой панели, а по ходу жеста: связь
 * дотянули до пустого места, и вместо обрыва пользователю предлагают создать
 * узел, который эту связь примет. Список кандидатов считается из тех же
 * контрактов, что рисуют порты, — отдельной таблицы соответствий нет, поэтому
 * погашенный порт автоматически исчезает из меню.
 */

import {
    IMAGE_GENERATOR_TYPE,
    GENERATOR_DEFAULT_WIDTH,
    createDefaultGeneratorProperties,
    getGeneratorPorts,
} from './imageGeneratorContract.js';
import {
    VIDEO_GENERATOR_TYPE,
    VIDEO_DEFAULT_WIDTH,
    VIDEO_DEFAULT_HEIGHT,
    createDefaultVideoGeneratorProperties,
    getVideoGeneratorPorts,
} from './videoGeneratorContract.js';
import { canConnectPorts } from './generatorPorts.js';

/** Стартовая карточка генератора изображений квадратная — как в панели инструментов. */
const IMAGE_DEFAULT_HEIGHT = GENERATOR_DEFAULT_WIDTH;

/**
 * @typedef {object} GeneratorNodeEntry
 * @property {string} type тип объекта холста
 * @property {string} label подпись в меню
 * @property {{width: number, height: number}} size размер новой карточки
 * @property {() => object} createProperties свойства новой карточки
 * @property {(size: {width: number, height: number}) => Array<object>} getPorts порты карточки
 */

/** @type {GeneratorNodeEntry[]} */
export const GENERATOR_NODE_CATALOG = [
    {
        type: IMAGE_GENERATOR_TYPE,
        label: 'Генератор изображений',
        size: { width: GENERATOR_DEFAULT_WIDTH, height: IMAGE_DEFAULT_HEIGHT },
        createProperties: createDefaultGeneratorProperties,
        getPorts: getGeneratorPorts,
    },
    {
        type: VIDEO_GENERATOR_TYPE,
        label: 'Генератор видео',
        size: { width: VIDEO_DEFAULT_WIDTH, height: VIDEO_DEFAULT_HEIGHT },
        createProperties: createDefaultVideoGeneratorProperties,
        getPorts: getVideoGeneratorPorts,
    },
];

/**
 * Узлы, которые можно создать под свободный конец связи, идущей от этого порта.
 *
 * Кандидат попадает в список, только если у него ровно один включённый вход,
 * совместимый с источником: при двух подходящих входах непонятно, в какой из
 * них приземлять связь, и выбор пришлось бы спрашивать вторым шагом.
 *
 * @param {string|null} sourcePortId порт, с которого тянут связь
 * @returns {Array<GeneratorNodeEntry & {port: {portId: string, anchor: {x: number, y: number}}}>}
 */
export function findGeneratorDropCandidates(sourcePortId) {
    if (!sourcePortId) return [];

    return GENERATOR_NODE_CATALOG.reduce((acc, entry) => {
        const matches = entry.getPorts(entry.size).filter((port) => (
            port
            && port.enabled !== false
            && port.kind === 'input'
            && port.anchor
            && canConnectPorts(sourcePortId, port.id)
        ));
        if (matches.length !== 1) return acc;

        const port = matches[0];
        acc.push({ ...entry, port: { portId: port.id, anchor: { x: port.anchor.x, y: port.anchor.y } } });
        return acc;
    }, []);
}
