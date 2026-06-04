import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import { buildPath } from '../../../services/ConnectorRouter.js';

/**
 * Переиспользуемые хелперы жеста коннектора.
 * Все функции принимают eventBus и данные явными аргументами — без this.
 */

/**
 * Возвращает world-точку терминала.
 * Свободный терминал: terminal.point напрямую.
 * Привязанный: top-left объекта + anchor * size (CONNECTORS.md раздел 3).
 */
export function terminalWorldPoint(eventBus, terminal) {
    if (!terminal) return { x: 0, y: 0 };
    if (terminal.point) return terminal.point;

    const posData  = { objectId: terminal.boundId, position: null };
    const sizeData = { objectId: terminal.boundId, size: null };
    eventBus.emit(Events.Tool.GetObjectPosition, posData);
    eventBus.emit(Events.Tool.GetObjectSize, sizeData);

    const pos  = posData.position;
    const size = sizeData.size;
    if (pos && size) {
        return {
            x: pos.x + (terminal.anchor?.x ?? 0.5) * (size.width  || 0),
            y: pos.y + (terminal.anchor?.y ?? 0.5) * (size.height || 0),
        };
    }
    return { x: 0, y: 0 };
}

/**
 * Нормализованный якорь по позиции клика внутри bbox объекта.
 * Если объект не найден — возвращает центр { x:0.5, y:0.5 }.
 */
export function computeAnchor(eventBus, objectId, worldPt) {
    const posData  = { objectId, position: null };
    const sizeData = { objectId, size: null };
    eventBus.emit(Events.Tool.GetObjectPosition, posData);
    eventBus.emit(Events.Tool.GetObjectSize, sizeData);

    const pos  = posData.position;
    const size = sizeData.size;
    if (pos && size && size.width > 0 && size.height > 0) {
        return {
            x: Math.max(0, Math.min(1, (worldPt.x - pos.x) / size.width)),
            y: Math.max(0, Math.min(1, (worldPt.y - pos.y) / size.height)),
        };
    }
    return { x: 0.5, y: 0.5 };
}

/**
 * Рисует превью коннектора со стрелкой в PIXI-графику (PIXI 7 API).
 * Маршрут совпадает с тем, что будет создан при отпускании (по умолчанию 'elbow'),
 * поэтому «резинка» во время перетаскивания выглядит как итоговый коннектор.
 * graphics — PIXI.Graphics, уже добавленный в worldLayer.
 *
 * @param {string} route 'straight'|'elbow'|'bezier' — должен совпадать с дефолтом createConnectorFromTerminals
 */
export function drawPreview(graphics, fromWorldPt, toWorldPt, route = 'elbow') {
    graphics.clear();

    // Без привязанной грани dir-векторы неизвестны → buildPath даёт H-V-H/V-H-V излом
    const pts = buildPath(fromWorldPt, toWorldPt, route);
    if (pts.length < 2) return;

    graphics.lineStyle({ width: 2, color: 0x2563EB, alpha: 0.7, cap: 'round', join: 'round' });
    graphics.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        graphics.lineTo(pts[i].x, pts[i].y);
    }

    // Наконечник по направлению последнего сегмента — открытый chevron,
    // как у финального коннектора (ConnectorLayer.drawHead, kind='arrow').
    const tip  = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len > 10) {
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py =  ux;
        const aLen  = 12;
        const aHalf = 5;
        const bx = tip.x - ux * aLen;
        const by = tip.y - uy * aLen;
        graphics.lineStyle({ width: 2, color: 0x2563EB, alpha: 0.7, cap: 'round', join: 'round' });
        graphics.moveTo(bx + px * aHalf, by + py * aHalf);
        graphics.lineTo(tip.x, tip.y);
        graphics.lineTo(bx - px * aHalf, by - py * aHalf);
    }
}

/**
 * Создаёт объект коннектора через core.createObject с дефолтным стилем.
 * position — top-left от min(startPt, endPt).
 */
export function createConnectorFromTerminals(core, eventBus, sourceTerminal, endTerminal) {
    const startPt = terminalWorldPoint(eventBus, sourceTerminal);
    const endPt   = terminalWorldPoint(eventBus, endTerminal);
    const position = {
        x: Math.min(startPt.x, endPt.x),
        y: Math.min(startPt.y, endPt.y),
    };
    core.createObject('connector', position, {
        start: sourceTerminal,
        end: endTerminal,
        style: {
            stroke: 0x2563EB,
            width: 2,
            dash: false,
            head: { start: false, end: true },
            route: 'elbow',
        },
    });
}
