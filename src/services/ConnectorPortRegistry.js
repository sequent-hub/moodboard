import { Events } from '../core/events/Events.js';
import { IMAGE_GENERATOR_TYPE, getGeneratorPorts } from './ai/imageGeneratorContract.js';
import { VIDEO_GENERATOR_TYPE, getVideoGeneratorPorts } from './ai/videoGeneratorContract.js';
import { canConnectPorts, isSingleLinkOutputPort } from './ai/generatorPorts.js';
import { isOutputPortBusy } from './ai/generatorConnections.js';

/**
 * Реестр именованных портов объектов.
 *
 * Обычные объекты холста портов не объявляют — для них связь по-прежнему
 * привязывается к произвольной точке границы, как и раньше. Объект, который
 * реализует getConnectionPorts(), получает фиксированный набор точек: связь
 * к ним примагничивается, а в терминал дополнительно пишется portId. Терминалы
 * без portId остаются валидными — их разрешает старая логика по anchor.
 */

/** Радиус примагничивания к порту, CSS-пиксели. */
export const PORT_SNAP_CSS = 22;

/** Префикс id DOM-точки порта. */
const PORT_DOM_ID_PREFIX = 'mb-port';

/**
 * Уникальный id DOM-точки порта.
 *
 * Пара «объект + порт» уникальна на доске, поэтому по такому id точка находится
 * однозначно даже когда на холсте несколько узлов одного типа. Нужен там, где
 * нельзя опереться на порядок элементов: автотесты, скрипты проверки, адресные стили.
 *
 * @param {string} objectId
 * @param {string} portId
 * @returns {string}
 */
export function portDomId(objectId, portId) {
    return `${PORT_DOM_ID_PREFIX}-${objectId}-${portId}`;
}

/**
 * Порты по типу объекта, посчитанные из его размеров — без PIXI и DOM.
 * Нужны там, где доступен только объект состояния: резолвер геометрии связи
 * работает до и независимо от сцены.
 */
const PORTS_BY_TYPE = {
    [IMAGE_GENERATOR_TYPE]: (object) => getGeneratorPorts({
        width: object.width ?? object.properties?.width,
        height: object.height ?? object.properties?.height,
    }),
    [VIDEO_GENERATOR_TYPE]: (object) => getVideoGeneratorPorts({
        width: object.width ?? object.properties?.width,
        height: object.height ?? object.properties?.height,
    }),
};

/**
 * @param {object|null} object объект состояния доски
 * @returns {Array<object>}
 */
export function getPortsFromState(object) {
    const factory = object?.type ? PORTS_BY_TYPE[object.type] : null;
    return factory ? factory(object) : [];
}

/**
 * Терминал с актуальной геометрией порта.
 *
 * Сохранённый в связи anchor — лишь снимок на момент рисования. Источник истины
 * о положении порта — сам объект: он двигает порт при изменении размера, а новая
 * версия клиента может перенести порт совсем. Без пересчёта старые связи
 * упирались бы в грань, пока порт уехал наружу.
 *
 * @param {object} terminal
 * @param {object|null} target объект состояния, к которому привязан терминал
 * @returns {object} исходный терминал либо копия с актуальным якорем
 */
export function withCurrentPortAnchor(terminal, target) {
    if (!terminal?.portId || !target) return terminal;

    const port = getPortsFromState(target).find((item) => item?.id === terminal.portId);
    if (!port?.anchor) return terminal;

    return { ...terminal, anchor: { ...port.anchor }, isPrecise: true, isExact: true };
}

/**
 * @param {object} eventBus
 * @param {string} objectId
 * @returns {Array<{id: string, kind: string, dataType: string, label: string, enabled: boolean, anchor: {x: number, y: number}}>}
 */
export function getObjectPorts(eventBus, objectId) {
    if (!eventBus || !objectId) return [];

    const req = { objectId, pixiObject: null };
    eventBus.emit(Events.Tool.GetObjectPixi, req);

    return getPortsFromPixi(req.pixiObject);
}

/**
 * @param {object|null} pixiObject
 * @returns {Array<object>}
 */
