/**
 * ConnectorBindingResolver — чистая логика преобразования терминала в world-точку.
 *
 * Реализует алгоритм из раздела 4 CONNECTORS.md:
 *  1. isPrecise=false  → центр объекта
 *  2. isPrecise=true   → worldAnchor = topLeft + { anchor.x·w, anchor.y·h }
 *  3. isExact=false    → проекция на кромку AABB через Liang–Barsky;
 *                        для повёрнутого объекта: луч переводится в локальные координаты.
 *  4. isExact=true     → точная world-точка без отсечения
 *  5. Свободный терминал { point } → возвращается как есть
 *
 * Нет зависимостей от PIXI; только чистые математические операции.
 */

// ---------------------------------------------------------------------------
// Вспомогательные функции

/**
 * Поворачивает вектор на угол (в радианах).
 * @param {{ x: number, y: number }} pt
 * @param {number} angle  радианы, положительный = CCW
 * @returns {{ x: number, y: number }}
 */
function rotateVector(pt, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: pt.x * cos - pt.y * sin,
        y: pt.x * sin + pt.y * cos,
    };
}

/**
 * Liang–Barsky для AABB с центром в начале координат (half-widths hw × hh).
 *
 * `from` — точка внутри (или на границе) прямоугольника [-hw..hw] × [-hh..hh].
 * `to`   — произвольная точка; возвращает точку выхода из прямоугольника по лучу from→to.
 *
 * Если from === to, возвращает from (на границе) через simple clamp.
 *
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {number} hw  half-width (> 0)
 * @param {number} hh  half-height (> 0)
 * @returns {{ x: number, y: number }}
 */
function clipRayToAABB(from, to, hw, hh) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
        // Вырожденный луч — clamp from на границу
        const cx = Math.max(-hw, Math.min(hw, from.x));
        const cy = Math.max(-hh, Math.min(hh, from.y));
        return { x: cx, y: cy };
    }

    // Минимальный t такой, что p(t) = from + t*(to−from) выходит за AABB
    let tExit = 1.0;

    if (Math.abs(dx) > 1e-10) {
        const tEdge = (dx > 0 ? hw - from.x : -hw - from.x) / dx;
        if (tEdge >= 0) tExit = Math.min(tExit, tEdge);
    }
    if (Math.abs(dy) > 1e-10) {
        const tEdge = (dy > 0 ? hh - from.y : -hh - from.y) / dy;
        if (tEdge >= 0) tExit = Math.min(tExit, tEdge);
    }

    return {
        x: from.x + tExit * dx,
        y: from.y + tExit * dy,
    };
}

/**
 * Грань и единичная внешняя нормаль из нормализованного якоря [0..1].
 * Возвращает локальные координаты (центр объекта = 0,0): на какой кромке сидит якорь
 * и куда смотрит нормаль. Координата вдоль кромки сохраняется из якоря.
 *
 * @returns {{ dir: {x:number,y:number}, point: {x:number,y:number} }}
 */
function faceFromAnchor(anchor, width, height, hw, hh) {
    const ax  = Math.max(0, Math.min(1, anchor?.x ?? 0.5));
    const ay  = Math.max(0, Math.min(1, anchor?.y ?? 0.5));
    const lax = ax * width  - hw;
    const lay = ay * height - hh;
    const dTop = ay, dBottom = 1 - ay, dLeft = ax, dRight = 1 - ax;
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    if (min === dTop)    return { dir: { x: 0,  y: -1 }, point: { x: lax,  y: -hh } };
    if (min === dBottom) return { dir: { x: 0,  y: 1  }, point: { x: lax,  y: hh  } };
    if (min === dLeft)   return { dir: { x: -1, y: 0  }, point: { x: -hw,  y: lay } };
    return                      { dir: { x: 1,  y: 0  }, point: { x: hw,   y: lay } };
}

// ---------------------------------------------------------------------------

