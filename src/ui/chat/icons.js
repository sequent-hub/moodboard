/**
 * Inline SVG-иконки для чата.
 *
 * Одна ответственность: возвращать строки SVG для подстановки в innerHTML.
 * Без зависимостей. Стиль — outline 1.5, цвет берётся из currentColor.
 */

const SIZE = 16;

function svg(content) {
    return `<svg class="moodboard-chat__pill-icon" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

/**
 * Генерирует SVG-иконку формата для сетки выбора соотношения сторон.
 * viewBox="0 0 25 24" — оригинальный из ratio.svg.
 * @param {number} x — смещение прямоугольника по X
 * @param {boolean} rotate — повернуть на 90° (для альбомных форматов)
 * @param {boolean} isAuto — добавить букву «A» (для Auto)
 */
function ratioSvgIcon(x, rotate, isAuto) {
    const transform = rotate ? ' transform="rotate(90 12.5 12)"' : '';
    const rect = `<rect x="${x}" y="2.675" width="14.65" height="18.65" rx="2.325" stroke="currentColor" stroke-width="1.35"${transform}/>`;
    const letter = isAuto
        ? `<text x="${x + 7.325}" y="${2.675 + 9.325 + 2.5}" text-anchor="middle" font-size="7" font-family="Arial,sans-serif" fill="currentColor" stroke="none">A</text>`
        : '';
    return `<svg class="moodboard-chat__ratio-icon" width="28" height="28" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">${rect}${letter}</svg>`;
}

export const ICONS = {
    image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>'),
    video: svg('<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 9l4-2v10l-4-2"/>'),
    bolt: svg('<path d="M13 3L4 14h6l-1 7 9-11h-6l1-7z"/>'),
    model: svg('<circle cx="12" cy="9" r="4"/><path d="M5 21c1-4 4-6 7-6s6 2 7 6"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    ratio: svg('<rect x="6" y="3" width="12" height="18" rx="2"/>'),
    ratioAuto: svg('<rect x="6" y="3" width="12" height="18" rx="2"/><text x="12" y="15" text-anchor="middle" font-size="7" font-family="Arial,sans-serif" stroke="none" fill="currentColor">A</text>'),
    count: svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>'),
    palette: svg('<path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1 2-2 0-1.5 1-2 2-2h2a3 3 0 0 0 3-3c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="17.5" cy="11" r="1"/>'),
    paperclip: svg('<path d="M21 12.5L12 21a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>'),
    arrowUp: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    sliders: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    chevronDown: svg('<path d="M6 9l6 6 6-6"/>'),
    trash: svg('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>'),
    sparkles: svg('<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>')
};

/**
 * Иконки соотношений сторон для сетки выбора формата.
 * Порядок соответствует строкам грида: портрет (7 шт.), затем альбом+авто (7 шт.).
 */
export const RATIO_ICONS = {
    /* портретные */
    '1:1':   ratioSvgIcon(6.437, false),
    '4:5':   ratioSvgIcon(4.818, false),
    '3:4':   ratioSvgIcon(5.746, false),
    '10:14': ratioSvgIcon(5.532, false),
    '2:3':   ratioSvgIcon(6.437, false),
    '9:16':  ratioSvgIcon(7.907, false),
    '1:2':   ratioSvgIcon(7.961, false),
    /* авто + альбомные (повёрнутые портреты) */
    'auto':  ratioSvgIcon(6.437, false, true),
    '5:4':   ratioSvgIcon(4.818, true),
    '4:3':   ratioSvgIcon(5.746, true),
    '14:10': ratioSvgIcon(5.532, true),
    '3:2':   ratioSvgIcon(6.437, true),
    '16:9':  ratioSvgIcon(7.907, true),
    '2:1':   ratioSvgIcon(7.961, true),
};
