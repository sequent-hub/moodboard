import { MINDMAP_AUTOFIT, MINDMAP_LAYOUT } from './MindmapLayoutConfig.js';

const DEFAULT_WRAP_FONT_FAMILY = 'Roboto, Arial, sans-serif';

/**
 * Запас в мировых единицах между самой длинной строкой и границей капсулы.
 * Паддинги слой рисует округлёнными до css-пикселя (`round(paddingX * worldScale / res)`),
 * а измеряем мы сумму ширин символов без кернинга — оба источника дают доли пикселя в обе
 * стороны. Без запаса такая доля превращается в обрезанную последнюю букву.
 */
const WRAP_SAFETY_WORLD = 2;

let measureContext = null;
const charWidthCaches = new Map();

function getMeasureContext() {
    if (measureContext !== null) return measureContext || null;
    if (typeof document === 'undefined') {
        measureContext = false;
        return null;
    }
    try {
        measureContext = document.createElement('canvas').getContext('2d') || false;
    } catch (_) {
        measureContext = false;
    }
    return measureContext || null;
}

function getCharWidthCache(font) {
    let cache = charWidthCaches.get(font);
    if (!cache) {
        cache = new Map();
        charWidthCaches.set(font, cache);
    }
    return cache;
}

function measureCharWidth(ctx, cache, char) {
    const cached = cache.get(char);
    if (cached !== undefined) return cached;
    let width = 0;
    try {
        width = ctx.measureText(char).width;
    } catch (_) {
        width = 0;
    }
    if (!Number.isFinite(width) || width < 0) width = 0;
    cache.set(char, width);
    return width;
}

/**
 * Шрифт для измерения в МИРОВЫХ единицах: размер берётся тот, что хранится у узла
 * (`dataset.baseFontSize` / `properties.fontSize`), а не текущий css-размер. Иначе точки
 * переноса менялись бы при каждом зуме, а вместе с ними и сохранённый текст.
 */
export function buildMindmapWrapFont({ fontSize, fontFamily, bold = false, italic = false } = {}) {
    const size = Math.max(1, Math.round(Number(fontSize) || MINDMAP_LAYOUT.fontSize));
    const family = (typeof fontFamily === 'string' && fontFamily.trim().length > 0)
        ? fontFamily
        : DEFAULT_WRAP_FONT_FAMILY;
    return `${italic ? 'italic' : 'normal'} ${bold ? 700 : 400} ${size}px ${family}`;
}

/**
 * Ширина под текст в мировых единицах: максимум капсулы минус паддинги и запас.
 *
 * Множитель `resolution` — не описка. Ширину капсулы слой задаёт как `world * worldScale`
 * (MindmapHtmlTextLayer.updateOne, через toGlobal), а шрифт и паддинги внутри неё — в
 * масштабе `worldScale / resolution`. При devicePixelRatio ≠ 1 текст оказывается крупнее
 * капсулы ровно на `1 / resolution`, поэтому влезает не `maxWidth - 2 * paddingX`, а
 * `maxWidth * resolution - 2 * paddingX`.
 */
export function getMindmapMaxTextWidth({
    level = 0,
    paddingX = MINDMAP_LAYOUT.paddingX,
    resolution = 1,
} = {}) {
    const isRoot = (Number(level) || 0) === 0;
    const maxWidth = isRoot ? MINDMAP_AUTOFIT.ROOT_MAX_WIDTH : MINDMAP_AUTOFIT.CHILD_MAX_WIDTH;
    const pad = Math.max(0, Math.round(Number.isFinite(paddingX) ? paddingX : MINDMAP_LAYOUT.paddingX));
    const res = (Number.isFinite(resolution) && resolution > 0) ? resolution : 1;
    return Math.max(1, Math.floor(maxWidth * res) - 2 * pad - WRAP_SAFETY_WORLD);
}

/**
 * Раскладывает текст узла по строкам. Перенос идёт по измеренной ширине, а лимит символов
 * остаётся верхней страховкой: 50 символов сами по себе шире максимальной капсулы, поэтому
 * счёт символов давал первую строку, вылезающую за правую границу.
 *
 * Перенос жадный и посимвольный — как и прежний, так что разрывы внутри слова сохраняются.
 * Жадность важна и для каретки: перенос префикса всегда совпадает с началом переноса всей
 * строки, поэтому позицию каретки можно считать длиной перенесённого префикса.
 */
export function wrapMindmapText(value, { maxLineChars, maxTextWidth, font } = {}) {
    const text = (typeof value === 'string')
        ? value.replace(/\r/g, '').replace(/\n/g, '')
        : '';
    if (text.length === 0) return '';

    const charLimit = Math.max(1, Math.round(Number(maxLineChars) || MINDMAP_LAYOUT.maxLineChars));
    const widthLimit = (Number.isFinite(maxTextWidth) && maxTextWidth > 0) ? maxTextWidth : 0;
    const ctx = widthLimit > 0 ? getMeasureContext() : null;
    if (ctx && font) ctx.font = font;
    // Без canvas (например, в тестовой среде) остаётся прежнее поведение по числу символов.
    const cache = (ctx && font) ? getCharWidthCache(font) : null;

    const lines = [];
    let line = '';
    let lineWidth = 0;

    for (const char of text) {
        const charWidth = cache ? measureCharWidth(ctx, cache, char) : 0;
        const tooWide = Boolean(cache) && line.length > 0 && (lineWidth + charWidth) > widthLimit;
        const tooLong = line.length >= charLimit;
        if (tooWide || tooLong) {
            lines.push(line);
            line = '';
            lineWidth = 0;
        }
        line += char;
        lineWidth += charWidth;
    }
    if (line.length > 0) lines.push(line);

    return lines.join('\n');
}
