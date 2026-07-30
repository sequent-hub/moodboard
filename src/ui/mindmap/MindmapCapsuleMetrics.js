import { MINDMAP_AUTOFIT, MINDMAP_LAYOUT } from './MindmapLayoutConfig.js';

export const MINDMAP_PLACEHOLDER = 'Напишите что-нибудь';

const DEFAULT_FONT_FAMILY = 'Roboto, Arial, sans-serif';
const LINE_HEIGHT_FACTOR = 1.24;

/** Толщина обводки капсулы в экранных пикселях — совпадает с толщиной веток. */
export const MINDMAP_STROKE_SCREEN_PX = 1;

/** Толщина обводки в мировых единицах при текущем масштабе. */
export function getMindmapStrokeWorldWidth({ strokeWidth, worldScale } = {}) {
    const scale = (Number.isFinite(worldScale) && worldScale > 0) ? worldScale : 1;
    const base = Math.max(1, Number(strokeWidth) || 1);
    return (base * MINDMAP_STROKE_SCREEN_PX) / scale;
}

let measureSpan = null;

/**
 * Скрытый span с типографикой статического слоя. Ширину плейсхолдера меряем тем же
 * способом, что и MindmapHtmlTextLayer (scrollWidth), иначе призрак размещения и
 * подогнанный после приземления узел разойдутся на доли пикселя округления.
 */
function getMeasureSpan() {
    if (typeof document === 'undefined' || !document.body) return null;
    if (measureSpan && measureSpan.isConnected) return measureSpan;

    const span = document.createElement('span');
    span.className = 'mb-text--mindmap-content';
    span.style.position = 'fixed';
    span.style.left = '-99999px';
    span.style.top = '-99999px';
    span.style.visibility = 'hidden';
    span.style.pointerEvents = 'none';
    span.style.display = 'inline-block';
    span.style.maxWidth = 'none';
    span.style.whiteSpace = 'pre';
    span.style.wordBreak = 'normal';
    span.style.overflowWrap = 'normal';
    span.style.letterSpacing = '0px';
    span.style.fontKerning = 'normal';
    span.style.textRendering = 'optimizeLegibility';
    document.body.appendChild(span);
    measureSpan = span;
    return span;
}

/**
 * Css-метрики узла при текущем масштабе. Шрифт и паддинги слой рисует в масштабе
 * worldScale / resolution, тогда как саму капсулу — в worldScale (toGlobal).
 */
export function getMindmapCapsuleCssMetrics({
    fontSize,
    paddingX,
    paddingY,
    worldScale,
    resolution,
} = {}) {
    const res = (Number.isFinite(resolution) && resolution > 0) ? resolution : 1;
    const scale = (Number.isFinite(worldScale) && worldScale > 0) ? worldScale : 1;
    const sCss = scale / res;

    const baseFontSize = Math.max(1, Number(fontSize) || MINDMAP_LAYOUT.fontSize);
    const basePaddingX = Math.max(0, Math.round(Number.isFinite(paddingX) ? paddingX : MINDMAP_LAYOUT.paddingX));
    const basePaddingY = Math.max(0, Math.round(Number.isFinite(paddingY) ? paddingY : MINDMAP_LAYOUT.paddingY));
    const fontSizePx = Math.max(1, baseFontSize * sCss);

    return {
        res,
        worldScale: scale,
        sCss,
        fontSizePx,
        lineHeightPx: Math.round(fontSizePx * LINE_HEIGHT_FACTOR),
        paddingXCss: Math.max(0, Math.round(basePaddingX * sCss)),
        paddingYCss: Math.max(0, Math.round(basePaddingY * sCss)),
    };
}

/**
 * Мировая ширина капсулы по измеренной css-ширине текста.
 * ceil, а не round: недобор округления обрезает последнюю букву.
 */