export function getPortsFromPixi(pixiObject) {
    const instance = pixiObject?._mb?.instance;
    if (!instance || typeof instance.getConnectionPorts !== 'function') return [];

    try {
        const ports = instance.getConnectionPorts();
        return Array.isArray(ports) ? ports : [];
    } catch (_) {
        return [];
    }
}

/**
 * Ближайший порт, к которому можно привязать конец связи.
 *
 * @param {Array<object>} ports
 * @param {{x: number, y: number, width: number, height: number}} bounds world-габариты объекта
 * @param {{x: number, y: number}} worldPoint
 * @param {number} worldScale текущий масштаб холста
 * @param {number} [thresholdCss=PORT_SNAP_CSS]
 * @param {((port: object) => boolean)|null} [isPortAllowed=null] правило жеста: порт, который сейчас не принимает связь
 * @returns {{portId: string, anchor: {x: number, y: number}}|null}
 */
export function findNearestPort(ports, bounds, worldPoint, worldScale = 1, thresholdCss = PORT_SNAP_CSS, isPortAllowed = null) {
    if (!Array.isArray(ports) || ports.length === 0 || !bounds || !worldPoint) return null;

    const threshold = thresholdCss / Math.max(0.0001, worldScale);
    let best = null;
    let bestDistance = threshold;

    ports.forEach((port) => {
        if (!port || port.enabled === false || !port.anchor) return;
        if (isPortAllowed && !isPortAllowed(port)) return;

        const px = bounds.x + port.anchor.x * bounds.width;
        const py = bounds.y + port.anchor.y * bounds.height;
        const distance = Math.hypot(worldPoint.x - px, worldPoint.y - py);

        if (distance <= bestDistance) {
            bestDistance = distance;
            best = { portId: port.id, anchor: { x: port.anchor.x, y: port.anchor.y } };
        }
    });

    return best;
}

/**
 * Ближайшая цель-порт рядом с точкой — без опоры на hit-test объекта.
 *
 * Порты вынесены за габарит карточки, поэтому курсор над самим портом в
 * прямоугольник объекта не попадает и hit-test возвращает пустоту. Поиск идёт
 * по объектам состояния, которые объявляют порты: их немного, а сравнение —
 * одно расстояние на порт.
 *
 * @param {object} eventBus
 * @param {Array<object>} objects объекты состояния доски
 * @param {{x: number, y: number}} worldPoint
 * @param {number} [worldScale=1]
 * @param {string|null} [excludeBoundId] объект, к которому уже привязан другой конец связи
 * @param {((port: object, targetId: string) => boolean)|null} [isPortAllowed=null] правило жеста
 * @returns {{boundId: string, portId: string, anchor: {x: number, y: number}, point: {x: number, y: number}, bounds: object}|null}
 */
export function findPortTargetNear(eventBus, objects, worldPoint, worldScale = 1, excludeBoundId = null, isPortAllowed = null) {
    if (!eventBus || !Array.isArray(objects) || !worldPoint) return null;

    let best = null;
    let bestDistance = Infinity;

    objects.forEach((object) => {
        if (!object?.id || object.id === excludeBoundId) return;
        if (!PORTS_BY_TYPE[object.type]) return;

        const req = { objectId: object.id, pixiObject: null };
        eventBus.emit(Events.Tool.GetObjectPixi, req);

        const bounds = portTargetBounds(eventBus, object.id, req.pixiObject);
        if (!bounds) return;

        const port = findNearestPort(
            getPortsFromPixi(req.pixiObject),
            bounds,
            worldPoint,
            worldScale,
            PORT_SNAP_CSS,
            isPortAllowed ? (candidate) => isPortAllowed(candidate, object.id) : null,
        );
        if (!port) return;

        const point = {
            x: bounds.x + port.anchor.x * bounds.width,
            y: bounds.y + port.anchor.y * bounds.height,
        };
        const distance = Math.hypot(worldPoint.x - point.x, worldPoint.y - point.y);
        if (distance >= bestDistance) return;

        bestDistance = distance;
        best = { boundId: object.id, portId: port.portId, anchor: port.anchor, point, bounds };
    });

    return best;
}

