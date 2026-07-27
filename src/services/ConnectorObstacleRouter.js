/**
 * Ортогональная маршрутизация elbow-коннектора с обходом препятствий.
 * Чистая геометрия, без PIXI. Работает поверх ConnectorRouter.buildPath.
 *
 * Алгоритм: A* по «сетке Ханана» — линии сетки проходят по инфлейтнутым кромкам
 * препятствий плюс координаты концов и перпендикулярных стабов. Узлы вне интерьера
 * препятствий, рёбра между ортогонально-соседними видимыми узлами. Стоимость —
 * длина сегмента + штраф за поворот (минимум изломов). Если дефолтный elbow ничего
 * не задевает — возвращается он же (быстрый типовой путь).
 */

import { buildPath, ELBOW_STUB } from './ConnectorRouter.js';

const DEFAULT_CLEARANCE = 12;
const TURN_PENALTY = 24;
const EPS = 0.5;

/** Инфлейт прямоугольника {x,y,width,height} → {left,top,right,bottom}. */
function inflate(r, m) {
    return {
        left: r.x - m,
        top: r.y - m,
        right: r.x + r.width + m,
        bottom: r.y + r.height + m,
    };
}

/** Точка строго внутри прямоугольника (без кромки). */
function insideStrict(px, py, r) {
    return px > r.left + EPS && px < r.right - EPS && py > r.top + EPS && py < r.bottom - EPS;
}

/** Пересекает ли осевой сегмент a→b интерьер прямоугольника r (кромка допустима). */
function segHitsRect(a, b, r) {
    if (Math.abs(a.y - b.y) <= EPS) {
        const y = a.y;
        if (y <= r.top + EPS || y >= r.bottom - EPS) return false;
        const x1 = Math.min(a.x, b.x);
        const x2 = Math.max(a.x, b.x);
        return x1 < r.right - EPS && x2 > r.left + EPS;
    }
    if (Math.abs(a.x - b.x) <= EPS) {
        const x = a.x;
        if (x <= r.left + EPS || x >= r.right - EPS) return false;
        const y1 = Math.min(a.y, b.y);
        const y2 = Math.max(a.y, b.y);
        return y1 < r.bottom - EPS && y2 > r.top + EPS;
    }
    return false;
}

/** Задевает ли полилиния pts хоть один прямоугольник. */
function pathHitsAny(pts, rects) {
    for (let i = 1; i < pts.length; i++) {
        for (const r of rects) {
            if (segHitsRect(pts[i - 1], pts[i], r)) return true;
        }
    }
    return false;
}

/** Убирает дубли и коллинеарные средние точки. */
function simplify(pts) {
    const dedup = [];
    for (const p of pts) {
        const prev = dedup[dedup.length - 1];
        if (!prev || Math.abs(p.x - prev.x) > EPS || Math.abs(p.y - prev.y) > EPS) {
            dedup.push({ x: Math.round(p.x), y: Math.round(p.y) });
        }
    }
    const out = [];
    for (let i = 0; i < dedup.length; i++) {
        const prev = out[out.length - 1];
        const cur = dedup[i];
        const next = dedup[i + 1];
        if (prev && next) {
            const collinearX = Math.abs(prev.x - cur.x) <= EPS && Math.abs(cur.x - next.x) <= EPS;
            const collinearY = Math.abs(prev.y - cur.y) <= EPS && Math.abs(cur.y - next.y) <= EPS;
            if (collinearX || collinearY) continue;
        }
        out.push(cur);
    }
    return out;
}

