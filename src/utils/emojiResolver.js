// Явные переопределения соответствия эмодзи → имя файла (без расширения)
// Ключ и значение — в нижнем регистре, кодпоинты через дефис
const EMOJI_OVERRIDES = new Map([
  ['1f600', '1f603'] // 😀 → 1f603 (кастомный файл пользователя)
]);

/** Возвращает базовое имя файла (без расширения) для эмодзи с учётом overrides */
export function emojiFilenameBase(emoji) {
    if (!emoji || typeof emoji !== 'string') return null;
    const cleaned = Array.from(emoji)
        .filter(ch => ch.codePointAt(0) !== 0xFE0F)
        .join('');
    if (!cleaned) return null;
    const cps = [];
    for (const ch of cleaned) {
        const cp = ch.codePointAt(0);
        if (typeof cp === 'number') cps.push(cp.toString(16).toLowerCase());
    }
    if (cps.length === 0) return null;
    const base = cps.join('-');
    return EMOJI_OVERRIDES.get(base) || base;
}
/**
 * Преобразует строку-эмодзи в URL SVG иконки Twemoji (через jsDelivr CDN)
 * Возвращает null, если конвертация не удалась
 *
 * Пример URL: https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/svg/1f600.svg
 */
export function emojiToTwemojiUrl(emoji) {
    try {
        if (!emoji || typeof emoji !== 'string') return null;
        // Убираем VARIATION SELECTOR-16 (U+FE0F) и невидимые символы
        const cleaned = Array.from(emoji)
            .filter(ch => ch.codePointAt(0) !== 0xFE0F)
            .join('');
        if (!cleaned) return null;

        // Разбиваем по юникод-графемам и получаем кодпоинты
        const codePoints = [];
        for (const ch of cleaned) {
            const cp = ch.codePointAt(0);
            if (typeof cp === 'number') {
                codePoints.push(cp.toString(16).toLowerCase());
            }
        }
        if (codePoints.length === 0) return null;

        const filename = codePoints.join('-');
        return `https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/svg/${filename}.svg`;
    } catch (e) {
        return null;
    }
}

/**
 * Собирает локальный путь к SVG в public/emoji по кодпоинтам эмодзи
 * Пример: /emoji/1f600.svg
 */
export function emojiToLocalUrl(emoji) {
    try {
        const base = emojiFilenameBase(emoji);
        if (!base) return null;
        // Используем пользовательскую папку /emodji в приоритете
        return `/emodji/${base}.svg`;
    } catch (e) {
        return null;
    }
}

// Карта локальных изображений (SVG и PNG) из src/assets/emodji (собирается Vite'ом)
// Ключи вида '../assets/emodji/1f600.svg' / '../assets/emodji/1f600.png' → URL
const _localEmojiModules = import.meta && typeof import.meta.glob === 'function'
  ? {
      ...import.meta.glob('../assets/emodji/**/*.{svg,SVG,png,PNG}', { eager: true, query: '?url', import: 'default' })
    }
  : {};

// Индекс по имени файла (без пути)
const _localEmojiIndex = (() => {
  const map = new Map();
  for (const p in _localEmojiModules) {
    const parts = p.split('/');
    const fname = parts[parts.length - 1]; // e.g. 1f600.svg
    map.set(fname.toLowerCase(), _localEmojiModules[p]);
  }
  return map;
})();

/**
 * Возвращает собранный URL на локальный SVG из src/assets/emodji по эмодзи
 * Если файла нет в бандле — вернет null
 */
export function emojiToAppLocalUrl(emoji) {
    try {
        const base = emojiFilenameBase(emoji);
        if (!base) return null;
        // Сначала svg, затем png
        return _localEmojiIndex.get(base + '.svg') || _localEmojiIndex.get(base + '.png') || null;
    } catch (_) {
        return null;
    }
}

/**
 * Возвращает набор потенциальных локальных путей (public) для эмодзи: svg и png, /emodji и /emoji
 */
export function buildLocalPaths(emoji) {
    try {
        const base = emojiFilenameBase(emoji);
        if (!base) return [];
        return [
            `/emodji/${base}.svg`,
            `/emodji/${base}.png`,
            `/emoji/${base}.svg`,
            `/emoji/${base}.png`
        ];
    } catch (_) {
        return [];
    }
}

