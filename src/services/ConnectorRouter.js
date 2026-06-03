/**
 * Чистая геометрия вычисления маршрутов коннекторов.
 * Без зависимостей PIXI — только координатная математика.
 */

const BEZIER_CP_RATIO = 0.4;
const BEZIER_SAMPLES  = 20;
const ELBOW_STUB      = 24; // минимальный выход перпендикулярно грани до первого поворота

/**
 * Ортогональные точки излома для elbow-маршрута.
 * Доминирующая ось определяет схему H-V-H или V-H-V.
 *
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @returns {Array<{x:number,y:number}>}
 */
export function computeElbowWaypoints(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
        const mx = Math.round((start.x + end.x) / 2);
        return [start, { x: mx, y: start.y }, { x: mx, y: end.y }, end];
    }
    const my = Math.round((start.y + end.y) / 2);
    return [start, { x: start.x, y: my }, { x: end.x, y: my }, end];
}

/**
 * Ортогональный маршрут с перпендикулярным выходом из грани и минимумом изгибов.
 * S' = startPt + startDir*ELBOW_STUB; E' = endPt + endDir*ELBOW_STUB.
 * Перпендикулярные грани → L-shape (1 изгиб); одна ось → Z-shape (навстречу)
 * или U-shape (в одну сторону), оба по 2 изгиба.
 *
 * @param {{ x:number, y:number }} startPt
 * @param {{ x:number, y:number }} startDir  единичная внешняя нормаль грани старта
 * @param {{ x:number, y:number }} endPt
 * @param {{ x:number, y:number }} endDir    единичная внешняя нормаль грани конца
 * @returns {Array<{x:number,y:number}>}
 */
function computeElbowWithDirs(startPt, startDir, endPt, endDir) {
    const S = {
        x: Math.round(startPt.x + startDir.x * ELBOW_STUB),
        y: Math.round(startPt.y + startDir.y * ELBOW_STUB),
    };
    const E = {
        x: Math.round(endPt.x + endDir.x * ELBOW_STUB),
        y: Math.round(endPt.y + endDir.y * ELBOW_STUB),
    };

    const startHoriz = Math.abs(startDir.x) >= Math.abs(startDir.y);
    const endHoriz   = Math.abs(endDir.x)   >= Math.abs(endDir.y);

    // Цель — минимум изгибов: L-shape = 1 изгиб, Z/U-shape = 2 изгиба.
    let corners;
    if (startHoriz === endHoriz) {
        // Грани на одной оси
        if (startHoriz) {
            if (Math.sign(startDir.x) === Math.sign(endDir.x)) {
                // Смотрят в одну сторону → U-shape: общий вынос по дальней кромке (2 изгиба)
                const outerX = startDir.x >= 0 ? Math.max(S.x, E.x) : Math.min(S.x, E.x);
                corners = [{ x: outerX, y: S.y }, { x: outerX, y: E.y }];
            } else {
                // Смотрят противоположно по горизонтали — различаем навстречу и врозь.
                // Навстречу: стабы сходятся, признак: (E.x - S.x) * startDir.x > 0.
                const facingEachOther = (E.x - S.x) * startDir.x > 0;
                if (facingEachOther) {
                    // Z-shape: одно вертикальное пересечение посередине (2 изгиба)
                    const midX = Math.round((S.x + E.x) / 2);
                    corners = [{ x: midX, y: S.y }, { x: midX, y: E.y }];
                } else {
                    // Грани смотрят врозь → C-shape: уходим вертикально (перпендикулярно нормали),
                    // огибаем сверху или снизу.
                    const outerY = S.y <= E.y
                        ? Math.min(S.y, E.y) - ELBOW_STUB
                        : Math.max(S.y, E.y) + ELBOW_STUB;
                    corners = [{ x: S.x, y: outerY }, { x: E.x, y: outerY }];
                }
            }
        } else if (Math.sign(startDir.y) === Math.sign(endDir.y)) {
            const outerY = startDir.y >= 0 ? Math.max(S.y, E.y) : Math.min(S.y, E.y);
            corners = [{ x: S.x, y: outerY }, { x: E.x, y: outerY }];
        } else {
            // Смотрят противоположно по вертикали — различаем навстречу и врозь.
            // Навстречу: (E.y - S.y) * startDir.y > 0.
            const facingEachOther = (E.y - S.y) * startDir.y > 0;
            if (facingEachOther) {
                const midY = Math.round((S.y + E.y) / 2);
                corners = [{ x: S.x, y: midY }, { x: E.x, y: midY }];
            } else {
                // Грани смотрят врозь → C-shape: уходим горизонтально (перпендикулярно нормали),
                // огибаем слева или справа.
                const outerX = S.x <= E.x
                    ? Math.min(S.x, E.x) - ELBOW_STUB
                    : Math.max(S.x, E.x) + ELBOW_STUB;
                corners = [{ x: outerX, y: S.y }, { x: outerX, y: E.y }];
            }
        }
    } else {
        // Перпендикулярные оси → L-shape (1 изгиб).
        // Угол стыкуем к стабу: первый сегмент продолжает выход, чтобы не плодить изломы.
        if (startHoriz) {
            corners = [{ x: E.x, y: S.y }];
        } else {
            corners = [{ x: S.x, y: E.y }];
        }
    }

    // Дедупликация соседних точек (вырожденные нулевые сегменты)
    const raw = [startPt, S, ...corners, E, endPt];
    const result = [{ x: Math.round(raw[0].x), y: Math.round(raw[0].y) }];
    for (let i = 1; i < raw.length; i++) {
        const p    = raw[i];
        const prev = result[result.length - 1];
        if (Math.abs(p.x - prev.x) > 0.5 || Math.abs(p.y - prev.y) > 0.5) {
            result.push({ x: Math.round(p.x), y: Math.round(p.y) });
        }
    }
    return result;
}


