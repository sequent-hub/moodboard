import { describe, it, expect} from 'vitest';
import { GeometryUtils } from '../../../src/core/rendering/GeometryUtils.js'

describe('GeometryUtils', ()=> {

    describe('Class Definition', () => {
        it('should be defined', ()=>{
            expect(GeometryUtils).toBeDefined();
        });
        it('should be a class', () => {
            expect(typeof GeometryUtils).toBe('function');
        });
    });

    describe('Static Methods', () => {
        it('should have exactly 5 static methods', () => {
            const methodNames = Object.getOwnPropertyNames(GeometryUtils)
                .filter(name => typeof GeometryUtils[name] === 'function');

            expect(methodNames).toHaveLength(5);
        });

        it('should have all methods defined', () => {
            expect(GeometryUtils.distancePointToSegment).toBeDefined();
            expect(GeometryUtils.pointInRect).toBeDefined();
            expect(GeometryUtils.getRectCenter).toBeDefined();
            expect(GeometryUtils.degreesToRadians).toBeDefined();
            expect(GeometryUtils.radiansToDegrees).toBeDefined();
        });

        it('should have all methods as function', () => {
            expect(typeof GeometryUtils.distancePointToSegment).toBe('function');
            expect(typeof GeometryUtils.pointInRect).toBe('function');
            expect(typeof GeometryUtils.getRectCenter).toBe('function')
            expect(typeof GeometryUtils.degreesToRadians).toBe('function');
            expect(typeof GeometryUtils.radiansToDegrees).toBe('function');
        })
    });

});

describe('distancePointToSegment', ()=>{
    describe('Basic cases', () => {
        it('should return 0 when point is exactly on line', () => {
            // Точка (1,1) точно на линии от (1,1) до (2,2)
            const distance = GeometryUtils.distancePointToSegment(1, 1, 1, 1, 2, 2);
            expect(distance).toBe(0);
        });

        it('should return 0 when point is on line endpoint', () => {
            // Точка (2,2) точно на конце линии от (1,1) до (2,2)
            const distance = GeometryUtils.distancePointToSegment(2, 2, 1, 1, 2, 2);
            expect(distance).toBe(0);
        });

        it('should return 0 when point is on line start', () => {
            // Точка (1,1) точно на начале линии от (1,1) до (2,2)
            const distance = GeometryUtils.distancePointToSegment(1, 1, 1, 1, 2, 2);
            expect(distance).toBe(0);
        });

        it('should return distance when point is beyond line end', () => {
            // Точка (3,3) за пределами линии от (1,1) до (2,2)
            const distance = GeometryUtils.distancePointToSegment(3, 3, 1, 1, 2, 2);
            expect(distance).toBeCloseTo(1.414, 3); // √2
        });

        it('should return distance when point is beyond line start', () => {
            // Точка (0,0) за пределами линии от (1,1) до (2,2)
            const distance = GeometryUtils.distancePointToSegment(0, 0, 1, 1, 2, 2);
            expect(distance).toBeCloseTo(1.414, 3); // √2
        });

        it('should return distance when point is perpendicular to line middle', () => {
            // Точка (1.5, 0.5) перпендикулярно к середине линии от (1,1) до (2,2)
            // Линия: y = x (наклон 45°), середина: (1.5, 1.5)
            // Перпендикулярное расстояние: 1 единица вниз
            // Фактическое расстояние: 1 × cos(45°) = 1/√2 ≈ 0.707
            const distance = GeometryUtils.distancePointToSegment(1.5, 0.5, 1, 1, 2, 2);
            expect(distance).toBeCloseTo(0.707, 3);
        });
    });
    describe('Geometric cases', () => {
        it('should calculate distance to horizontal line', () => {
            // Горизонтальная линия (0,0)-(10,0), точка (5,5)
            const distance = GeometryUtils.distancePointToSegment(5, 5, 0, 0, 10, 0);
            expect(distance).toBe(5);
        });

        it('should calculate distance to vertical line', () => {
            // Вертикальная линия (0,0)-(0,10), точка (5,5)
            const distance = GeometryUtils.distancePointToSegment(5, 5, 0, 0, 0, 10);
            expect(distance).toBe(5);
        });

        it('should calculate distance to diagonal line', () => {
            // Диагональная линия (0,0)-(10,10), точка (5,0)
            const distance = GeometryUtils.distancePointToSegment(5, 0, 0, 0, 10, 10);
            expect(distance).toBeCloseTo(3.536, 3); // 5/√2
        });
    });
    describe('Edge cases', () => {
        it('should handle degenerate line (single point)', () => {
            // Линия от (1,1) до (1,1) - это точка
            const distance = GeometryUtils.distancePointToSegment(0, 0, 1, 1, 1, 1);
            expect(distance).toBeCloseTo(1.414, 3); // √2
        });

        it('should handle very short line', () => {
            // Очень короткая линия (1,1)-(1.001,1.001)
            const distance = GeometryUtils.distancePointToSegment(0, 0, 1, 1, 1.001, 1.001);
            expect(distance).toBeCloseTo(1.414, 3); // почти √2
        });
    });
    describe('Practical cases', () => {
        it('should work with real drawing coordinates', () => {
            // Точка (90, 150) перпендикулярно к линии (95,145)-(105,155)
            // Линия наклонена под 45°, поэтому расстояние = 5 × √2 ≈ 7.07
            const distance = GeometryUtils.distancePointToSegment(90, 150, 95, 145, 105, 155);
            expect(distance).toBeCloseTo(7.07, 2);
        });

        it('should handle negative coordinates', () => {
            // Отрицательные координаты
            const distance = GeometryUtils.distancePointToSegment(-5, -5, -10, -10, 0, 0);
            expect(distance).toBeCloseTo(0, 3); // точка на линии
        });
    });
})

