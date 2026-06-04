import { marked } from 'marked';
import DOMPurify from 'dompurify';

// gfm: паритет с league/commonmark в Futurello; breaks: переносы строк как в ответах ИИ
marked.use({ gfm: true, breaks: true });

/**
 * Рендерит markdown в безопасный HTML.
 * DOMPurify обязателен: результат вставляется через innerHTML.
 */
export function renderMarkdown(src) {
    if (typeof src !== 'string' || !src) return '';
    return DOMPurify.sanitize(marked.parse(src));
}
