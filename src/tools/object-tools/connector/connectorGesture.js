import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';
import { buildPath } from '../../../services/ConnectorRouter.js';
import { drawHead, getLineTrim, trimPolylineEnd } from '../../../ui/connectors/connectorHeadGeometry.js';

/**
 * Переиспользуемые хелперы жеста коннектора.
 * Все функции принимают eventBus и данные явными аргументами — без this.
 */

/** Типы объектов, к которым можно привязать коннектор (из ConnectionAnchorsLayer). */
export const ALLOWED_BIND_TYPES = new Set(['shape', 'note', 'image', 'text', 'simple-text', 'file', 'image-generator', 'video-generator']);
/** Радиус поиска ближайшего объекта при клике по якорю (world-px). */
export const CLICK_FIND_RADIUS = 400;
/** Зазор между дубликатом и источником при автосоздании (world-px). */
export const CLONE_GAP = 60;
/** Минимальный зазор между новым объектом и любым существующим при поиске свободного места (world-px). */
export const PLACEMENT_CLEARANCE = 12;
/** Радиус скругления углов превью-линии (world-px); совпадает с ELBOW_RADIUS в ConnectorLayer. */
export const PREVIEW_CORNER_RADIUS = 14;
/** Цвет и прозрачность превью-линии: тот же синий, что у готового коннектора, но светлее. */
const PREVIEW_COLOR = 0x2563EB;
const PREVIEW_ALPHA = 0.7;

/** Возвращает мировые bounds объекта как {x, y, width, height} (top-left). */
export function objectBounds(eventBus, objectId) {
    const posData  = { objectId, position: null };
    const sizeData = { objectId, size: null };
    eventBus.emit(Events.Tool.GetObjectPosition, posData);
    eventBus.emit(Events.Tool.GetObjectSize, sizeData);
    if (!posData.position || !sizeData.size) return null;
    return { x: posData.position.x, y: posData.position.y, ...sizeData.size };
}

/** Определяет сторону объекта по нормализованному якорю [0,1]. */
export function sideFromAnchor(anchor) {
    const ax = anchor?.x ?? 0.5;
    const ay = anchor?.y ?? 0.5;
    if (ax <= 0.1) return 'left';
    if (ax >= 0.9) return 'right';
    if (ay <= 0.1) return 'top';
    if (ay >= 0.9) return 'bottom';
    return 'right';
}

/**
 * Ищет ближайший допустимый объект, чей центр лежит в полуплоскости
 * от стороны side и в пределах radius world-px.
 */
export function findNearestInHalfplane(eventBus, core, sourceId, sourceBounds, side, radius) {
    const cx = sourceBounds.x + sourceBounds.width  / 2;
    const cy = sourceBounds.y + sourceBounds.height / 2;
    const objects = core?.state?.state?.objects;
    if (!Array.isArray(objects)) return null;

    let best = null, bestDist = Infinity;
    for (const obj of objects) {
        if (!obj || obj.id === sourceId) continue;
        if (!ALLOWED_BIND_TYPES.has(obj.type)) continue;
        const bounds = objectBounds(eventBus, obj.id);
        if (!bounds) continue;
        const ocx = bounds.x + bounds.width  / 2;
        const ocy = bounds.y + bounds.height / 2;
        if (side === 'right'  && ocx <= cx) continue;
        if (side === 'left'   && ocx >= cx) continue;
        if (side === 'bottom' && ocy <= cy) continue;
        if (side === 'top'    && ocy >= cy) continue;
        const dist = Math.hypot(ocx - cx, ocy - cy);
        if (dist > radius || dist >= bestDist) continue;
        bestDist = dist;
        best = obj;
    }
    return best;
}

/** Вычисляет top-left позицию дубликата со сдвигом в сторону side. */
export function offsetPos(sourceBounds, side) {
    const { x, y, width, height } = sourceBounds;
    switch (side) {
        case 'left':   return { x: x - width  - CLONE_GAP, y };
        case 'top':    return { x, y: y - height - CLONE_GAP };
        case 'bottom': return { x, y: y + height + CLONE_GAP };
        default:       return { x: x + width  + CLONE_GAP, y };
    }
}

/** AABB-пересечение двух rect {x,y,width,height} с учётом зазора margin. */
function rectsOverlap(a, b, margin) {
    return a.x - margin < b.x + b.width
        && a.x + a.width + margin > b.x
        && a.y - margin < b.y + b.height
        && a.y + a.height + margin > b.y;
}

/** Первый объект (кроме источника и коннекторов), пересекающий candidate-rect. bounds или null. */
function firstBlocker(eventBus, objects, sourceId, rect) {
    for (const obj of objects) {
        if (!obj || obj.id === sourceId || obj.type === 'connector') continue;
        const b = objectBounds(eventBus, obj.id);
        if (!b || !(b.width > 0) || !(b.height > 0)) continue;
        if (rectsOverlap(rect, b, PLACEMENT_CLEARANCE)) return b;
    }
    return null;
}