describe('pointInRect', () => {
    // Прямоугольник: левый верхний (100,100), ширина 200, высота 150
    const rectX = 100;
    const rectY = 100;
    const rectW = 200;
    const rectH = 150;

    describe('Базовые случаи', () => {
        it('должен возвращать true для точки строго внутри', () => {
            expect(GeometryUtils.pointInRect(150, 120, rectX, rectY, rectW, rectH)).toBe(true);
        });

        it('должен возвращать true для точки в центре прямоугольника', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW / 2, rectY + rectH / 2, rectX, rectY, rectW, rectH)).toBe(true);
        });
    });

    describe('Границы (включены)', () => {
        it('левая граница', () => {
            expect(GeometryUtils.pointInRect(rectX, 150, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('правая граница', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW, 150, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('верхняя граница', () => {
            expect(GeometryUtils.pointInRect(150, rectY, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('нижняя граница', () => {
            expect(GeometryUtils.pointInRect(150, rectY + rectH, rectX, rectY, rectW, rectH)).toBe(true);
        });
    });

    describe('Углы (включены)', () => {
        it('левый-верхний', () => {
            expect(GeometryUtils.pointInRect(rectX, rectY, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('правый-верхний', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW, rectY, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('левый-нижний', () => {
            expect(GeometryUtils.pointInRect(rectX, rectY + rectH, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('правый-нижний', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW, rectY + rectH, rectX, rectY, rectW, rectH)).toBe(true);
        });
    });

    describe('Снаружи', () => {
        it('левее прямоугольника', () => {
            expect(GeometryUtils.pointInRect(rectX - 1, 150, rectX, rectY, rectW, rectH)).toBe(false);
        });
        it('правее прямоугольника', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW + 1, 150, rectX, rectY, rectW, rectH)).toBe(false);
        });
        it('выше прямоугольника', () => {
            expect(GeometryUtils.pointInRect(150, rectY - 1, rectX, rectY, rectW, rectH)).toBe(false);
        });
        it('ниже прямоугольника', () => {
            expect(GeometryUtils.pointInRect(150, rectY + rectH + 1, rectX, rectY, rectW, rectH)).toBe(false);
        });
        it('по диагонали снаружи (лево-верх)', () => {
            expect(GeometryUtils.pointInRect(rectX - 10, rectY - 10, rectX, rectY, rectW, rectH)).toBe(false);
        });
        it('по диагонали снаружи (право-низ)', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW + 10, rectY + rectH + 10, rectX, rectY, rectW, rectH)).toBe(false);
        });
    });

    describe('Нулевые размеры', () => {
        it('ширина = 0, высота > 0: true только на вертикальном отрезке x == rectX', () => {
            expect(GeometryUtils.pointInRect(rectX, rectY + 10, rectX, rectY, 0, rectH)).toBe(true);
            expect(GeometryUtils.pointInRect(rectX + 0.001, rectY + 10, rectX, rectY, 0, rectH)).toBe(false);
        });
        it('высота = 0, ширина > 0: true только на горизонтальном отрезке y == rectY', () => {
            expect(GeometryUtils.pointInRect(rectX + 10, rectY, rectX, rectY, rectW, 0)).toBe(true);
            expect(GeometryUtils.pointInRect(rectX + 10, rectY + 0.001, rectX, rectY, rectW, 0)).toBe(false);
        });
        it('ширина = 0 и высота = 0: true только ровно в точке (rectX, rectY)', () => {
            expect(GeometryUtils.pointInRect(rectX, rectY, rectX, rectY, 0, 0)).toBe(true);
            expect(GeometryUtils.pointInRect(rectX + 0.001, rectY, rectX, rectY, 0, 0)).toBe(false);
            expect(GeometryUtils.pointInRect(rectX, rectY + 0.001, rectX, rectY, 0, 0)).toBe(false);
        });
    });

    describe('Отрицательные координаты', () => {
        it('точка и прямоугольник в отрицательных координатах', () => {
            const x = -200, y = -100, w = 50, h = 40;
            expect(GeometryUtils.pointInRect(-190, -90, x, y, w, h)).toBe(true);
            expect(GeometryUtils.pointInRect(-149, -59, x, y, w, h)).toBe(false);
        });
    });

    describe('Вещественные числа (точность)', () => {
        it('точка на правой границе с минимальным смещением внутрь', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW - 1e-6, rectY + rectH / 2, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('точка чуть за правой границей', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW + 1e-6, rectY + rectH / 2, rectX, rectY, rectW, rectH)).toBe(false);
        });
        it('точка на нижней границе с минимальным смещением внутрь', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW / 2, rectY + rectH - 1e-6, rectX, rectY, rectW, rectH)).toBe(true);
        });
        it('точка чуть за нижней границей', () => {
            expect(GeometryUtils.pointInRect(rectX + rectW / 2, rectY + rectH + 1e-6, rectX, rectY, rectW, rectH)).toBe(false);
        });
    });

    describe('Отрицательные размеры (контракт текущей реализации)', () => {
        it('rectWidth < 0 → ожидаем false (нормализация не выполняется)', () => {
            expect(GeometryUtils.pointInRect(100, 100, 120, 80, -50, 40)).toBe(false);
        });
        it('rectHeight < 0 → ожидаем false (нормализация не выполняется)', () => {
            expect(GeometryUtils.pointInRect(100, 100, 80, 120, 50, -40)).toBe(false);
        });
        it('rectWidth < 0 и rectHeight < 0 → ожидаем false', () => {
            expect(GeometryUtils.pointInRect(100, 100, 120, 120, -50, -40)).toBe(false);
        });
    });

    describe('Невалидные значения', () => {
        it('NaN в любом параметре → false', () => {
            expect(GeometryUtils.pointInRect(NaN, 100, rectX, rectY, rectW, rectH)).toBe(false);
            expect(GeometryUtils.pointInRect(100, NaN, rectX, rectY, rectW, rectH)).toBe(false);
            expect(GeometryUtils.pointInRect(100, 100, NaN, rectY, rectW, rectH)).toBe(false);
            expect(GeometryUtils.pointInRect(100, 100, rectX, rectY, NaN, rectH)).toBe(false);
        });
    });
});

describe('getRectCenter', () => {
    describe('Базовые случаи', () => {
        it('должен вычислить центр прямоугольника в начале координат', () => {
            const center = GeometryUtils.getRectCenter(0, 0, 100, 80);
            expect(center.x).toBe(50);
            expect(center.y).toBe(40);
        });

        it('должен вычислить центр прямоугольника со смещением', () => {
            const center = GeometryUtils.getRectCenter(100, 100, 200, 150);
            expect(center.x).toBe(200); // 100 + 200/2
            expect(center.y).toBe(175); // 100 + 150/2
        });

        it('должен вычислить центр квадрата', () => {
            const center = GeometryUtils.getRectCenter(50, 50, 100, 100);
            expect(center.x).toBe(100); // 50 + 100/2
            expect(center.y).toBe(100); // 50 + 100/2
        });
    });

    describe('Граничные случаи', () => {
        it('должен обработать нулевые размеры', () => {
            const center = GeometryUtils.getRectCenter(100, 100, 0, 0);
            expect(center.x).toBe(100); // 100 + 0/2
            expect(center.y).toBe(100); // 100 + 0/2
        });

        it('должен обработать очень маленькие размеры', () => {
            const center = GeometryUtils.getRectCenter(100, 100, 1, 1);
            expect(center.x).toBe(100.5); // 100 + 1/2
            expect(center.y).toBe(100.5); // 100 + 1/2
        });

        it('должен обработать очень большие размеры', () => {
            const center = GeometryUtils.getRectCenter(100, 100, 10000, 8000);
            expect(center.x).toBe(5100); // 100 + 10000/2
            expect(center.y).toBe(4100); // 100 + 8000/2
        });
    });

    describe('Отрицательные координаты', () => {
        it('должен вычислить центр прямоугольника в отрицательных координатах', () => {
            const center = GeometryUtils.getRectCenter(-200, -150, 100, 80);
            expect(center.x).toBe(-150); // -200 + 100/2
            expect(center.y).toBe(-110); // -150 + 80/2
        });

        it('должен вычислить центр прямоугольника с отрицательными размерами (контракт)', () => {
            const center = GeometryUtils.getRectCenter(100, 100, -50, -40);
            expect(center.x).toBe(75);  // 100 + (-50)/2
            expect(center.y).toBe(80);  // 100 + (-40)/2
        });
    });

    describe('Вещественные числа', () => {
        it('должен корректно обработать дробные размеры', () => {
            const center = GeometryUtils.getRectCenter(100.5, 100.5, 99.8, 75.6);
            expect(center.x).toBeCloseTo(150.4, 3); // 100.5 + 99.8/2
            expect(center.y).toBeCloseTo(138.3, 3); // 100.5 + 75.6/2
        });

        it('должен корректно обработать дробные координаты', () => {
            const center = GeometryUtils.getRectCenter(100.25, 100.75, 100, 100);
            expect(center.x).toBe(150.25); // 100.25 + 100/2
            expect(center.y).toBe(150.75); // 100.75 + 100/2
        });
    });

    describe('Структура возвращаемого объекта', () => {
        it('должен возвращать объект с правильными свойствами', () => {
            const center = GeometryUtils.getRectCenter(0, 0, 100, 100);
            expect(center).toHaveProperty('x');
            expect(center).toHaveProperty('y');
            expect(typeof center.x).toBe('number');
            expect(typeof center.y).toBe('number');
        });

        it('должен возвращать новый объект при каждом вызове', () => {
            const center1 = GeometryUtils.getRectCenter(0, 0, 100, 100);
            const center2 = GeometryUtils.getRectCenter(0, 0, 100, 100);
            expect(center1).not.toBe(center2); // разные объекты
            expect(center1.x).toBe(center2.x); // но одинаковые значения
            expect(center1.y).toBe(center2.y);
        });
    });

    describe('Практические случаи', () => {
        it('должен вычислить центр стандартного экрана 1920x1080', () => {
            const center = GeometryUtils.getRectCenter(0, 0, 1920, 1080);
            expect(center.x).toBe(960);  // 0 + 1920/2
            expect(center.y).toBe(540);  // 0 + 1080/2
        });

        it('должен вычислить центр кнопки тулбара', () => {
            const center = GeometryUtils.getRectCenter(10, 10, 50, 30);
            expect(center.x).toBe(35); // 10 + 50/2
            expect(center.y).toBe(25); // 10 + 30/2
        });

        it('должен вычислить центр выделения объектов', () => {
            const center = GeometryUtils.getRectCenter(150, 200, 300, 250);
            expect(center.x).toBe(300); // 150 + 300/2
            expect(center.y).toBe(325); // 200 + 250/2
        });
    });
});

describe('degreesToRadians', () => {
    describe('Базовые случаи', () => {
        it('должен конвертировать 0 градусов в 0 радиан', () => {
            expect(GeometryUtils.degreesToRadians(0)).toBe(0);
        });

        it('должен конвертировать 90 градусов в π/2 радиан', () => {
            expect(GeometryUtils.degreesToRadians(90)).toBeCloseTo(Math.PI / 2, 10);
        });

        it('должен конвертировать 180 градусов в π радиан', () => {
            expect(GeometryUtils.degreesToRadians(180)).toBeCloseTo(Math.PI, 10);
        });

        it('должен конвертировать 270 градусов в 3π/2 радиан', () => {
            expect(GeometryUtils.degreesToRadians(270)).toBeCloseTo(3 * Math.PI / 2, 10);
        });

        it('должен конвертировать 360 градусов в 2π радиан', () => {
            expect(GeometryUtils.degreesToRadians(360)).toBeCloseTo(2 * Math.PI, 10);
        });
    });

    describe('Отрицательные углы', () => {
        it('должен конвертировать -90 градусов в -π/2 радиан', () => {
            expect(GeometryUtils.degreesToRadians(-90)).toBeCloseTo(-Math.PI / 2, 10);
        });

        it('должен конвертировать -180 градусов в -π радиан', () => {
            expect(GeometryUtils.degreesToRadians(-180)).toBeCloseTo(-Math.PI, 10);
        });

        it('должен конвертировать -360 градусов в -2π радиан', () => {
            expect(GeometryUtils.degreesToRadians(-360)).toBeCloseTo(-2 * Math.PI, 10);
        });

        it('должен конвертировать -45 градусов в -π/4 радиан', () => {
            expect(GeometryUtils.degreesToRadians(-45)).toBeCloseTo(-Math.PI / 4, 10);
        });
    });

    describe('Дробные углы', () => {
        it('должен конвертировать 45.5 градусов', () => {
            const expected = (45.5 * Math.PI) / 180;
            expect(GeometryUtils.degreesToRadians(45.5)).toBeCloseTo(expected, 10);
        });

        it('должен конвертировать 30.25 градусов', () => {
            const expected = (30.25 * Math.PI) / 180;
            expect(GeometryUtils.degreesToRadians(30.25)).toBeCloseTo(expected, 10);
        });

        it('должен конвертировать -22.75 градусов', () => {
            const expected = (-22.75 * Math.PI) / 180;
            expect(GeometryUtils.degreesToRadians(-22.75)).toBeCloseTo(expected, 10);
        });
    });

    describe('Граничные случаи', () => {
        it('должен конвертировать очень маленький угол', () => {
            expect(GeometryUtils.degreesToRadians(0.001)).toBeCloseTo((0.001 * Math.PI) / 180, 10);
        });

        it('должен конвертировать очень большой угол', () => {
            expect(GeometryUtils.degreesToRadians(10000)).toBeCloseTo((10000 * Math.PI) / 180, 10);
        });

        it('должен конвертировать очень маленький отрицательный угол', () => {
            expect(GeometryUtils.degreesToRadians(-0.001)).toBeCloseTo((-0.001 * Math.PI) / 180, 10);
        });
    });

    describe('Практические случаи', () => {
        it('должен конвертировать угол поворота объекта на 15 градусов', () => {
            const expected = (15 * Math.PI) / 180;
            expect(GeometryUtils.degreesToRadians(15)).toBeCloseTo(expected, 10);
        });

        it('должен конвертировать угол поворота объекта на -30 градусов', () => {
            const expected = (-30 * Math.PI) / 180;
            expect(GeometryUtils.degreesToRadians(-30)).toBeCloseTo(expected, 10);
        });

        it('должен конвертировать угол поворота объекта на 135 градусов', () => {
            const expected = (135 * Math.PI) / 180;
            expect(GeometryUtils.degreesToRadians(135)).toBeCloseTo(expected, 10);
        });

        it('должен конвертировать угол поворота объекта на 225 градусов', () => {
            const expected = (225 * Math.PI) / 180;
            expect(GeometryUtils.degreesToRadians(225)).toBeCloseTo(expected, 10);
        });
    });

    describe('Точность вычислений', () => {
        it('должен обеспечивать высокую точность для стандартных углов', () => {
            expect(GeometryUtils.degreesToRadians(60)).toBeCloseTo(Math.PI / 3, 15);
            expect(GeometryUtils.degreesToRadians(120)).toBeCloseTo(2 * Math.PI / 3, 15);
            expect(GeometryUtils.degreesToRadians(240)).toBeCloseTo(4 * Math.PI / 3, 15);
            expect(GeometryUtils.degreesToRadians(300)).toBeCloseTo(5 * Math.PI / 3, 15);
        });

        it('должен обеспечивать высокую точность для углов кратных 15 градусам', () => {
            expect(GeometryUtils.degreesToRadians(15)).toBeCloseTo(Math.PI / 12, 15);
            expect(GeometryUtils.degreesToRadians(30)).toBeCloseTo(Math.PI / 6, 15);
            expect(GeometryUtils.degreesToRadians(45)).toBeCloseTo(Math.PI / 4, 15);
            expect(GeometryUtils.degreesToRadians(60)).toBeCloseTo(Math.PI / 3, 15);
            expect(GeometryUtils.degreesToRadians(75)).toBeCloseTo(5 * Math.PI / 12, 15);
        });
    });

    describe('Математические свойства', () => {
        it('должен сохранять пропорциональность: 2x градусов = 2x радиан', () => {
            const angle1 = 30;
            const angle2 = 60;
            const rad1 = GeometryUtils.degreesToRadians(angle1);
            const rad2 = GeometryUtils.degreesToRadians(angle2);
            expect(rad2).toBeCloseTo(2 * rad1, 10);
        });

        it('должен корректно обрабатывать отрицательные углы', () => {
            const positive = GeometryUtils.degreesToRadians(45);
            const negative = GeometryUtils.degreesToRadians(-45);
            expect(negative).toBeCloseTo(-positive, 10);
        });

        it('должен корректно обрабатывать углы больше 360 градусов', () => {
            const angle1 = 45;
            const angle2 = 405; // 45 + 360
            const rad1 = GeometryUtils.degreesToRadians(angle1);
            const rad2 = GeometryUtils.degreesToRadians(angle2);
            expect(rad2).toBeCloseTo(rad1 + 2 * Math.PI, 10);
        });
    });
});

describe('radiansToDegrees', () => {
    describe('Базовые случаи', () => {
        it('должен конвертировать 0 радиан в 0 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(0)).toBe(0);
        });

        it('должен конвертировать π/2 радиан в 90 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
        });

        it('должен конвертировать π радиан в 180 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI)).toBeCloseTo(180, 10);
        });

        it('должен конвертировать 3π/2 радиан в 270 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(3 * Math.PI / 2)).toBeCloseTo(270, 10);
        });

        it('должен конвертировать 2π радиан в 360 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(2 * Math.PI)).toBeCloseTo(360, 10);
        });
    });

    describe('Отрицательные углы', () => {
        it('должен конвертировать -π/2 радиан в -90 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(-Math.PI / 2)).toBeCloseTo(-90, 10);
        });

        it('должен конвертировать -π радиан в -180 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(-Math.PI)).toBeCloseTo(-180, 10);
        });

        it('должен конвертировать -2π радиан в -360 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(-2 * Math.PI)).toBeCloseTo(-360, 10);
        });

        it('должен конвертировать -π/4 радиан в -45 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(-Math.PI / 4)).toBeCloseTo(-45, 10);
        });
    });

    describe('Дробные радианы', () => {
        it('должен конвертировать π/6 радиан в 30 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI / 6)).toBeCloseTo(30, 10);
        });

        it('должен конвертировать π/3 радиан в 60 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI / 3)).toBeCloseTo(60, 10);
        });

        it('должен конвертировать π/12 радиан в 15 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI / 12)).toBeCloseTo(15, 10);
        });

        it('должен конвертировать 5π/12 радиан в 75 градусов', () => {
            expect(GeometryUtils.radiansToDegrees(5 * Math.PI / 12)).toBeCloseTo(75, 10);
        });
    });

    describe('Граничные случаи', () => {
        it('должен конвертировать очень маленький угол', () => {
            expect(GeometryUtils.radiansToDegrees(0.001)).toBeCloseTo(0.001 * 180 / Math.PI, 10);
        });

        it('должен конвертировать очень большой угол', () => {
            expect(GeometryUtils.radiansToDegrees(100)).toBeCloseTo(100 * 180 / Math.PI, 10);
        });

        it('должен конвертировать очень маленький отрицательный угол', () => {
            expect(GeometryUtils.radiansToDegrees(-0.001)).toBeCloseTo(-0.001 * 180 / Math.PI, 10);
        });
    });

    describe('Практические случаи', () => {
        it('должен конвертировать угол поворота объекта на π/4 радиан', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI / 4)).toBeCloseTo(45, 10);
        });

        it('должен конвертировать угол поворота объекта на -π/6 радиан', () => {
            expect(GeometryUtils.radiansToDegrees(-Math.PI / 6)).toBeCloseTo(-30, 10);
        });

        it('должен конвертировать угол поворота объекта на 2π/3 радиан', () => {
            expect(GeometryUtils.radiansToDegrees(2 * Math.PI / 3)).toBeCloseTo(120, 10);
        });

        it('должен конвертировать угол поворота объекта на 5π/6 радиан', () => {
            expect(GeometryUtils.radiansToDegrees(5 * Math.PI / 6)).toBeCloseTo(150, 10);
        });
    });

    describe('Точность вычислений', () => {
        it('должен обеспечивать высокую точность для стандартных углов', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI / 3)).toBeCloseTo(60, 10);
            expect(GeometryUtils.radiansToDegrees(2 * Math.PI / 3)).toBeCloseTo(120, 10);
            expect(GeometryUtils.radiansToDegrees(4 * Math.PI / 3)).toBeCloseTo(240, 10);
            expect(GeometryUtils.radiansToDegrees(5 * Math.PI / 3)).toBeCloseTo(300, 10);
        });

        it('должен обеспечивать высокую точность для углов кратных π/12', () => {
            expect(GeometryUtils.radiansToDegrees(Math.PI / 12)).toBeCloseTo(15, 10);
            expect(GeometryUtils.radiansToDegrees(Math.PI / 6)).toBeCloseTo(30, 10);
            expect(GeometryUtils.radiansToDegrees(Math.PI / 4)).toBeCloseTo(45, 10);
            expect(GeometryUtils.radiansToDegrees(Math.PI / 3)).toBeCloseTo(60, 10);
            expect(GeometryUtils.radiansToDegrees(5 * Math.PI / 12)).toBeCloseTo(75, 10);
        });
    });

    describe('Математические свойства', () => {
        it('должен сохранять пропорциональность: 2x радиан = 2x градусов', () => {
            const rad1 = Math.PI / 6; // 30 градусов
            const rad2 = Math.PI / 3; // 60 градусов
            const deg1 = GeometryUtils.radiansToDegrees(rad1);
            const deg2 = GeometryUtils.radiansToDegrees(rad2);
            expect(deg2).toBeCloseTo(2 * deg1, 10);
        });

        it('должен корректно обрабатывать отрицательные углы', () => {
            const positive = GeometryUtils.radiansToDegrees(Math.PI / 4);
            const negative = GeometryUtils.radiansToDegrees(-Math.PI / 4);
            expect(negative).toBeCloseTo(-positive, 10);
        });

        it('должен корректно обрабатывать углы больше 2π', () => {
            const angle1 = Math.PI / 4; // 45 градусов
            const angle2 = angle1 + 2 * Math.PI; // 45 + 360 = 405 градусов
            const deg1 = GeometryUtils.radiansToDegrees(angle1);
            const deg2 = GeometryUtils.radiansToDegrees(angle2);
            expect(deg2).toBeCloseTo(deg1 + 360, 10);
        });
    });

    describe('Обратная конвертация', () => {
        it('должен корректно работать с обратной конвертацией degreesToRadians', () => {
            const originalDegrees = 67.5;
            const radians = GeometryUtils.degreesToRadians(originalDegrees);
            const backToDegrees = GeometryUtils.radiansToDegrees(radians);
            expect(backToDegrees).toBeCloseTo(originalDegrees, 10);
        });

        it('должен корректно работать с обратной конвертацией для отрицательных углов', () => {
            const originalDegrees = -123.45;
            const radians = GeometryUtils.degreesToRadians(originalDegrees);
            const backToDegrees = GeometryUtils.radiansToDegrees(radians);
            expect(backToDegrees).toBeCloseTo(originalDegrees, 10);
        });

        it('должен корректно работать с обратной конвертацией для дробных углов', () => {
            const originalDegrees = 89.999;
            const radians = GeometryUtils.degreesToRadians(originalDegrees);
            const backToDegrees = GeometryUtils.radiansToDegrees(radians);
            expect(backToDegrees).toBeCloseTo(originalDegrees, 10);
        });
    });
});