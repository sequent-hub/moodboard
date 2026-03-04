import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source-контрактные тесты.
 *
 * Это осознанно "диагностические" проверки по исходному коду:
 * они фиксируют известные рисковые паттерны в координатном контуре,
 * чтобы эти места не терялись и были видны в отчете тестов.
 */
describe('Coordinate source contracts', () => {
    it('ResizeObjectCommand should be called without duplicated core argument', () => {
        // Контракт:
        // конструктор ResizeObjectCommand ожидает один core-аргумент.
        // Если передаются два подряд, это источник рассинхронизации payload.
        const source = readFileSync(resolve('src/core/index.js'), 'utf8');
        const duplicatedCoreArgPattern = /new\s+ResizeObjectCommand\(\s*this\s*,\s*this\s*,\s*data\.object/s;
        expect(duplicatedCoreArgPattern.test(source)).toBe(false);
    });

    it('group rotate update should not fallback to world center (0,0) silently', () => {
        // Контракт:
        // поворот группы должен иметь валидный центр из start payload.
        // Молчаливый fallback на {0,0} скрывает ошибку контракта
        // и может приводить к заметной геометрической погрешности.
        const source = readFileSync(resolve('src/core/index.js'), 'utf8');
        expect(source).not.toContain('const center = this._groupRotateCenter || { x: 0, y: 0 };');
    });
});

