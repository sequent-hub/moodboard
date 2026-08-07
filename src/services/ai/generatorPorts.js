/**
 * Общие данные о портах узлов-генераторов.
 *
 * Модуль-лист: ничего не импортирует, поэтому его одинаково безопасно тянуть
 * и из контракта генератора изображений, и из контракта генератора видео.
 * Идентификаторы портов и правило совместимости живут здесь, а не в контракте
 * одного узла: связь соединяет узлы разных типов, и правило обязано знать про
 * оба конца сразу.
 */

/**
 * Входной порт: размер иконки и круглой подложки под ней, world-пиксели.
 * Мировые единицы, а не CSS — порт масштабируется вместе с узлом. Подложку
 * рисует объект узла, по её размеру слой якорей строит хит-зону под старт
 * коннектора, поэтому константы общие.
 */
export const PORT_ICON_SIZE = 14;
export const PORT_CHIP_SIZE = 32;

/**
 * Зазор между краями подложек соседних портов одной грани, world-пиксели,
 * и посчитанный из него шаг между их центрами.
 */
export const PORT_STACK_GAP = 14;
export const PORT_STACK_STEP = PORT_CHIP_SIZE + PORT_STACK_GAP;

/**
 * Насколько центр порта вынесен наружу от грани карточки, world-пиксели.
 * = радиус подложки + зазор 2px между краем подложки и гранью узла.
 */
export const PORT_OUTSET = PORT_CHIP_SIZE / 2 + 2;

/**
 * Насколько конец связи не доходит до центра порта, world-пиксели.
 * Линия упирается в край подложки, наконечник у порта не рисуется.
 */
export const PORT_LINE_STOP = PORT_CHIP_SIZE / 2;

/** Идентификаторы портов. Зарезервированы: их нельзя переименовывать. */
export const PORT_PROMPT = 'prompt';
export const PORT_IMAGE_IN = 'image-in';
export const PORT_IMAGE_OUT = 'image-out';
export const PORT_FIRST_FRAME = 'first-frame';
export const PORT_LAST_FRAME = 'last-frame';
export const PORT_VIDEO_REFERENCE = 'video-reference';
export const PORT_VIDEO_OUT = 'video-out';
export const PORT_FIRST_FRAME_OUT = 'first-frame-out';
export const PORT_LAST_FRAME_OUT = 'last-frame-out';

/**
 * Роль и тип данных каждого порта — единственный источник правды для
 * совместимости концов связи.
 *
 * @type {Record<string, {kind: 'input'|'output', dataType: string}>}
 */
export const PORT_KINDS = {
    [PORT_PROMPT]: { kind: 'input', dataType: 'text' },
    [PORT_IMAGE_IN]: { kind: 'input', dataType: 'image' },
    [PORT_IMAGE_OUT]: { kind: 'output', dataType: 'image' },
    [PORT_FIRST_FRAME]: { kind: 'input', dataType: 'image' },
    [PORT_LAST_FRAME]: { kind: 'input', dataType: 'image' },
    [PORT_VIDEO_REFERENCE]: { kind: 'input', dataType: 'video' },
    [PORT_VIDEO_OUT]: { kind: 'output', dataType: 'video' },
    [PORT_FIRST_FRAME_OUT]: { kind: 'output', dataType: 'image' },
    [PORT_LAST_FRAME_OUT]: { kind: 'output', dataType: 'image' },
};

/**
 * Совместима ли пара портов на концах связи.
 *
 * Ограничение касается только портов-выходов: выход отдаёт готовый результат и
 * имеет смысл ровно в паре со входом того же типа данных. Остальные привязки
 * правил не получают — обычные объекты и текстовый вход работают как раньше.
 * Поэтому кадр из генератора изображений подключается к первому кадру видео
 * (оба порта про изображение), а к порту текста — нет.
 *
 * Направление рисования не важно: связь от выхода ко входу и от входа к выходу
 * означают одно и то же, как и в findIncomingConnections.
 *
 * @param {string|null} sourcePortId порт на конце-источнике; null — свободный конец или объект без портов
 * @param {string|null} targetPortId порт на конце-цели
 * @returns {boolean}
 */
export function canConnectPorts(sourcePortId, targetPortId) {
    const source = PORT_KINDS[sourcePortId] || null;
    const target = PORT_KINDS[targetPortId] || null;

    const sourceIsOutput = source?.kind === 'output';
    const targetIsOutput = target?.kind === 'output';

    if (!sourceIsOutput && !targetIsOutput) return true;
    if (sourceIsOutput && targetIsOutput) return false;

    const output = sourceIsOutput ? source : target;
    const input = sourceIsOutput ? target : source;

    return input?.kind === 'input' && input.dataType === output.dataType;
}

/**
 * Та же проверка для пары терминалов связи.
 *
 * @param {object|null} sourceTerminal
 * @param {object|null} targetTerminal
 * @returns {boolean}
 */
export function canConnectTerminals(sourceTerminal, targetTerminal) {
    return canConnectPorts(sourceTerminal?.portId || null, targetTerminal?.portId || null);
}

/**
 * Порты-выходы, с которых допустима ровно одна связь.
 *
 * @param {string|null} portId
 * @returns {boolean}
 */
export function isSingleLinkOutputPort(portId) {
    return PORT_KINDS[portId]?.kind === 'output';
}
