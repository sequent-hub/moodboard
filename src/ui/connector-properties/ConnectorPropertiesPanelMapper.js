import { Events } from '../../core/events/Events.js';

// ── Цветовые пресеты линии ──────────────────────────────────────────────────

export const STROKE_COLOR_PRESETS = [
    { color: '#2563EB', value: 0x2563EB, name: 'Синий' },
    { color: '#111827', value: 0x111827, name: 'Чёрный' },
    { color: '#6B7280', value: 0x6B7280, name: 'Серый' },
    { color: '#EF4444', value: 0xEF4444, name: 'Красный' },
    { color: '#F59E0B', value: 0xF59E0B, name: 'Жёлтый' },
    { color: '#10B981', value: 0x10B981, name: 'Зелёный' },
    { color: '#8B5CF6', value: 0x8B5CF6, name: 'Фиолетовый' },
    { color: '#EC4899', value: 0xEC4899, name: 'Розовый' },
    { color: '#06B6D4', value: 0x06B6D4, name: 'Голубой' },
    { color: '#FFFFFF', value: 0xFFFFFF, name: 'Белый' },
];

// ── Пресеты ширины ───────────────────────────────────────────────────────────

export const WIDTH_PRESETS = [1, 2, 4, 8];

// ── Варианты маршрута ────────────────────────────────────────────────────────

export const ROUTE_OPTIONS = [
    { value: 'straight', label: 'Прямая' },
    { value: 'elbow',    label: 'Угловой' },
    { value: 'bezier',   label: 'Кривая' },
];

// ── Варианты наконечника ─────────────────────────────────────────────────────

export const HEAD_OPTIONS = [
    { value: 'none',     label: '—  нет' },
    { value: 'arrow',    label: '→  стрелка' },
    { value: 'triangle', label: '▷  треугольник' },
    { value: 'circle',   label: '○  круг' },
    { value: 'diamond',  label: '◇  ромб' },
];

// ── Дефолтный style коннектора ───────────────────────────────────────────────

export const CONNECTOR_STYLE_DEFAULTS = {
    stroke: 0x2563EB,
    width: 2,
    dash: false,
    route: 'elbow',
    head: { start: 'none', end: 'arrow' },
};

// ── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Конвертирует PIXI-число (0xRRGGBB) в CSS #RRGGBB.
 */
export function pixiColorToHex(pixi) {
    return '#' + (pixi >>> 0).toString(16).padStart(6, '0').toUpperCase();
}

/**
 * Конвертирует CSS #RRGGBB в PIXI-число.
 */
export function hexToPixiColor(hex) {
    return parseInt((hex || '#000000').replace('#', ''), 16);
}

/**
 * Возвращает id выделенного коннектора или null.
 */
export function getSelectedConnectorId(core) {
    const ids = core?.selectTool ? Array.from(core.selectTool.selectedObjects || []) : [];
    if (ids.length !== 1) return null;
    const id = ids[0];
    const obj = (core?.state?.state?.objects ?? []).find(o => o.id === id);
    return (obj?.type === 'connector') ? id : null;
}

/**
 * Возвращает объект-коннектор из state по id.
 */
export function getConnectorData(core, id) {
    return (core?.state?.state?.objects ?? []).find(o => o.id === id) ?? null;
}

/**
 * Возвращает экранную середину коннектора, опираясь на _lastSegments.
 * Координаты — целые числа (screen-space integer contract).
 * @returns {{ x: number, y: number } | null}
 */
export function getConnectorMidpointScreen(core, connectorId) {
    const segments = core?.connectorLayer?._lastSegments;
    if (!segments) return null;
    const seg = segments.find(s => s.id === connectorId);
    if (!seg) return null;

    const worldLayer = core?.pixi?.worldLayer;
    const scale  = worldLayer?.scale?.x ?? 1;
    const worldX = worldLayer?.x ?? 0;
    const worldY = worldLayer?.y ?? 0;

    // Поддерживаем оба формата: { points } и устаревший { start, end }
    let midWorldX, midWorldY;
    if (seg.points && seg.points.length >= 2) {
        // Берём середину ломаной (средняя точка по индексу)
        const pts = seg.points;
        const mid = pts[Math.floor((pts.length - 1) / 2)];
        const mid2 = pts[Math.ceil((pts.length - 1) / 2)];
        midWorldX = (mid.x + mid2.x) / 2;
        midWorldY = (mid.y + mid2.y) / 2;
    } else if (seg.start && seg.end) {
        midWorldX = (seg.start.x + seg.end.x) / 2;
        midWorldY = (seg.start.y + seg.end.y) / 2;
    } else {
        return null;
    }

    return {
        x: Math.round(midWorldX * scale + worldX),
        y: Math.round(midWorldY * scale + worldY),
    };
}

/**
 * Возвращает наивысшую экранную точку коннектора (минимальный y) и горизонтальный центр.
 * Координаты — целые числа (screen-space integer contract).
 * @returns {{ x: number, topY: number } | null}
 */
export function getConnectorTopScreen(core, connectorId) {
    const segments = core?.connectorLayer?._lastSegments;
    if (!segments) return null;
    const seg = segments.find(s => s.id === connectorId);
    if (!seg) return null;

    const worldLayer = core?.pixi?.worldLayer;
    const scale  = worldLayer?.scale?.x ?? 1;
    const worldX = worldLayer?.x ?? 0;
    const worldY = worldLayer?.y ?? 0;

    let pts;
    if (seg.points && seg.points.length >= 2) {
        pts = seg.points;
    } else if (seg.start && seg.end) {
        pts = [seg.start, seg.end];
    } else {
        return null;
    }

    let minWorldY = Infinity;
    let sumWorldX = 0;
    for (const p of pts) {
        if (p.y < minWorldY) minWorldY = p.y;
        sumWorldX += p.x;
    }
    const avgWorldX = sumWorldX / pts.length;

    return {
        x:    Math.round(avgWorldX * scale + worldX),
        topY: Math.round(minWorldY * scale + worldY),
    };
}

/**
 * Формирует updates.properties.style для StateChanged-эмита.
 */
export function buildStyleUpdate(partialStyle) {
    return { properties: { style: partialStyle } };
}

/**
 * Читает текущий style коннектора с fallback на дефолты.
 */
export function getConnectorStyle(connector) {
    const s = connector?.properties?.style ?? {};
    return {
        stroke: s.stroke  ?? CONNECTOR_STYLE_DEFAULTS.stroke,
        width:  s.width   ?? CONNECTOR_STYLE_DEFAULTS.width,
        dash:   s.dash    ?? CONNECTOR_STYLE_DEFAULTS.dash,
        route:  s.route   ?? CONNECTOR_STYLE_DEFAULTS.route,
        head: {
            start: s.head?.start ?? CONNECTOR_STYLE_DEFAULTS.head.start,
            end:   s.head?.end   ?? CONNECTOR_STYLE_DEFAULTS.head.end,
        },
    };
}
