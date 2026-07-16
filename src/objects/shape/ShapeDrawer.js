import * as PIXI from 'pixi.js';

/**
 * Рисует сегменты пунктирного контура вдоль пути из точек (замкнутый полигон).
 * PIXI v7 не поддерживает dash natively — имитируем сегментами moveTo/lineTo.
 * @param {PIXI.Graphics} g
 * @param {Array<{x:number,y:number}>} pts — вершины замкнутого полигона
 * @param {number} dash — длина штриха (px world)
 * @param {number} gap  — длина пробела (px world)
 */
function drawDashedPolygon(g, pts, dash, gap) {
    const n = pts.length;
    let offset = 0;
    let drawing = true;

    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (segLen === 0) continue;
        const ux = dx / segLen;
        const uy = dy / segLen;
        let pos = 0;

        while (pos < segLen) {
            const rem = drawing ? dash - offset : gap - offset;
            const step = Math.min(rem, segLen - pos);
            if (drawing) {
                g.moveTo(a.x + ux * pos, a.y + uy * pos);
                g.lineTo(a.x + ux * (pos + step), a.y + uy * (pos + step));
            }
            pos += step;
            offset += step;
            const period = drawing ? dash : gap;
            if (offset >= period) {
                offset = 0;
                drawing = !drawing;
            }
        }
    }
}

/**
 * Рисует пунктирный прямоугольник (замкнутый).
 * @param {PIXI.Graphics} g
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {number} dash @param {number} gap
 */
function drawDashedRect(g, x, y, w, h, dash, gap) {
    const pts = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
    ];
    drawDashedPolygon(g, pts, dash, gap);
}

/**
 * Рисует пунктирный скруглённый прямоугольник по дискретизированному периметру.
 */
function drawDashedRoundedRect(g, x, y, w, h, radius, dash, gap) {
    if (radius === 0) {
        drawDashedRect(g, x, y, w, h, dash, gap);
        return;
    }

    const points = [];
    const cornerSteps = Math.max(4, Math.ceil(radius / 2));
    const appendArc = (cx, cy, startAngle, endAngle, includeEnd = true) => {
        const lastStep = includeEnd ? cornerSteps : cornerSteps - 1;
        for (let i = 1; i <= lastStep; i++) {
            const angle = startAngle + ((endAngle - startAngle) * i) / cornerSteps;
            points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
        }
    };

    points.push({ x: x + radius, y });
    points.push({ x: x + w - radius, y });
    appendArc(x + w - radius, y + radius, -Math.PI / 2, 0);
    points.push({ x: x + w, y: y + h - radius });
    appendArc(x + w - radius, y + h - radius, 0, Math.PI / 2);
    points.push({ x: x + radius, y: y + h });
    appendArc(x + radius, y + h - radius, Math.PI / 2, Math.PI);
    points.push({ x, y: y + radius });
    appendArc(x + radius, y + radius, Math.PI, (3 * Math.PI) / 2, false);

    drawDashedPolygon(g, points, dash, gap);
}

/**
 * Рисует пунктирную окружность сегментами дуги.
 * @param {PIXI.Graphics} g
 * @param {number} cx @param {number} cy @param {number} r
 * @param {number} dash @param {number} gap
 */
function drawDashedCircle(g, cx, cy, r, dash, gap) {
    const circum = 2 * Math.PI * r;
    const total = dash + gap;
    const steps = Math.round(circum / total) || 1;
    const dashAngle = (dash / circum) * 2 * Math.PI;
    const gapAngle = (gap / circum) * 2 * Math.PI;

    for (let i = 0; i < steps; i++) {
        const startAngle = i * (dashAngle + gapAngle) - Math.PI / 2;
        const endAngle = startAngle + dashAngle;
        g.arc(cx, cy, r, startAngle, endAngle);
    }
}

/**
 * Применяет lineStyle к Graphics-объекту.
 * При borderWidth === 0 выключает контур.
 */
export function applyLineStyle(g, borderWidth, borderColor, borderOpacity) {
    if (borderWidth === 0) {
        g.lineStyle(0);
    } else {
        g.lineStyle(borderWidth, borderColor, borderOpacity);
    }
}

/**
 * Настройки штриха.
 * @param {'solid'|'dashed'|'dotted'} style
 * @returns {{ dash: number, gap: number }}
 */
function dashParams(style) {
    if (style === 'dotted') return { dash: 2, gap: 4 };
    if (style === 'dashed') return { dash: 8, gap: 6 };
    return { dash: 0, gap: 0 };
}

/**
 * Рисует фигуру в Graphics с учётом обводки, заливки и borderStyle.
 *
 * @param {PIXI.Graphics} g
 * @param {number} w         ширина (world px)
 * @param {number} h         высота (world px)
 * @param {number} color     заливка (PIXI color number)
 * @param {string} kind      тип фигуры
 * @param {number} cornerRadius
 * @param {object} stroke
 *   @param {number}  stroke.borderColor
 *   @param {number}  stroke.borderWidth
 *   @param {'solid'|'dashed'|'dotted'} stroke.borderStyle
 *   @param {number}  stroke.borderOpacity
 * @param {number} [fillOpacity=1] прозрачность заливки, 0 — без заливки
 */