export function toMindmapCapsuleWorldWidth({
    textWidthCss,
    paddingXCss,
    worldScale,
    level = 0,
} = {}) {
    const scale = (Number.isFinite(worldScale) && worldScale > 0) ? worldScale : 1;
    const isRoot = (Number(level) || 0) === 0;
    const minWidth = isRoot ? MINDMAP_AUTOFIT.ROOT_MIN_WIDTH : MINDMAP_AUTOFIT.CHILD_MIN_WIDTH;
    const maxWidth = isRoot ? MINDMAP_AUTOFIT.ROOT_MAX_WIDTH : MINDMAP_AUTOFIT.CHILD_MAX_WIDTH;
    const text = Math.max(0, Number(textWidthCss) || 0);
    const pad = Math.max(0, Number(paddingXCss) || 0);
    return Math.max(minWidth, Math.min(maxWidth, Math.ceil((text + 2 * pad) / scale)));
}

/** Мировая высота капсулы по измеренной css-высоте содержимого. */
export function toMindmapCapsuleWorldHeight({
    contentHeightCss,
    resolution,
    worldScale,
} = {}) {
    const res = (Number.isFinite(resolution) && resolution > 0) ? resolution : 1;
    const scale = (Number.isFinite(worldScale) && worldScale > 0) ? worldScale : 1;
    const height = Math.max(1, Number(contentHeightCss) || 1);
    return Math.max(1, Math.round((height * res) / scale));
}

/**
 * Мировой размер капсулы под однострочный текст — то же, что даст автоподгонка
 * статического слоя (_planNodeFit + _commitNodeFit) сразу после создания узла.
 */
export function measureMindmapCapsuleWorldSize({
    text = MINDMAP_PLACEHOLDER,
    fontSize,
    fontFamily,
    bold = false,
    italic = false,
    paddingX,
    paddingY,
    level = 0,
    worldScale,
    resolution,
} = {}) {
    const span = getMeasureSpan();
    if (!span) return null;

    const metrics = getMindmapCapsuleCssMetrics({ fontSize, paddingX, paddingY, worldScale, resolution });

    span.style.fontFamily = (typeof fontFamily === 'string' && fontFamily.trim().length > 0)
        ? fontFamily
        : DEFAULT_FONT_FAMILY;
    span.style.fontSize = `${metrics.fontSizePx}px`;
    span.style.lineHeight = `${metrics.lineHeightPx}px`;
    span.style.fontWeight = bold ? '700' : '400';
    span.style.fontStyle = italic ? 'italic' : 'normal';
    span.textContent = (typeof text === 'string' && text.length > 0) ? text : MINDMAP_PLACEHOLDER;

    const textWidthCss = Math.max(1, span.scrollWidth);

    return {
        width: toMindmapCapsuleWorldWidth({
            textWidthCss,
            paddingXCss: metrics.paddingXCss,
            worldScale: metrics.worldScale,
            level,
        }),
        height: toMindmapCapsuleWorldHeight({
            contentHeightCss: 2 * metrics.paddingYCss + metrics.lineHeightPx,
            resolution: metrics.res,
            worldScale: metrics.worldScale,
        }),
    };
}

/**
 * Подгоняет размер будущего узла под плейсхолдер ещё до приземления: призрак берёт
 * размеры из pending, поэтому иначе он показывает базовые 179×40, а на холст
 * приземляется узел, который слой тут же растягивает под «Напишите что-нибудь».
 * @returns {{width: number, height: number}|null}
 */
export function applyMindmapPlaceholderCapsuleSize(pending, { worldScale, resolution } = {}) {
    if (!pending || pending.type !== 'mindmap') return null;

    const properties = pending.properties || {};
    const size = measureMindmapCapsuleWorldSize({
        text: MINDMAP_PLACEHOLDER,
        fontSize: properties.fontSize,
        fontFamily: properties.fontFamily,
        bold: Boolean(properties.textStyle?.bold),
        italic: Boolean(properties.textStyle?.italic),
        paddingX: properties.paddingX,
        paddingY: properties.paddingY,
        level: properties.mindmap?.level ?? 0,
        worldScale,
        resolution,
    });
    if (!size) return null;

    pending.size = { ...(pending.size || {}), width: size.width, height: size.height };
    pending.properties = {
        ...properties,
        width: size.width,
        height: size.height,
        capsuleBaseWidth: size.width,
        capsuleBaseHeight: size.height,
    };
    return size;
}
