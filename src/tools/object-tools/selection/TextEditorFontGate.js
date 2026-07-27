/**
 * Гейт видимых глифов inline-редактора на время загрузки web-шрифта.
 *
 * Семейства записки объявлены через @font-face с font-display: swap и грузятся лениво:
 * запрос файла начинается в момент первого использования шрифта, то есть при появлении
 * записки и её редактора. Пока файл не пришёл, браузер рисует плейсхолдер и текст
 * вторым семейством из списка (Arial), а затем подменяет глифы — визуально шрифт
 * «слетает» и восстанавливается уже после рендера. PIXI-текст записки защищён тем же
 * способом в NoteObject._ensureWebFontApplied.
 */

function resolvePrimaryFamily(fontFamily) {
    return String(fontFamily || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Прячет плейсхолдер textarea и глифы backdrop, если основное семейство ещё не загружено,
 * и возвращает их после резолва document.fonts.load().
 *
 * Вызывать до вставки обёртки редактора в DOM — тогда первый кадр рисуется уже без
 * fallback-глифов.
 *
 * @param {Object} params
 * @param {HTMLTextAreaElement} params.textarea
 * @param {HTMLElement|null} [params.backdrop]
 * @param {string} params.fontFamily Полный CSS-список семейств (например 'Caveat, Arial, cursive')
 * @param {number} params.fontSizePx Базовый размер шрифта объекта
 */
export function gateTextEditorOnFontLoad({ textarea, backdrop = null, fontFamily, fontSizePx }) {
    if (!textarea) return;
    if (typeof document === 'undefined' || !document.fonts) return;
    if (typeof document.fonts.check !== 'function' || typeof document.fonts.load !== 'function') return;

    const primary = resolvePrimaryFamily(fontFamily);
    if (!primary) return;

    const size = Math.max(1, Number(fontSizePx) || 32);
    const spec = `normal ${size}px ${primary}`;

    try {
        if (document.fonts.check(spec)) return;
    } catch (_) {
        return;
    }

    const placeholder = textarea.placeholder;
    const backdropVisibility = backdrop ? backdrop.style.visibility : null;
    textarea.placeholder = '';
    if (backdrop) {
        backdrop.style.visibility = 'hidden';
    }

    // Редактор мог закрыться раньше загрузки шрифта — тогда элементы уже вне DOM
    // и восстанавливать нечего (при повторном открытии создаются новые).
    const restore = () => {
        if (textarea.isConnected) {
            textarea.placeholder = placeholder;
        }
        if (backdrop && backdrop.isConnected) {
            backdrop.style.visibility = backdropVisibility || '';
        }
    };

    try {
        document.fonts.load(spec).then(restore, restore);
    } catch (_) {
        restore();
    }
}
