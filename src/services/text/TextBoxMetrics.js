/**
 * Единый источник истины для геометрии текстового бокса.
 *
 * Один и тот же объект рисуется двумя независимыми механизмами: статический слой
 * `HtmlTextLayer` (.mb-text) и inline-редактор (textarea + backdrop). Чтобы рамка
 * выделения, межстрочный интервал и паддинги не расходились между режимами и не
 * разъезжались после очередной правки, все метрики бокса считаются здесь.
 */

// Соотношение line-height по базовому (немасштабированному) размеру шрифта.
// Берётся от базового размера, а не от отрисованного, поэтому пропорция строк
// не зависит от зума и не страдает от округления.
const LINE_HEIGHT_BREAKPOINTS = [
    [12, 1.40],
    [18, 1.34],
    [36, 1.26],
    [48, 1.24],
    [72, 1.22],
    [96, 1.20],
];
const LINE_HEIGHT_FALLBACK_RATIO = 1.18;

// Нижний запас под хвосты глифов (например, «з», «у»), общий для обоих режимов.
export const TEXT_BOX_BOTTOM_PAD_PX = 2;

// Вертикальный паддинг inline-редактора (textarea/backdrop). Дублируется в CSS
// (.moodboard-text-input / .moodboard-text-backdrop) и учитывается при сведении
// высоты поля к мировой высоте объекта.
export const TEXT_EDITOR_VERTICAL_PAD_PX = 1;

/**
 * @param {number} baseFontSizePx — базовый размер шрифта без учёта зума
 * @param {object|undefined} properties — допускается явный properties.lineHeight
 * @returns {number} коэффициент (не пиксели)
 */
export function resolveLineHeightRatio(baseFontSizePx, properties) {
    if (properties && typeof properties.lineHeight === 'number') {
        return properties.lineHeight;
    }
    const fs = baseFontSizePx;
    for (const [maxFs, ratio] of LINE_HEIGHT_BREAKPOINTS) {
        if (fs <= maxFs) {
            return ratio;
        }
    }
    return LINE_HEIGHT_FALLBACK_RATIO;
}

/**
 * Межстрочный интервал в пикселях (для inline-редактора, где line-height задаётся в px).
 * @param {number} fontSizePx
 * @param {object|undefined} properties
 * @returns {number}
 */
export function computeLineHeightPx(fontSizePx, properties) {
    return Math.round(fontSizePx * resolveLineHeightRatio(fontSizePx, properties));
}

/**
 * Правый запас, чтобы рамка не прилипала к тексту справа. Одинаков для статического
 * слоя и для авторазмера редактора — иначе ширина рамки в режимах различается.
 * @param {number} fontSizePx
 * @returns {number}
 */
export function computeTextRightPadPx(fontSizePx) {
    return Math.ceil(fontSizePx * 0.7) + 6;
}

/**
 * Применяет ВСЕ текстовые параметры на DOM-элемент в одинаковом формате.
 *
 * Используется как для статического .mb-text, так и для textarea/backdrop
 * в inline-редакторе, гарантируя идентичный рендеринг глифов в обоих режимах.
 *
 * Ключевое: `line-height` всегда задаётся как **безразмерный коэффициент** (e.g. `"1.34"`),
 * а не в пикселях. Безразмерный коэффициент масштабируется браузером вместе с font-size
 * и не страдает от округления — строки в редакторе и статике совпадают точно.
 *
 * Цвет (`color`) умышленно вынесен за пределы функции: textarea рендерит текст
 * прозрачным (видимый текст рисует backdrop), backdrop и .mb-text — реальным цветом.
 *
 * @param {HTMLElement} el
 * @param {{ fontSizePx: number, baseFontSizePx: number, fontFamily: string, properties?: object }} params
 */
export function applyTextStyles(el, { fontSizePx, baseFontSizePx, fontFamily, properties = {} }) {
    const ratio = resolveLineHeightRatio(baseFontSizePx, properties);
    el.style.fontSize = `${fontSizePx}px`;
    el.style.lineHeight = `${ratio}`;
    el.style.fontFamily = fontFamily || '';
    el.style.fontWeight = properties.bold ? 'bold' : '';
    el.style.fontStyle = properties.italic ? 'italic' : '';
    const dec = [properties.underline && 'underline', properties.strikethrough && 'line-through']
        .filter(Boolean).join(' ');
    el.style.textDecoration = dec || '';
    el.style.textAlign = properties.textAlign || '';
    el.style.letterSpacing = '0px';
    el.style.fontKerning = 'normal';
    el.style.textRendering = 'optimizeLegibility';
}

/**
 * Применяет параметры размера поля для inline-редактора (textarea/backdrop).
 * Отдельно от applyTextStyles, чтобы не дублировать логику в статическом слое.
 *
 * @param {HTMLElement} el
 * @param {number} lineHeightPx — вычисленный lineHeight в px (для initialHeight)
 */
export function applyEditorSizing(el, lineHeightPx) {
    const initialHeightPx = Math.max(1, lineHeightPx);
    el.style.minHeight = `${initialHeightPx}px`;
    el.style.height = `${initialHeightPx}px`;
    el.setAttribute('rows', '1');
    el.style.overflowY = 'hidden';
    el.style.whiteSpace = 'pre';
}

/**
 * Inline-значение `padding` статического .mb-text по текущему режиму.
 * Обычный текст → '0' (рамка плотно по глифам, как в редакторе);
 * список/markdown → '' (берётся CSS `.mb-text { padding: 0.3em }`).
 *
 * Применяется детерминированно при каждом проходе: если возвращать паддинг только
 * при смене режима, обычный текст после режима списка сохраняет CSS-отступ 0.3em
 * сверху, и статическая рамка оказывается выше глифов, чем поле ввода.
 * @param {{ isMarkdown?: boolean, useList?: boolean }} mode
 * @returns {string}
 */
export function resolveStaticTextPadding({ isMarkdown = false, useList = false } = {}) {
    if (useList || isMarkdown) {
        return '';
    }
    return '0';
}
