/**
 * Наблюдаемые шаги Miro при zoom-out от 400%.
 * Оригинальная последовательность содержит дубликаты на низком zoom.
 */
export const MIRO_ZOOM_DOWN_FROM_400 = [
    400, 357, 319, 285, 254, 227, 203, 181, 162, 144, 129, 115, 103, 92, 82,
    73, 65, 58, 52, 46, 41, 37,
];

/**
 * Наблюдаемые шаги Miro при zoom-in от 100%.
 */
export const MIRO_ZOOM_UP_FROM_100 = [
    100, 112, 125, 140, 157, 176, 197, 221, 248, 277, 311, 348, 390, 400,
];

/**
 * Наблюдаемые шаги Miro при zoom-out от 100%.
 */
export const MIRO_ZOOM_DOWN_FROM_100 = [
    // Дубли (8, 5) представлены разными zoom-value, но одинаковой label после округления.
    100, 92, 82, 73, 65, 58, 52, 46, 41, 37, 33, 30, 26, 24, 21, 19, 17, 15, 13,
    12, 11, 10, 8.4, 7.6, 7, 6, 5.4, 4.6, 4.0, 3.6, 3.4, 3.0, 2.6, 2.4, 2.2, 2.0,
    1.8, 1.6, 1.4,
];

const uniqueSorted = new Set([
    ...MIRO_ZOOM_DOWN_FROM_400,
    ...MIRO_ZOOM_UP_FROM_100,
    ...MIRO_ZOOM_DOWN_FROM_100,
]);

/**
 * Общий справочник checkpoint'ов для аналитики/тестов.
 */
export const MIRO_ZOOM_LEVELS = Array.from(uniqueSorted).sort((a, b) => a - b);

export const MIRO_ZOOM_UP_TO_100 = Array.from(new Set(MIRO_ZOOM_DOWN_FROM_100)).sort((a, b) => a - b);

