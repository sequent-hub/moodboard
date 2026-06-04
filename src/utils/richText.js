import 'katex/dist/katex.min.css';
import katex from 'katex';
import { renderMarkdown } from './markdown.js';

// Рендер «богатого» текста = markdown + LaTeX-формулы KaTeX.
//
// Почему отдельный слой над renderMarkdown: marked/DOMPurify портят TeX
// (`_` → <em>, `\` срезается, `*` → курсив). Поэтому формулы извлекаются ДО
// markdown-парсинга, заменяются плейсхолдерами, markdown прогоняется как
// обычно, затем формулы восстанавливаются через katex.renderToString.
//
// KaTeX-вывод НЕ пропускается через DOMPurify: это доверенный вывод самой
// библиотеки (см. docs/security.md — injection-safe), а sanitize вырезал бы
// нужные KaTeX span/inline-style. Тот же контракт, что в Futurello.

// Плейсхолдеры — только заглавные буквы и цифры: marked/DOMPurify не трогают
// такие токены и не интерпретируют их как разметку.
const BLOCK_KEY = (i) => `XKATEXBLOCK${i}X`;
const INLINE_KEY = (i) => `XKATEXINLINE${i}X`;

// Делимитеры формул. Порядок важен: $$ и \[…\] извлекаются до инлайнового $…$,
// иначе инлайновый разбор «съест» первый $ блочной формулы.
const RE_BLOCK_DOLLARS = /\$\$([\s\S]+?)\$\$/g;     // $$ ... $$
const RE_BLOCK_BRACKETS = /\\\[([\s\S]+?)\\\]/g;    // \[ ... \]
const RE_INLINE_PARENS = /\\\(([\s\S]+?)\\\)/g;     // \( ... \)
// Инлайн $...$: открывающий $ не перед пробелом/цифрой/$ (отсекает $5, $10);
// закрывающий $ не перед цифрой. (?<!\$) — не часть $$.
const RE_INLINE_DOLLARS = /(?<!\$)\$(?=[^\s\d$])([\s\S]+?[^\s$])\$(?!\d)/g;

// Блоки и инлайн-код. Их содержимое НЕ должно трактоваться как математика:
// например PowerShell `$dst`, `$env:APPDATA` — это переменные, а не формулы.
const RE_FENCED_CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~/g; // ``` ... ``` и ~~~ ... ~~~
const RE_INLINE_CODE = /`[^`\n]+`/g;                     // `...`

// Убирает код из текста (для детекта) — заменяет на пробел, чтобы делимитеры
// внутри кода не считались формулами.
function stripCode(src) {
    return src.replace(RE_FENCED_CODE, ' ').replace(RE_INLINE_CODE, ' ');
}

/**
 * Быстрая проверка: есть ли в тексте хоть один делимитер формулы вне кода.
 * Нужна, чтобы текст с одной формулой (без markdown-разметки) тоже
 * рендерился богато, но код с `$`-переменными не считался формулой.
 */
export function hasMath(src) {
    if (typeof src !== 'string' || !src) return false;
    const t = stripCode(src);
    return (
        /\$\$[\s\S]+?\$\$/.test(t) ||
        /\\\[[\s\S]+?\\\]/.test(t) ||
        /\\\([\s\S]+?\\\)/.test(t) ||
        /(?<!\$)\$(?=[^\s\d$])[\s\S]+?[^\s$]\$(?!\d)/.test(t)
    );
}

function extractMath(src) {
    const placeholders = [];
    // Сначала защищаем код плейсхолдерами: внутри него $ и \ — не математика.
    // Код возвращается в текст до markdown-парсинга, поэтому marked отрисует
    // его как <pre><code> с экранированным содержимым.
    const codeStore = [];
    const maskCode = (re, prefix) => {
        text = text.replace(re, (m) => {
            const key = `XCODE${prefix}${codeStore.length}X`;
            codeStore.push({ key, code: m });
            return key;
        });
    };

    let text = src;
    maskCode(RE_FENCED_CODE, 'BLOCK');
    maskCode(RE_INLINE_CODE, 'INLINE');

    const replaceAll = (re, display, keyFn) => {
        text = text.replace(re, (_m, tex) => {
            const key = keyFn(placeholders.length);
            placeholders.push({ key, tex: tex.trim(), display });
            return key;
        });
    };

    replaceAll(RE_BLOCK_DOLLARS, true, BLOCK_KEY);
    replaceAll(RE_BLOCK_BRACKETS, true, BLOCK_KEY);
    replaceAll(RE_INLINE_PARENS, false, INLINE_KEY);
    replaceAll(RE_INLINE_DOLLARS, false, INLINE_KEY);

    // Возвращаем код обратно — теперь его обработает marked.
    for (const { key, code } of codeStore) {
        text = text.split(key).join(code);
    }

    return { text, placeholders };
}

function restoreMath(html, placeholders) {
    let out = html;
    for (const { key, tex, display } of placeholders) {
        let rendered;
        try {
            rendered = katex.renderToString(tex, {
                throwOnError: false,
                output: 'html', // без MathML: дублирующее поддерево не нужно и тяжелее
                displayMode: display,
            });
        } catch {
            // На неожиданной ошибке оставляем сырой TeX видимым
            rendered = display ? `$$${tex}$$` : `$${tex}$`;
        }
        out = out.split(key).join(rendered);
    }
    return out;
}

/**
 * Рендерит markdown с LaTeX-формулами в безопасный HTML.
 * Результат вставляется через innerHTML.
 */
export function renderRichText(src) {
    if (typeof src !== 'string' || !src) return '';
    const { text, placeholders } = extractMath(src);
    const html = renderMarkdown(text);
    if (placeholders.length === 0) return html;
    return restoreMath(html, placeholders);
}
