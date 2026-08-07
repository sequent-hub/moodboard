/**
 * Связи узлов-генераторов на холсте.
 *
 * Одна ответственность: чистые функции над массивом объектов доски. Работают
 * для любого узла с портами — набор портов берётся из общего `generatorPorts.js`,
 * поэтому генератор изображений и генератор видео обслуживаются одним кодом.
 */

import { PORT_KINDS, PORT_PROMPT, isSingleLinkOutputPort } from './generatorPorts.js';

/** Порты, в которые узел принимает данные. */
const INPUT_PORTS = new Set(
    Object.keys(PORT_KINDS).filter((id) => PORT_KINDS[id].kind === 'input')
);

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
 * Возвращает связи, выходящие из порта-результата узла.
 *
 * Конец связи на узле опознаётся по portId: в отличие от входов, у выхода нет
 * поведения «по умолчанию» — связь без portId выходной не считается, иначе любая
 * старая связь занимала бы порт.
 *
 * @param {Array<object>} objects
 * @param {string} nodeId
 * @param {string|null} [ignoreConnectorId=null] связь, которую сейчас перетаскивают: свой же конец порт не занимает
 * @param {string|null} [nodePortId=null] конкретный выход узла или любой
 * @returns {Array<{connector: object, targetId: string|null, portId: string|null, nodePortId: string}>}
 */
export function findOutgoingConnections(objects, nodeId, ignoreConnectorId = null, nodePortId = null) {
    if (!Array.isArray(objects) || !nodeId) return [];

    const links = [];

    objects.forEach((obj) => {
        if (obj?.type !== 'connector' || (ignoreConnectorId && obj.id === ignoreConnectorId)) return;

        const start = obj.properties?.start;
        const end = obj.properties?.end;

        const terminalAtNode = [start, end].find((terminal) => (
            terminal?.boundId === nodeId
            && isSingleLinkOutputPort(terminal?.portId)
            && (nodePortId === null || terminal.portId === nodePortId)
        ));
        if (!terminalAtNode) return;

        const other = terminalAtNode === start ? end : start;
        links.push({
            connector: obj,
            targetId: other?.boundId || null,
            portId: typeof other?.portId === 'string' ? other.portId : null,
            nodePortId: terminalAtNode.portId,
        });
    });

    return links;
}

/**
 * Занят ли порт-результат: с него допустима ровно одна связь.
 *
 * @param {Array<object>} objects
 * @param {string} nodeId
 * @param {string|null} [ignoreConnectorId=null]
 * @param {string|null} [nodePortId=null] конкретный выход узла или любой
 * @returns {boolean}
 */
export function isOutputPortBusy(objects, nodeId, ignoreConnectorId = null, nodePortId = null) {
    return findOutgoingConnections(objects, nodeId, ignoreConnectorId, nodePortId).length > 0;
}
