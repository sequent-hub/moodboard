import { describe, it, expect } from 'vitest';
import { transformHandleType, calculateNewSize, calculatePositionOffset } from '../../src/tools/object-tools/selection/GeometryUtils.js';

/**
 * Тесты геометрических функций для selection resize.
 *
 * Эти функции — вычислительное ядро для части resize-потока.
 * Их корректность критична, чтобы понимать, в какой точке появляется погрешность:
 * в формулах или в последующей передаче координат.
 */
describe('Selection Geometry coordinate formulas', () => {
    it('transformHandleType rotates handle mapping by 90 degrees', () => {
        // При повороте 90° ручка "n" должна интерпретироваться как "e".
        expect(transformHandleType('n', 90)).toBe('e');
    });

    it('calculateNewSize for west handle decreases width by deltaX', () => {
        // Для ручки "w":
        // width = start.width - deltaX, height не меняется.
        const next = calculateNewSize('w', { width: 200, height: 100 }, 30, 999, false, 0);
        expect(next).toEqual({ width: 170, height: 100 });
    });

    it('calculatePositionOffset for west handle at 0° shifts by full width delta', () => {
        // В контракте top-left для "w":
        // если width уменьшился на 40, x должен сместиться на +40.
        const offset = calculatePositionOffset(
            'w',
            { width: 200, height: 100 },
            { width: 160, height: 100 },
            0
        );
        expect(offset.x).toBe(40);
        expect(offset.y).toBe(0);
    });

    it('calculatePositionOffset rotates local offset by object angle', () => {
        // При 90° локальный сдвиг по X должен перейти в мировой сдвиг по Y.
        const offset = calculatePositionOffset(
            'w',
            { width: 200, height: 100 },
            { width: 160, height: 100 },
            90
        );
        expect(offset.x).toBeCloseTo(0, 8);
        expect(offset.y).toBeCloseTo(40, 8);
    });
});

