import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source-контракты для HtmlHandlesLayer.
 *
 * Это диагностические тесты по исходнику:
 * фиксируют точки, которые напрямую влияют на точность координат,
 * и позволяют видеть их в отчете без ручного ревью каждого раза.
 */
describe('HtmlHandlesLayer source coordinate contracts', () => {
    it('GroupRotateStart payload should include center field', () => {
        // В коде core использует центр группового поворота.
        // Контракт: в событии start должен передаваться `center`.
        const source = readFileSync(resolve('src/ui/HtmlHandlesLayer.js'), 'utf8');
        const hasCenterInGroupRotateStart = /GroupRotateStart,\s*\{\s*objects,\s*center\s*:\s*\{/.test(source);
        expect(hasCenterInGroupRotateStart).toBe(true);
    });

    it('text height resize fix should not use undefined "res" variable', () => {
        // Контракт: формулы CSS->world должны использовать только объявленные переменные.
        // Конструкция `(measured * res) / s` без локального `res` является риском
        // получения неправильной высоты/координат.
        const source = readFileSync(resolve('src/ui/HtmlHandlesLayer.js'), 'utf8');
        expect(source).not.toContain('const worldH2 = (measured * res) / s;');
    });
});

