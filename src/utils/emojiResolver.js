// Импортируем встроенные SVG эмоджи
import { getInlineEmojiUrl, isInlineSvgEmoji } from './inlineSvgEmojis.js';

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

// Карта локальных изображений (SVG и PNG) из src/assets/emodji
// В режиме с bundler используем import.meta.glob, иначе fallback
const _localEmojiModules = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.glob) {
    try {
      return import.meta.glob('../assets/emodji/**/*.{svg,SVG,png,PNG}', { eager: true, query: '?url', import: 'default' });
    } catch (error) {
      return {};
    }
  }
  return {};
})();

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

/**
 * ПРИОРИТЕТНЫЙ РЕЗОЛВЕР: Сначала встроенные SVG, потом файлы
 * @param {string} emoji - эмоджи символ  
 * @returns {string|null} Data URL для встроенного SVG или null
 */
export function resolveInlineEmojiFirst(emoji) {
    // Приоритет 1: Встроенные SVG эмоджи (мгновенная загрузка, нет проблем с путями)
    if (isInlineSvgEmoji(emoji)) {
        const dataUrl = getInlineEmojiUrl(emoji);
        if (dataUrl) {
            console.log('✅ Используем встроенный SVG эмоджи:', emoji);
            return dataUrl;
        }
    }
    
    return null; // Эмоджи не найден во встроенных
}

/**
 * Возвращает абсолютный URL для эмоджи с учетом базового пути
 * @param {string} emoji - эмоджи символ
 * @param {string} basePath - базовый путь к ассетам
 * @returns {string|null} абсолютный URL или null
 */
export function resolveEmojiAbsoluteUrl(emoji, basePath = null) {
    // ПРИОРИТЕТ 1: Проверяем встроенные SVG эмоджи
    const inlineUrl = resolveInlineEmojiFirst(emoji);
    if (inlineUrl) return inlineUrl;
    try {
        const base = emojiFilenameBase(emoji);
        if (!base) return null;
        
        // Определяем базовый путь
        let resolvedBasePath = basePath;
        
        if (!resolvedBasePath) {
            // Пытаемся определить от import.meta.url
            try {
                resolvedBasePath = new URL('../assets/emodji/', import.meta.url).href;
            } catch (error) {
                // Fallback на глобальную настройку
                if (window.MOODBOARD_BASE_PATH) {
                    const globalPath = window.MOODBOARD_BASE_PATH.endsWith('/') ? window.MOODBOARD_BASE_PATH : window.MOODBOARD_BASE_PATH + '/';
                    resolvedBasePath = `${globalPath}src/assets/emodji/`;
                } else {
                    // УНИВЕРСАЛЬНОЕ РЕШЕНИЕ: Пытаемся найти правильный путь к пакету
                    const currentUrl = window.location.origin;
                    
                    // Определяем имя пакета из package.json или по скрипту
                    let packagePath = null;
                    
                    // Метод 1: Ищем в node_modules по известным именам пакетов
                    const possiblePackageNames = [
                        '@sequent-org/moodboard',
                        'moodboard-futurello', 
                        'moodboard'
                    ];
                    
                    // Используем правильное имя пакета по умолчанию
                    packagePath = `${currentUrl}/node_modules/@sequent-org/moodboard/src/assets/emodji/`;
                    
                    // Fallback на другие возможные имена если основной не работает
                    // (для форков или других версий пакета)
                    // const alternativeNames = ['moodboard-futurello', 'moodboard'];
                    // можно добавить логику проверки доступности
                    
                    resolvedBasePath = packagePath || `${currentUrl}/src/assets/emodji/`;
                    
                    console.log('🔧 Fallback путь к эмоджи:', resolvedBasePath);
                }
            }
        }
        
        // Формируем URL (приоритет PNG, потом SVG)
        if (!resolvedBasePath.endsWith('/')) resolvedBasePath += '/';
        
        // ПРИОРИТЕТ 2: Файлы в папках (только если нет встроенных SVG)
        // Сначала проверяем разные папки
        const possiblePaths = [
            `${resolvedBasePath}Смайлики/${base}.png`,
            `${resolvedBasePath}Жесты/${base}.png`, 
            `${resolvedBasePath}Женские эмоции/${base}.png`,
            `${resolvedBasePath}Котики/${base}.png`,
            `${resolvedBasePath}Разное/${base}.png`,
            `${resolvedBasePath}Обезьянка/${base}.png`,
            `${resolvedBasePath}${base}.png` // Прямо в корне папки эмоджи
        ];
        
        // Возвращаем первый возможный путь (браузер сам проверит доступность)
        return possiblePaths[0];
        
    } catch (error) {
        return null;
    }
}

