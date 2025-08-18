/**
 * Утилиты для геометрических вычислений
 * Вынесены из PixiEngine для упрощения основного класса
 */
export class GeometryUtils {
    /**
     * Вычисляет расстояние от точки до отрезка.
     * Точка - то место куда кликнул пользователь.
     * Отрезок - нарисованная линия.
     * Возвращает - 0 или больше 0, если 0 то клик по линии.
     *
     * @param {number} px - X координата точки
     * @param {number} py - Y координата точки  
     * @param {number} ax - X координата начала отрезка
     * @param {number} ay - Y координата начала отрезка
     * @param {number} bx - X координата конца отрезка
     * @param {number} by - Y координата конца отрезка
     * @returns {number} Расстояние от точки до отрезка
     */
    static distancePointToSegment(px, py, ax, ay, bx, by) {
        const vectorABx = bx - ax;
        const vectorABy = by - ay;
        const vectorAPx = px - ax;
        const vectorAPy = py - ay;
        const squaredLengthAB = vectorABx * vectorABx + vectorABy * vectorABy;
        
        if (squaredLengthAB === 0) {
            return Math.hypot(px - ax, py - ay);
        }
        
        let t = (vectorAPx * vectorABx + vectorAPy * vectorABy) / squaredLengthAB;
        t = Math.max(0, Math.min(1, t));
        
        const closestX = ax + t * vectorABx;
        const closestY = ay + t * vectorABy;
        
        return Math.hypot(px - closestX, py - closestY);
    }

    /**
     * Проверяет, находится ли точка внутри прямоугольника
     * Точка - то место куда кликнул пользователь.
     *
     * @param {number} x - X координата точки
     * @param {number} y - Y координата точки
     * @param {number} rectX - X координата левого верхнего угла прямоугольника
     * @param {number} rectY - Y координата левого верхнего угла прямоугольника
     * @param {number} rectWidth - Ширина прямоугольника
     * @param {number} rectHeight - Высота прямоугольника
     * @returns {boolean} true если точка внутри прямоугольника
     */
    static pointInRect(x, y, rectX, rectY, rectWidth, rectHeight) {
        return x >= rectX && x <= rectX + rectWidth && 
               y >= rectY && y <= rectY + rectHeight;
    }

    /**
     * Вычисляет центр прямоугольника
     * @param {number} x - X координата левого верхнего угла
     * @param {number} y - Y координата левого верхнего угла
     * @param {number} width - Ширина
     * @param {number} height - Высота
     * @returns {{x: number, y: number}} Координаты центра
     */
    static getRectCenter(x, y, width, height) {
        return {
            x: x + width / 2,
            y: y + height / 2
        };
    }

    /**
     * Конвертирует градусы в радианы
     * @param {number} degrees - Угол в градусах
     * @returns {number} Угол в радианах
     */
    static degreesToRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Конвертирует радианы в градусы
     * @param {number} radians - Угол в радианах
     * @returns {number} Угол в градусах
     */
    static radiansToDegrees(radians) {
        return radians * 180 / Math.PI;
    }
}