/**
 * Есть ли видимая область экрана сверху для кандидата (его верх не уходит за
 * верхнюю кромку канваса). Пересчёт мир→экран через worldLayer (scale+position)
 * и логический размер renderer.screen. Если данных нет — считаем видимым.
 */
function hasVisibleAreaAbove(core, worldPos) {
    const world = core?.pixi?.worldLayer;
    const screen = core?.pixi?.app?.renderer?.screen;
    if (!world || !screen) return true;
    const scale = world.scale?.x ?? 1;
    const topScreen = worldPos.y * scale + (world.position?.y ?? 0);
    return topScreen >= 0;
}

/**
 * Свободная top-left позиция для нового объекта.
 * - Рядом (offsetPos) свободно → ставим сбоку, как раньше.
 * - Иначе есть сосед: ставим НАД ним (по центру, зазор CLONE_GAP), а если сверху
 *   занято другими объектами или сверху нет видимой области экрана — ПОД ним.
 */
export function resolveFreePlacement(eventBus, core, sourceId, sourceBounds, side) {
    const { width, height } = sourceBounds;
    const defaultPos = offsetPos(sourceBounds, side);
    const objects = core?.state?.state?.objects;
    if (!Array.isArray(objects)) return defaultPos;

    const blocker = firstBlocker(eventBus, objects, sourceId, { x: defaultPos.x, y: defaultPos.y, width, height });
    if (!blocker) return defaultPos;

    const centerX = Math.round(blocker.x + blocker.width / 2 - width / 2);
    const abovePos = { x: centerX, y: Math.round(blocker.y - height - CLONE_GAP) };
    const belowPos = { x: centerX, y: Math.round(blocker.y + blocker.height + CLONE_GAP) };

    const aboveFree    = !firstBlocker(eventBus, objects, sourceId, { x: abovePos.x, y: abovePos.y, width, height });
    const aboveVisible = hasVisibleAreaAbove(core, abovePos);

    return (aboveFree && aboveVisible) ? abovePos : belowPos;
}

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
 * Маршрут совпадает с тем, что будет создан при отпускании (по умолчанию 'bezier'),
 * поэтому «резинка» во время перетаскивания выглядит как итоговый коннектор.
 * graphics — PIXI.Graphics, уже добавленный в worldLayer.
 *
 * @param {string} route 'straight'|'elbow'|'bezier' — должен совпадать с дефолтом createConnectorFromTerminals
 * @param {Array<{x:number,y:number}>|null} points готовый маршрут (напр. с обходом препятствий); иначе строится buildPath
 * @param {{ head?: string, endTrim?: number }} [options] head='none' — без наконечника,
 *        endTrim — свой отступ конца линии вместо просвета под наконечник
 */
export function drawPreview(graphics, fromWorldPt, toWorldPt, route = 'bezier', points = null, options = {}) {
    graphics.clear();
    const head    = options.head ?? 'arrow';
    const endTrim = Number.isFinite(options.endTrim) ? options.endTrim : getLineTrim(head);

    // Без привязанной грани dir-векторы неизвестны → buildPath даёт H-V-H/V-H-V излом
    const pts = (points && points.length >= 2) ? points : buildPath(fromWorldPt, toWorldPt, route);
    if (pts.length < 2) return;

    // Линия обрывается у основания наконечника плюс просвет — та же геометрия,
    // что у готового коннектора, иначе превью выглядит иначе, чем итог.
    const linePts = trimPolylineEnd(pts, endTrim);

    graphics.lineStyle({ width: 2, color: PREVIEW_COLOR, alpha: PREVIEW_ALPHA, cap: 'round', join: 'round' });
    graphics.moveTo(linePts[0].x, linePts[0].y);
    // Скругляем углы дугой — тем же радиусом, что финальный коннектор
    // (ConnectorLayer.drawPolylineSolid), чтобы превью и итог выглядели одинаково.
    for (let i = 1; i < linePts.length - 1; i++) {
        const prev = linePts[i - 1];
        const curr = linePts[i];
        const next = linePts[i + 1];
        const dxIn = curr.x - prev.x;
        const dyIn = curr.y - prev.y;
        const lenIn = Math.hypot(dxIn, dyIn);
        const dxOut = next.x - curr.x;
        const dyOut = next.y - curr.y;
        const lenOut = Math.hypot(dxOut, dyOut);
        if (lenIn < 1e-6 || lenOut < 1e-6) {
            graphics.lineTo(curr.x, curr.y);
            continue;
        }
        const r = Math.min(PREVIEW_CORNER_RADIUS, lenIn / 2, lenOut / 2);
        graphics.lineTo(curr.x - (dxIn / lenIn) * r, curr.y - (dyIn / lenIn) * r);
        graphics.quadraticCurveTo(curr.x, curr.y, curr.x + (dxOut / lenOut) * r, curr.y + (dyOut / lenOut) * r);
    }
    graphics.lineTo(linePts[linePts.length - 1].x, linePts[linePts.length - 1].y);

    if (head !== 'none') {
        drawHead(graphics, pts[pts.length - 2], pts[pts.length - 1], PREVIEW_COLOR, head, 2, PREVIEW_ALPHA);
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
            route: 'bezier',
        },
    });
}