/**
 * Сэмплирует кубическую кривую Безье при параметре t∈[0,1].
 *
 * @param {{ x: number, y: number }} s начало
 * @param {{ x: number, y: number }} cp1 контрольная точка 1
 * @param {{ x: number, y: number }} cp2 контрольная точка 2
 * @param {{ x: number, y: number }} e конец
 * @param {number} t параметр [0,1]
 * @returns {{ x: number, y: number }}
 */
export function sampleBezier(s, cp1, cp2, e, t) {
    const mt = 1 - t;
    return {
        x: mt * mt * mt * s.x + 3 * mt * mt * t * cp1.x + 3 * mt * t * t * cp2.x + t * t * t * e.x,
        y: mt * mt * mt * s.y + 3 * mt * mt * t * cp1.y + 3 * mt * t * t * cp2.y + t * t * t * e.y,
    };
}

/**
 * Контрольные точки кубической кривой Безье.
 * Если переданы dir-векторы — отводятся вдоль нормали грани (перпендикулярный заход).
 * Иначе — вдоль доминирующей оси bbox (старый fallback для straight).
 *
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @param {{ x: number, y: number }|null} startDir
 * @param {{ x: number, y: number }|null} endDir
 * @returns {{ cp1: {x:number,y:number}, cp2: {x:number,y:number} }}
 */
export function bezierControlPoints(start, end, startDir = null, endDir = null) {
    if (startDir && endDir) {
        const dist   = Math.hypot(end.x - start.x, end.y - start.y);
        const offset = dist * BEZIER_CP_RATIO;
        return {
            cp1: { x: start.x + startDir.x * offset, y: start.y + startDir.y * offset },
            cp2: { x: end.x   + endDir.x   * offset, y: end.y   + endDir.y   * offset },
        };
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
        const offset = Math.abs(dx) * BEZIER_CP_RATIO;
        return {
            cp1: { x: start.x + offset, y: start.y },
            cp2: { x: end.x - offset, y: end.y },
        };
    }
    const offset = Math.abs(dy) * BEZIER_CP_RATIO;
    return {
        cp1: { x: start.x, y: start.y + offset },
        cp2: { x: end.x, y: end.y - offset },
    };
}

/**
 * Строит массив опорных точек пути по двум world-точкам и route.
 *
 * straight → [start, end]
 * elbow    → перпендикулярный выход через стаб + ортогональные изломы
 * bezier   → BEZIER_SAMPLES+1 сэмплов вдоль кривой (для hitTest и направления головы)
 *
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @param {string} route 'straight'|'elbow'|'bezier'
 * @param {{ x: number, y: number }|null} startDir  внешняя нормаль грани старта
 * @param {{ x: number, y: number }|null} endDir    внешняя нормаль грани конца
 * @returns {Array<{x:number,y:number}>}
 */
export function buildPath(start, end, route, startDir = null, endDir = null) {
    if (route === 'elbow') {
        if (startDir && endDir) {
            return computeElbowWithDirs(start, startDir, end, endDir);
        }
        return computeElbowWaypoints(start, end);
    }
    if (route === 'bezier') {
        const { cp1, cp2 } = bezierControlPoints(start, end, startDir, endDir);
        const pts = [];
        for (let i = 0; i <= BEZIER_SAMPLES; i++) {
            const p = sampleBezier(start, cp1, cp2, end, i / BEZIER_SAMPLES);
            pts.push({ x: Math.round(p.x), y: Math.round(p.y) });
        }
        return pts;
    }
    return [start, end];
}

export { BEZIER_CP_RATIO, BEZIER_SAMPLES, ELBOW_STUB };
