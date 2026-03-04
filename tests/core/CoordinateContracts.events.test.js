import { describe, it, expect } from 'vitest';
import { Events } from '../../src/core/events/Events.js';

/**
 * Контрактные тесты для реестра событий координатного контура.
 *
 * Смысл файла: если событие используется в цепочке "инструмент -> core -> UI",
 * оно должно быть явно определено в Events.js.
 * Это защищает от "тихих" ошибок, когда подписка есть, а константа отсутствует.
 */
describe('Coordinate event contracts', () => {
    it('contains required tool coordinate events', () => {
        // Базовый набор событий для drag/resize/rotate/pan/zoom.
        // Если любое из них изменится/исчезнет, часть тестов координат
        // начнет падать в непредсказуемых местах.
        expect(Events.Tool.GetObjectPosition).toBe('tool:get:object:position');
        expect(Events.Tool.GetObjectSize).toBe('tool:get:object:size');
        expect(Events.Tool.GetObjectRotation).toBe('tool:get:object:rotation');
        expect(Events.Tool.DragUpdate).toBe('tool:drag:update');
        expect(Events.Tool.ResizeUpdate).toBe('tool:resize:update');
        expect(Events.Tool.GroupResizeUpdate).toBe('tool:group:resize:update');
        expect(Events.Tool.GroupRotateUpdate).toBe('tool:group:rotate:update');
        expect(Events.Tool.PanUpdate).toBe('tool:pan:update');
        expect(Events.Tool.WheelZoom).toBe('tool:wheel:zoom');
    });

    it('contains rotate start event used by rotate flows', () => {
        // Критичный контракт:
        // в коде есть места, где используется RotateStart.
        // Если в реестре нет константы, подписки/эмиты начинают расходиться,
        // и поведение становится нестабильным.
        expect(Events.Tool.RotateStart).toBe('tool:rotate:start');
    });
});