/**
 * Единственный порт объекта, который принимает связь этого жеста.
 *
 * Нужен, когда конец жеста пришёлся на тело карточки, а не на саму иконку порта:
 * если правило оставило ровно один вариант, гадать не о чем — связь идёт в него.
 * Два и больше подходящих порта выбор за пользователя не делают: там работает
 * обычная привязка к грани.
 *
 * @param {Array<object>} ports
 * @param {((port: object, targetId: string) => boolean)|null} isPortAllowed правило жеста
 * @param {string} targetId
 * @returns {{portId: string, anchor: {x: number, y: number}}|null}
 */
export function soleCompatiblePort(ports, isPortAllowed, targetId) {
    if (!Array.isArray(ports) || typeof isPortAllowed !== 'function') return null;

    const allowed = ports.filter((port) => (
        port && port.enabled !== false && port.anchor && isPortAllowed(port, targetId)
    ));
    if (allowed.length !== 1) return null;

    const port = allowed[0];
    return { portId: port.id, anchor: { x: port.anchor.x, y: port.anchor.y } };
}

/**
 * World-габариты объекта, от которых считаются нормализованные якоря портов.
 *
 * Источник истины — сам объект сцены: он задаёт минимальные размеры карточки, и
 * его геометрия расходится с размером в состоянии (например, у узла, созданного
 * без явных width/height). По размеру из состояния порт уезжал бы мимо иконки.
 * События позиции и размера остаются запасным путём для объектов без инстанса.
 *
 * @param {object} eventBus
 * @param {string} objectId
 * @param {object|null} pixiObject
 * @returns {{x: number, y: number, width: number, height: number}|null}
 */
function portTargetBounds(eventBus, objectId, pixiObject) {
    const instance = pixiObject?._mb?.instance;
    const width = Number(instance?.width);
    const height = Number(instance?.height);

    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return { x: pixiObject.x - width / 2, y: pixiObject.y - height / 2, width, height };
    }

    const posData = { objectId, position: null };
    const sizeData = { objectId, size: null };
    eventBus.emit(Events.Tool.GetObjectPosition, posData);
    eventBus.emit(Events.Tool.GetObjectSize, sizeData);

    if (!posData.position || !sizeData.size) return null;

    return {
        x: posData.position.x,
        y: posData.position.y,
        width: sizeData.size.width,
        height: sizeData.size.height,
    };
}

/**
 * Терминал связи для порта: anchor дублируется, чтобы старые резолверы
 * геометрии работали без изменений.
 *
 * isExact=true — конец связи приходит ровно в точку порта. Без этого якорь
 * проецируется на кромку объекта, и у вынесенного наружу порта между линией
 * и кружком оставался бы зазор.
 *
 * @param {string} boundId
 * @param {{portId: string, anchor: {x: number, y: number}}} port
 * @returns {object}
 */
export function terminalForPort(boundId, port) {
    return {
        boundId,
        portId: port.portId,
        anchor: { ...port.anchor },
        isPrecise: true,
        isExact: true,
    };
}

/**
 * Свободен ли порт — правило для конца связи, который только выбирают.
 *
 * Совместимость пары здесь не проверяется: у начала жеста второго конца ещё нет.
 *
 * @param {Array<object>} objects объекты состояния доски
 * @param {string|null} [ignoreConnectorId=null] связь, конец которой перетаскивают
 * @returns {(port: object, targetId: string) => boolean}
 */
export function portAvailabilityRule(objects, ignoreConnectorId = null) {
    return (port, targetId) => {
        if (!isSingleLinkOutputPort(port?.id)) return true;

        return !isOutputPortBusy(objects, targetId, ignoreConnectorId, port.id);
    };
}

/**
 * Правило выбора порта-цели: порт свободен и совместим с портом на другом конце.
 *
 * @param {Array<object>} objects объекты состояния доски
 * @param {string|null} sourcePortId порт на уже закреплённом конце связи
 * @param {string|null} [ignoreConnectorId=null] связь, конец которой перетаскивают
 * @returns {(port: object, targetId: string) => boolean}
 */
export function portTargetRule(objects, sourcePortId, ignoreConnectorId = null) {
    const isFree = portAvailabilityRule(objects, ignoreConnectorId);

    return (port, targetId) => canConnectPorts(sourcePortId || null, port?.id || null) && isFree(port, targetId);
}
