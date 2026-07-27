/**
 * Геометрия наконечников коннектора: размеры, отступ линии и отрисовка маркера.
 *
 * Общий модуль для готового коннектора (ConnectorLayer) и превью-«резинки»
 * (connectorGesture.drawPreview) — иначе превью и итог расходятся визуально.
 * Зависит только от PIXI.Graphics-совместимого приёмника, сам PIXI не импортирует.
 */

export const ARROW_LEN     = 12;
export const ARROW_HALF    = 5;
export const CIRCLE_R      = 4;
export const DIAMOND_HALF  = 5;
/** Просвет между концом линии и основанием маркера. */
export const HEAD_GAP      = 4;

/** Сколько пикселей отступить от кончика маркера, чтобы линия не заходила внутрь него. */
export function getHeadSetback(kind) {
    if (kind === 'arrow')    return ARROW_LEN;
    if (kind === 'triangle') return ARROW_LEN;
    if (kind === 'circle')   return CIRCLE_R * 2;
    if (kind === 'diamond')  return DIAMOND_HALF * 2;
    return 0;
}

/** Просвет перед маркером. Только у открытой стрелки: у заливных маркеров он не читается. */
export function getHeadGap(kind) {
    return kind === 'arrow' ? HEAD_GAP : 0;
}

/** Полный отступ линии от кончика маркера: длина маркера плюс просвет. */
export function getLineTrim(kind) {
    return getHeadSetback(kind) + getHeadGap(kind);
}

/**
 * Укорачивает ломаную с конца на dist, идя назад по звеньям.
 * Звено короче остатка съедается целиком — иначе при коротком финальном звене
 * (обход препятствий даёт стаб в 12px и меньше) наконечник ложился бы поверх линии.
 * Всегда оставляет минимум две точки.
 *
 * @param {Array<{x:number,y:number}>} pts
 * @param {number} dist
 * @returns {Array<{x:number,y:number}>}
 */
export function trimPolylineEnd(pts, dist) {
    if (!(dist > 0) || pts.length < 2) return pts;
    const out = pts.slice();
    let remain = dist;
    while (remain > 0 && out.length >= 2) {
        const n   = out.length;
        const tp  = out[n - 1];
        const fp  = out[n - 2];
        const dx  = tp.x - fp.x;
        const dy  = tp.y - fp.y;
        const len = Math.hypot(dx, dy);
        if (len <= 1e-6) {
            if (out.length === 2) return out;
            out.pop();
            continue;
        }
        if (len > remain) {
            out[n - 1] = {
                x: Math.round(tp.x - (dx / len) * remain),
                y: Math.round(tp.y - (dy / len) * remain),
            };
            return out;
        }
        if (out.length === 2) {
            out[1] = { x: fp.x, y: fp.y };
            return out;
        }
        out.pop();
        remain -= len;
    }
    return out;
}

/**
 * Рисует наконечник в tipPt, направление fromPt→tipPt.
 *
 * @param {PIXI.Graphics} g
 * @param {{ x:number, y:number }} fromPt  предпоследняя точка
 * @param {{ x:number, y:number }} tipPt   кончик
 * @param {number} color   PIXI-цвет
 * @param {string} kind    HeadKind: 'none'|'arrow'|'triangle'|'circle'|'diamond'
 * @param {number} lineWidth  толщина линии коннектора (для согласованной толщины наконечника)
 * @param {number} alpha   прозрачность (превью рисуется полупрозрачным)
 */
export function drawHead(g, fromPt, tipPt, color, kind, lineWidth = 2, alpha = 1) {
    if (kind === 'none') return;
    const dx  = tipPt.x - fromPt.x;
    const dy  = tipPt.y - fromPt.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py =  ux;

    g.lineStyle(0);

    if (kind === 'arrow') {
        // Единый штрих крыло→кончик→крыло: round-join даёт чистый острый кончик,
        // round-cap — аккуратные концы крыльев. Толщина = толщине линии.
        const bx = tipPt.x - ux * ARROW_LEN;
        const by = tipPt.y - uy * ARROW_LEN;
        const w  = Math.max(2, lineWidth + 0.5);
        try {
            g.lineStyle({ width: w, color, alpha, cap: 'round', join: 'round' });
        } catch (_) {
            g.lineStyle(w, color, alpha);
        }
        g.moveTo(Math.round(bx + px * ARROW_HALF), Math.round(by + py * ARROW_HALF));
        g.lineTo(Math.round(tipPt.x), Math.round(tipPt.y));
        g.lineTo(Math.round(bx - px * ARROW_HALF), Math.round(by - py * ARROW_HALF));
        g.lineStyle(0);
    } else if (kind === 'triangle') {
        const bx = tipPt.x - ux * ARROW_LEN;
        const by = tipPt.y - uy * ARROW_LEN;
        g.beginFill(color, alpha);
        g.drawPolygon([
            Math.round(tipPt.x),               Math.round(tipPt.y),
            Math.round(bx + px * ARROW_HALF),  Math.round(by + py * ARROW_HALF),
            Math.round(bx - px * ARROW_HALF),  Math.round(by - py * ARROW_HALF),
        ]);
        g.endFill();
    } else if (kind === 'circle') {
        const cx = Math.round(tipPt.x - ux * CIRCLE_R);
        const cy = Math.round(tipPt.y - uy * CIRCLE_R);
        g.beginFill(color, alpha);
        g.drawCircle(cx, cy, CIRCLE_R);
        g.endFill();
    } else if (kind === 'diamond') {
        // Ромб: вершина в tipPt, тыл на расстоянии 2×DIAMOND_HALF
        const mx = tipPt.x - ux * DIAMOND_HALF;
        const my = tipPt.y - uy * DIAMOND_HALF;
        g.beginFill(color, alpha);
        g.drawPolygon([
            Math.round(tipPt.x),                          Math.round(tipPt.y),
            Math.round(mx + px * DIAMOND_HALF),           Math.round(my + py * DIAMOND_HALF),
            Math.round(tipPt.x - ux * 2 * DIAMOND_HALF),  Math.round(tipPt.y - uy * 2 * DIAMOND_HALF),
            Math.round(mx - px * DIAMOND_HALF),           Math.round(my - py * DIAMOND_HALF),
        ]);
        g.endFill();
    }
}
