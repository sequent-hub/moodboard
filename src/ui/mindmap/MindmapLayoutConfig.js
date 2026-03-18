const MINDMAP_COMPACT_SCALE = 0.8;

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
    width: scaleInt(MINDMAP_BASE_LAYOUT.width),
    height: scaleInt(MINDMAP_BASE_LAYOUT.height),
    fontSize: scaleInt(MINDMAP_BASE_LAYOUT.fontSize),
    paddingX: scaleInt(MINDMAP_BASE_LAYOUT.paddingX),
    paddingY: scaleInt(MINDMAP_BASE_LAYOUT.paddingY),
    maxLineChars: MINDMAP_BASE_LAYOUT.maxLineChars,
});

