import { describe, it, expect } from 'vitest';
import { renderRichText, hasMath } from '../../src/utils/richText.js';

describe('richText: математика и код', () => {
    it('рендерит инлайн-формулу вне кода через KaTeX', () => {
        const html = renderRichText('Энергия: $E = mc^2$.');
        expect(html).toContain('class="katex"');
        // Сырой делимитер не должен остаться
        expect(html).not.toContain('$E = mc^2$');
    });

    it('рендерит блочную формулу $$...$$ в display-режиме', () => {
        const html = renderRichText('$$x = \\frac{1}{2}$$');
        expect(html).toContain('katex-display');
    });

    it('НЕ трактует $-переменные внутри fenced-кода как формулы', () => {
        const src = [
            '```powershell',
            '$dst = "D:\\Cursor"',
            'Copy-Item "$env:APPDATA\\Cursor" "$dst"',
            '```',
        ].join('\n');
        const html = renderRichText(src);
        // Код рендерится как <pre><code>, KaTeX внутри нет
        expect(html).toContain('<pre>');
        expect(html).not.toContain('class="katex"');
        // Переменные сохранены дословно (с HTML-экранированием кавычек)
        expect(html).toContain('$dst');
        expect(html).toContain('$env:APPDATA');
    });

    it('НЕ трактует $ внутри инлайн-кода как формулу', () => {
        const html = renderRichText('Переменная `$env:USERPROFILE` тут.');
        expect(html).toContain('<code>');
        expect(html).not.toContain('class="katex"');
        expect(html).toContain('$env:USERPROFILE');
    });

    it('код и формула в одном тексте: код сырой, формула отрендерена', () => {
        const src = 'Формула $a^2$ и код `$x`';
        const html = renderRichText(src);
        // одна формула KaTeX (a^2), переменная $x внутри кода — нет
        expect(html).toContain('class="katex"');
        expect(html).toContain('<code>');
        expect(html).toContain('$x');
    });
});

describe('hasMath: детект формул', () => {
    it('true для реальной инлайн-формулы', () => {
        expect(hasMath('Вот $E=mc^2$ формула')).toBe(true);
    });

    it('true для блочной $$...$$ и \\(...\\)', () => {
        expect(hasMath('$$a+b$$')).toBe(true);
        expect(hasMath('текст \\(a+b\\) текст')).toBe(true);
    });

    it('false для $-переменных только внутри кода', () => {
        const src = '```bash\necho "$HOME and $PATH"\n```';
        expect(hasMath(src)).toBe(false);
    });

    it('false для инлайн-кода с $', () => {
        expect(hasMath('Команда `$env:USERPROFILE` здесь')).toBe(false);
    });

    it('false для денежных сумм $5 и $10', () => {
        expect(hasMath('Цена $5 или $10 за штуку')).toBe(false);
    });

    it('false для обычного текста', () => {
        expect(hasMath('Просто текст без формул')).toBe(false);
    });
});