export function drawShape(g, w, h, color, kind, cornerRadius, stroke, fillOpacity = 1) {
    const { borderColor, borderWidth, borderStyle, borderOpacity } = stroke;
    const isDash = borderWidth > 0 && (borderStyle === 'dashed' || borderStyle === 'dotted');
    const { dash, gap } = dashParams(borderStyle);

    g.clear();

    // --- заливка (всегда solid-геометрия через beginFill/endFill, прозрачность через alpha) ---
    // PIXI помечает fillStyle.visible=false при alpha===0 и исключает эту область из
    // GraphicsGeometry.containsPoint — фигура становится непрокликиваемой изнутри.
    // Минимальный alpha > 0 визуально неотличим от полной прозрачности, но сохраняет hit-test.
    g.lineStyle(0);
    g.beginFill(color, fillOpacity > 0 ? fillOpacity : 0.0001);
    _drawFillShape(g, w, h, kind, cornerRadius);
    g.endFill();

    // --- обводка ---
    if (borderWidth === 0) return;

    if (!isDash || (kind !== 'square' && kind !== 'rounded' && kind !== 'circle')) {
        // solid или форма без поддержки dash — одна линия через lineStyle
        applyLineStyle(g, borderWidth, borderColor, borderOpacity);
        g.beginFill(0, 0);
        _drawFillShape(g, w, h, kind, cornerRadius);
        g.endFill();
        // TODO: dashed/dotted для triangle/diamond/parallelogram/arrow — следующая фаза
    } else {
        // dash/dotted для rect/rounded/circle: рисуем сегменты без fill
        applyLineStyle(g, borderWidth, borderColor, borderOpacity);
        if (kind === 'circle') {
            const r = Math.min(w, h) / 2;
            drawDashedCircle(g, w / 2, h / 2, r, dash, gap);
        } else {
            const radius = _normalizeCornerRadius(kind, cornerRadius, w, h);
            drawDashedRoundedRect(g, 0, 0, w, h, radius, dash, gap);
        }
    }
}

/**
 * Рисует замкнутую форму для заливки (без lineStyle).
 * Используется внутри beginFill/endFill.
 */
function _drawFillShape(g, w, h, kind, cornerRadius) {
    switch (kind) {
        case 'circle': {
            const r = Math.min(w, h) / 2;
            g.drawCircle(w / 2, h / 2, r);
            break;
        }
        case 'rounded':
        case 'square': {
            const radius = _normalizeCornerRadius(kind, cornerRadius, w, h);
            if (radius > 0) {
                g.drawRoundedRect(0, 0, w, h, radius);
            } else {
                g.drawRect(0, 0, w, h);
            }
            break;
        }
        case 'triangle': {
            g.moveTo(w / 2, 0);
            g.lineTo(w, h);
            g.lineTo(0, h);
            g.lineTo(w / 2, 0);
            break;
        }
        case 'diamond': {
            g.moveTo(w / 2, 0);
            g.lineTo(w, h / 2);
            g.lineTo(w / 2, h);
            g.lineTo(0, h / 2);
            g.lineTo(w / 2, 0);
            break;
        }
        case 'parallelogram': {
            const skew = Math.min(w * 0.25, 20);
            g.moveTo(skew, 0);
            g.lineTo(w, 0);
            g.lineTo(w - skew, h);
            g.lineTo(0, h);
            g.lineTo(skew, 0);
            break;
        }
        case 'dialog': {
            const r = Math.max(2, Math.min(w, h) * 0.16);
            const bodyBottom = h - Math.max(4, h * 0.22);
            const tailRightBase = w * 0.42;
            const tailLeftBase = w * 0.24;
            const tailTipX = w * 0.18;
            g.moveTo(r, 0);
            g.lineTo(w - r, 0);
            g.arcTo(w, 0, w, r, r);
            g.lineTo(w, bodyBottom - r);
            g.arcTo(w, bodyBottom, w - r, bodyBottom, r);
            g.lineTo(tailRightBase, bodyBottom);
            g.lineTo(tailTipX, h);
            g.lineTo(tailLeftBase, bodyBottom);
            g.lineTo(r, bodyBottom);
            g.arcTo(0, bodyBottom, 0, bodyBottom - r, r);
            g.lineTo(0, r);
            g.arcTo(0, 0, r, 0, r);
            g.closePath();
            break;
        }
        case 'arrow': {
            const shaftH = Math.max(6, h * 0.3);
            const shaftY = (h - shaftH) / 2;
            g.drawRect(0, shaftY, w * 0.6, shaftH);
            g.moveTo(w * 0.6, 0);
            g.lineTo(w, h / 2);
            g.lineTo(w * 0.6, h);
            g.lineTo(w * 0.6, 0);
            break;
        }
        default: {
            g.drawRect(0, 0, w, h);
            break;
        }
    }
}

function _normalizeCornerRadius(kind, cornerRadius, w, h) {
    const fallback = kind === 'rounded' ? 10 : 0;
    const radius = Number.isFinite(cornerRadius) ? Math.max(0, cornerRadius) : fallback;
    return Math.min(radius, Math.max(0, w) / 2, Math.max(0, h) / 2);
}
