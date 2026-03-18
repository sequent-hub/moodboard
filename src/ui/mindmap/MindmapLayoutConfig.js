const MINDMAP_COMPACT_SCALE = 0.8;
const MINDMAP_ROOT_SIZE_FACTOR = 0.5;
const MINDMAP_ROOT_WIDTH_FACTOR = 0.73;
const MINDMAP_ROOT_FONT_FACTOR = 0.85;
const MINDMAP_ROOT_PADDING_FACTOR = 0.5;

const MINDMAP_BASE_LAYOUT = Object.freeze({
    width: 306,
    height: 100,
    fontSize: 20,
    paddingX: 50,
    paddingY: 50,
    maxLineChars: 50,
});

function scaleInt(value) {
    return Math.max(1, Math.round(value * MINDMAP_COMPACT_SCALE));
}

export const MINDMAP_LAYOUT = Object.freeze({
    scale: MINDMAP_COMPACT_SCALE,
    width: Math.max(1, Math.round(scaleInt(MINDMAP_BASE_LAYOUT.width) * MINDMAP_ROOT_WIDTH_FACTOR)),
    height: Math.max(1, Math.round(scaleInt(MINDMAP_BASE_LAYOUT.height) * MINDMAP_ROOT_SIZE_FACTOR)),
    fontSize: Math.max(1, Math.round(scaleInt(MINDMAP_BASE_LAYOUT.fontSize) * MINDMAP_ROOT_FONT_FACTOR)),
    paddingX: Math.max(1, Math.round(scaleInt(MINDMAP_BASE_LAYOUT.paddingX) * MINDMAP_ROOT_PADDING_FACTOR)),
    paddingY: Math.max(1, Math.round(scaleInt(MINDMAP_BASE_LAYOUT.paddingY) * MINDMAP_ROOT_PADDING_FACTOR)),
    maxLineChars: MINDMAP_BASE_LAYOUT.maxLineChars,
});