/** A*-маршрут в обход препятствий между стабами S и E. Возвращает точки S..E или null. */
function astarRoute(start, startDir, end, endDir, rects, stub, validateStubs = false) {
    const S = {
        x: Math.round(start.x + startDir.x * stub),
        y: Math.round(start.y + startDir.y * stub),
    };
    const E = {
        x: Math.round(end.x + endDir.x * stub),
        y: Math.round(end.y + endDir.y * stub),
    };
    if (rects.some((r) => insideStrict(S.x, S.y, r)) || rects.some((r) => insideStrict(E.x, E.y, r))) {
        return null;
    }
    // Удлинённый стаб может проколоть соседа: сами отрезки start→S и E→end A* не проверяет.
    if (validateStubs && (pathHitsAny([start, S], rects) || pathHitsAny([E, end], rects))) {
        return null;
    }

    const xsSet = new Set([S.x, E.x]);
    const ysSet = new Set([S.y, E.y]);
    for (const r of rects) {
        xsSet.add(Math.round(r.left));
        xsSet.add(Math.round(r.right));
        ysSet.add(Math.round(r.top));
        ysSet.add(Math.round(r.bottom));
    }
    const xs = [...xsSet].sort((a, b) => a - b);
    const ys = [...ysSet].sort((a, b) => a - b);
    const xi = new Map(xs.map((v, i) => [v, i]));
    const yi = new Map(ys.map((v, i) => [v, i]));

    const cols = xs.length;
    const rows = ys.length;
    const nodeId = (cx, cy) => cx * rows + cy;

    const blocked = (cx, cy) => {
        const px = xs[cx];
        const py = ys[cy];
        return rects.some((r) => insideStrict(px, py, r));
    };
    const edgeOpen = (cx1, cy1, cx2, cy2) => {
        const a = { x: xs[cx1], y: ys[cy1] };
        const b = { x: xs[cx2], y: ys[cy2] };
        return !rects.some((r) => segHitsRect(a, b, r));
    };

    const sCx = xi.get(S.x);
    const sCy = yi.get(S.y);
    const eCx = xi.get(E.x);
    const eCy = yi.get(E.y);
    if (sCx == null || sCy == null || eCx == null || eCy == null) return null;
    if (blocked(sCx, sCy) || blocked(eCx, eCy)) return null;

    const startId = nodeId(sCx, sCy);
    const goalId = nodeId(eCx, eCy);

    const gScore = new Map([[startId, 0]]);
    const cameFrom = new Map();
    const axisOf = new Map(); // ось входа в узел: 'h' | 'v'
    // Начальная ось — по направлению стаба
    axisOf.set(startId, Math.abs(startDir.x) >= Math.abs(startDir.y) ? 'h' : 'v');

    const heuristic = (cx, cy) => Math.abs(xs[cx] - E.x) + Math.abs(ys[cy] - E.y);
    const open = [{ id: startId, f: heuristic(sCx, sCy) }];

    const neighbors = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
    ];

    while (open.length > 0) {
        let bestIdx = 0;
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < open[bestIdx].f) bestIdx = i;
        }
        const current = open.splice(bestIdx, 1)[0];
        if (current.id === goalId) break;

        const ccx = Math.floor(current.id / rows);
        const ccy = current.id % rows;
        const curG = gScore.get(current.id) ?? Infinity;
        const curAxis = axisOf.get(current.id);

        for (const [dx, dy] of neighbors) {
            const ncx = ccx + dx;
            const ncy = ccy + dy;
            if (ncx < 0 || ncx >= cols || ncy < 0 || ncy >= rows) continue;
            if (blocked(ncx, ncy)) continue;
            if (!edgeOpen(ccx, ccy, ncx, ncy)) continue;

            const segLen = Math.abs(xs[ncx] - xs[ccx]) + Math.abs(ys[ncy] - ys[ccy]);
            if (segLen <= EPS) continue;
            const moveAxis = dx !== 0 ? 'h' : 'v';
            const turn = curAxis && curAxis !== moveAxis ? TURN_PENALTY : 0;
            const tentative = curG + segLen + turn;

            const nId = nodeId(ncx, ncy);
            if (tentative < (gScore.get(nId) ?? Infinity)) {
                gScore.set(nId, tentative);
                cameFrom.set(nId, current.id);
                axisOf.set(nId, moveAxis);
                const f = tentative + heuristic(ncx, ncy);
                const existing = open.find((o) => o.id === nId);
                if (existing) existing.f = f;
                else open.push({ id: nId, f });
            }
        }
    }

    if (!gScore.has(goalId)) return null;

    const path = [];
    let cur = goalId;
    while (cur !== undefined) {
        const cx = Math.floor(cur / rows);
        const cy = cur % rows;
        path.push({ x: xs[cx], y: ys[cy] });
        cur = cameFrom.get(cur);
    }
    path.reverse();
    return path;
}

/**
 * Строит elbow-маршрут start→end с обходом препятствий.
 *
 * @param {{x:number,y:number}} start точка на кромке источника
 * @param {{x:number,y:number}} startDir внешняя нормаль грани старта
 * @param {{x:number,y:number}} end точка на кромке цели
 * @param {{x:number,y:number}} endDir внешняя нормаль грани цели
 * @param {Array<{x:number,y:number,width:number,height:number}>} obstacles препятствия (top-left rects)
 * @param {{clearance?:number}} [opts]
 * @returns {Array<{x:number,y:number}>}
 */
export function routeElbowAvoiding(start, startDir, end, endDir, obstacles = [], opts = {}) {
    const clearance = Number.isFinite(opts.clearance) ? opts.clearance : DEFAULT_CLEARANCE;
    const defaultPath = buildPath(start, end, 'elbow', startDir, endDir);

    if (!startDir || !endDir) return defaultPath;

    const validObstacles = (obstacles || [])
        .filter((r) => r && Number.isFinite(r.x) && Number.isFinite(r.y) && r.width > 0 && r.height > 0);

    const baseRects = validObstacles.map((r) => inflate(r, clearance));
    if (baseRects.length === 0 || !pathHitsAny(defaultPath, baseRects)) {
        return defaultPath;
    }

    // Адаптивный clearance: при близком соседе стаб (кромка + clearance вдоль нормали)
    // попадает внутрь инфлейтнутого препятствия и A* сдаётся. Тогда уменьшаем зазор,
    // пока стаб не выйдет из тесного промежутка. Интерьер препятствий не пересекаем
    // при любом clearance ≥ 1 — segHitsRect проверяет фактические кромки.
    const steps = [];
    for (const c of [clearance, Math.round(clearance / 2), Math.round(clearance / 4), 2, 1]) {
        if (c >= 1 && !steps.includes(c)) steps.push(c);
    }
    // Финальное звено маршрута обязано быть длиннее наконечника, иначе стрелка ложится
    // на угол колена (стаб = clearance давал 12px и меньше). Сначала пробуем стаб
    // ELBOW_STUB, как у дефолтного elbow; если A* не проходит — откат к стабу = clearance.
    for (const stub of [ELBOW_STUB, null]) {
        for (const c of steps) {
            const rects = validObstacles.map((r) => inflate(r, c));
            const grid = astarRoute(start, startDir, end, endDir, rects, stub ?? c, stub !== null);
            if (grid && grid.length > 0) {
                return simplify([start, ...grid, end]);
            }
        }
    }

    return defaultPath;
}

export { DEFAULT_CLEARANCE };