export class ConnectorBindingResolver {
    /**
     * Разрешает терминал в world-point.
     *
     * @param {Object} terminal
     *   Привязанный:  { boundId, anchor:{x,y}, isPrecise, isExact }
     *   Свободный:    { point:{x,y} }
     * @param {Object|null} target
     *   Объект из state.objects с полями: position:{x,y}, width, height, rotation?
     * @param {{ x: number, y: number }|null} otherTerminalWorld
     *   Уже разрешённая world-точка противоположного конца.
     *   Используется при isExact=false для проекции на кромку.
     *   Если null — отсечение не производится, возвращается precisePoint.
     * @returns {{ x: number, y: number }}
     */
    static resolve(terminal, target, otherTerminalWorld = null) {
        // --- Свободный терминал ---
        if (!terminal?.boundId) {
            return { x: terminal?.point?.x ?? 0, y: terminal?.point?.y ?? 0 };
        }

        if (!target) {
            return { x: 0, y: 0 };
        }

        const left   = target.position?.x ?? 0;
        const top    = target.position?.y ?? 0;
        const width  = target.width  ?? target.properties?.width  ?? 0;
        const height = target.height ?? target.properties?.height ?? 0;
        const angle  = target.rotation ?? target.properties?.rotation ?? 0;

        const cx = left + width  / 2;
        const cy = top  + height / 2;
        const hw = width  / 2;
        const hh = height / 2;

        // --- Точка привязки в локальных координатах (начало в центре объекта) ---
        // isPrecise=false → центр объекта (0, 0) в локальных
        // isPrecise=true  → anchor.x·w − w/2, anchor.y·h − h/2
        let localAnchorX = 0;
        let localAnchorY = 0;
        if (terminal.isPrecise) {
            const ax = terminal.anchor?.x ?? 0.5;
            const ay = terminal.anchor?.y ?? 0.5;
            localAnchorX = ax * width  - hw;
            localAnchorY = ay * height - hh;
        }

        // --- precisePoint в world-space ---
        const worldPrecise = angle !== 0
            ? {
                x: cx + rotateVector({ x: localAnchorX, y: localAnchorY }, angle).x,
                y: cy + rotateVector({ x: localAnchorX, y: localAnchorY }, angle).y,
              }
            : { x: cx + localAnchorX, y: cy + localAnchorY };

        // --- isExact=true → возвращаем точную точку без отсечения ---
        if (terminal.isExact) {
            return worldPrecise;
        }

        // --- isExact=false → проекция на кромку AABB ---
        if (!otherTerminalWorld) {
            // Нет информации о другом конце — вернуть precisePoint
            return worldPrecise;
        }

        if (hw <= 0 || hh <= 0) {
            return worldPrecise;
        }

        // Переводим противоположный терминал в локальную систему координат цели
        const ox = otherTerminalWorld.x - cx;
        const oy = otherTerminalWorld.y - cy;
        const localOther = angle !== 0
            ? rotateVector({ x: ox, y: oy }, -angle)
            : { x: ox, y: oy };

        // Обрезаем луч localAnchor → localOther по AABB
        const exitLocal = clipRayToAABB(
            { x: localAnchorX, y: localAnchorY },
            localOther,
            hw,
            hh
        );

        // Возвращаем в world-space
        const worldExit = angle !== 0
            ? {
                x: cx + rotateVector(exitLocal,  angle).x,
                y: cy + rotateVector(exitLocal,  angle).y,
              }
            : { x: cx + exitLocal.x, y: cy + exitLocal.y };

        return worldExit;
    }

