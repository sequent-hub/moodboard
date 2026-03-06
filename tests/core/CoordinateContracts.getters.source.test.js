import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Source-контракты для getter-событий координат в CoreMoodBoard.
 *
 * ВАЖНО:
 * После рефакторинга логика getter-обработчиков живет в
 * src/core/flows/ObjectLifecycleFlow.js. Эти тесты проверяют именно
 * актуальное место регистрации событий, а не старую структуру index.js.
 *
 * Эти тесты не чинят поведение, а фиксируют текущую модель:
 * - GetObjectPosition рассчитывается через центр PIXI и half-size;
 * - GetAllObjects берет bounds через getBounds (экранное пространство).
 *
 * Такой набор важен для диагностики смешения систем координат.
 */
describe('Core getter source coordinate contracts', () => {
    it('GetObjectPosition path uses halfW/halfH conversion from PIXI center', () => {
        const source = readFileSync(resolve('src/core/flows/ObjectLifecycleFlow.js'), 'utf8');
        expect(source).toContain('const halfW = (pixiObject.width || 0) / 2;');
        expect(source).toContain('const halfH = (pixiObject.height || 0) / 2;');
        expect(source).toContain('data.position = { x: pixiObject.x - halfW, y: pixiObject.y - halfH };');
    });

    it('GetAllObjects path uses pixiObject.getBounds()', () => {
        const source = readFileSync(resolve('src/core/flows/ObjectLifecycleFlow.js'), 'utf8');
        expect(source).toContain('const bounds = pixiObject.getBounds();');
        expect(source).toContain('bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }');
    });
});

