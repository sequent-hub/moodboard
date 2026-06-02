import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';

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
 * Рисует превью линии со стрелкой в PIXI-графику (PIXI 7 API).
 * graphics — PIXI.Graphics, уже добавленный в worldLayer.
 */
export function drawPreview(graphics, fromWorldPt, toWorldPt) {
    graphics.clear();

    graphics.lineStyle({ width: 2, color: 0x2563EB, alpha: 0.7, cap: 'round' });
    graphics.moveTo(fromWorldPt.x, fromWorldPt.y);
    graphics.lineTo(toWorldPt.x, toWorldPt.y);

    const dx = toWorldPt.x - fromWorldPt.x;
    const dy = toWorldPt.y - fromWorldPt.y;
    const len = Math.hypot(dx, dy);
    if (len > 10) {
        const ux = dx / len;
        const uy = dy / len;
        const aLen = 10;
        const aAng = 0.4;
        graphics.beginFill(0x2563EB, 0.7);
        graphics.drawPolygon([
            toWorldPt.x, toWorldPt.y,
            toWorldPt.x - aLen * (ux * Math.cos(aAng)  - uy * Math.sin(aAng)),
            toWorldPt.y - aLen * (uy * Math.cos(aAng)  + ux * Math.sin(aAng)),
            toWorldPt.x - aLen * (ux * Math.cos(-aAng) - uy * Math.sin(-aAng)),
            toWorldPt.y - aLen * (uy * Math.cos(-aAng) + ux * Math.sin(-aAng)),
        ]);
        graphics.endFill();
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
            route: 'straight',
        },
    });
}