    /**
     * Разрешает терминал в дескриптор {point, dir} — точку на грани и внешнюю нормаль.
     * Используется для elbow и bezier, где выход обязан быть перпендикулярен грани.
     *
     * @param {Object} terminal
     *   Привязанный:  { boundId, anchor:{x,y}, isPrecise, isExact }
     *   Свободный:    { point:{x,y} }
     * @param {Object|null} target
     * @param {{ x: number, y: number }|null} otherCenter
     *   Центр другого объекта (или свободная точка другого конца) для выбора стороны.
     * @returns {{ point: {x:number,y:number}, dir: {x:number,y:number} }}
     */
    static resolveWithSide(terminal, target, otherCenter = null) {
        // Свободный терминал: точка как есть, dir — к другому концу
        if (!terminal?.boundId) {
            const pt = { x: terminal?.point?.x ?? 0, y: terminal?.point?.y ?? 0 };
            const dx = otherCenter ? otherCenter.x - pt.x : 0;
            const dy = otherCenter ? otherCenter.y - pt.y : 0;
            const len = Math.hypot(dx, dy);
            const dir = len > 1e-6 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
            return { point: pt, dir };
        }

        if (!target) {
            return { point: { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
        }

        const left   = target.position?.x ?? 0;
        const top    = target.position?.y ?? 0;
        const width  = target.width  ?? target.properties?.width  ?? 0;
        const height = target.height ?? target.properties?.height ?? 0;
        const angle  = target.rotation ?? target.properties?.rotation ?? 0;

        const cx = left + width  / 2;
        const cy = top  + height / 2;
        const hw = width  / 2;
        const hh = height / 2;

        // Вектор к другому объекту в локальных координатах цели
        const rawDx = (otherCenter?.x ?? cx) - cx;
        const rawDy = (otherCenter?.y ?? cy) - cy;
        const localD = angle !== 0
            ? rotateVector({ x: rawDx, y: rawDy }, -angle)
            : { x: rawDx, y: rawDy };

        let localDir;
        let facePoint;

        // Привязка к конкретной точке-коннектору (isPrecise): грань и нормаль берём
        // из самого якоря — коннектор обязан выходить именно из той точки, куда привязан,
        // а не из геометрически ближайшей грани.
        if (terminal.isPrecise && hw > 0 && hh > 0) {
            const face = faceFromAnchor(terminal.anchor, width, height, hw, hh);
            localDir  = face.dir;
            facePoint = face.point;
        } else if (Math.abs(localD.x) >= Math.abs(localD.y)) {
            // Привязка к центру → выбор грани по доминирующей оси к другому объекту
            if (localD.x >= 0) {
                localDir  = { x: 1, y: 0 };
                facePoint = { x: hw, y: 0 };
            } else {
                localDir  = { x: -1, y: 0 };
                facePoint = { x: -hw, y: 0 };
            }
        } else if (localD.y >= 0) {
            localDir  = { x: 0, y: 1 };
            facePoint = { x: 0, y: hh };
        } else {
            localDir  = { x: 0, y: -1 };
            facePoint = { x: 0, y: -hh };
        }

        // Перевод в world-space
        const worldFace = angle !== 0
            ? {
                x: cx + rotateVector(facePoint, angle).x,
                y: cy + rotateVector(facePoint, angle).y,
              }
            : { x: cx + facePoint.x, y: cy + facePoint.y };

        const worldDirRaw = angle !== 0 ? rotateVector(localDir, angle) : localDir;
        const dLen = Math.hypot(worldDirRaw.x, worldDirRaw.y);
        const dir  = dLen > 1e-6
            ? { x: worldDirRaw.x / dLen, y: worldDirRaw.y / dLen }
            : { x: 1, y: 0 };

        return {
            point: { x: Math.round(worldFace.x), y: Math.round(worldFace.y) },
            dir,
        };
    }
}

// ---------------------------------------------------------------------------

/**
 * Расстояние от точки до отрезка [a, b].
 * Используется в ConnectorLayer.hitTest (Фаза 2).
 *
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq < 1e-10) {
        return Math.hypot(point.x - a.x, point.y - a.y);
    }

    const t = Math.max(0, Math.min(1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq
    ));

    return Math.hypot(
        point.x - (a.x + t * dx),
        point.y - (a.y + t * dy)
    );
}
