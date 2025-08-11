import { BaseGrid } from './BaseGrid.js';

/**
 * Изометрическая сетка для создания 3D эффектов
 */
export class IsometricGrid extends BaseGrid {
    constructor(options = {}) {
        super(options);
        this.type = 'isometric';
        
        // Угол наклона для изометрии (обычно 30 градусов)
        this.angle = options.angle || 30;
        this.angleRad = (this.angle * Math.PI) / 180;
        
        // Высота ромба в изометрической проекции
        this.isoHeight = this.size * Math.sin(this.angleRad);
        this.isoWidth = this.size * Math.cos(this.angleRad);
    }
    
    /**
     * Создает визуальное представление изометрической сетки
     */
    createVisual() {
        this.graphics.lineStyle(this.lineWidth, this.color, 1);
        
        this.drawIsometricLines();
    }
    
    /**
     * Рисует изометрические линии
     */
    drawIsometricLines() {
        // Левые диагональные линии (/)
        this.drawDiagonalLines(this.angleRad);
        
        // Правые диагональные линии (\)
        this.drawDiagonalLines(-this.angleRad);
        
        // Вертикальные линии (опционально)
        this.drawVerticalLines();
    }
    
    /**
     * Рисует диагональные линии под заданным углом
     */
    drawDiagonalLines(angle) {
        const stepX = this.size * Math.cos(Math.abs(angle));
        const stepY = this.size * Math.sin(Math.abs(angle));
        
        // Линии, идущие слева направо
        for (let start = -this.height; start <= this.width; start += stepX) {
            const x1 = start;
            const y1 = 0;
            
            let x2, y2;
            if (angle > 0) {
                // Линии поднимающиеся вправо
                x2 = start + (this.height / Math.tan(angle));
                y2 = this.height;
            } else {
                // Линии опускающиеся вправо
                x2 = start + (this.height / Math.tan(Math.abs(angle)));
                y2 = this.height;
            }
            
            this.drawClippedLine(x1, y1, x2, y2);
        }
    }
    
    /**
     * Рисует вертикальные линии
     */
    drawVerticalLines() {
        const step = this.size;
        
        for (let x = 0; x <= this.width; x += step) {
            this.graphics.moveTo(x, 0);
            this.graphics.lineTo(x, this.height);
        }
    }
    
    /**
     * Рисует линию с обрезкой по границам области
     */
    drawClippedLine(x1, y1, x2, y2) {
        // Простая обрезка - можно улучшить алгоритмом Коэна-Сазерленда
        const minX = Math.max(0, Math.min(x1, x2));
        const maxX = Math.min(this.width, Math.max(x1, x2));
        const minY = Math.max(0, Math.min(y1, y2));
        const maxY = Math.min(this.height, Math.max(y1, y2));
        
        if (minX <= maxX && minY <= maxY) {
            // Пересчитываем координаты для обрезанной линии
            const dx = x2 - x1;
            const dy = y2 - y1;
            
            if (Math.abs(dx) > 0.01) { // Избегаем деления на ноль
                const slope = dy / dx;
                
                let startX = Math.max(0, Math.min(x1, x2));
                let startY = y1 + slope * (startX - x1);
                
                let endX = Math.min(this.width, Math.max(x1, x2));
                let endY = y1 + slope * (endX - x1);
                
                // Обрезка по Y
                if (startY < 0) {
                    startY = 0;
                    startX = x1 + (startY - y1) / slope;
                }
                if (startY > this.height) {
                    startY = this.height;
                    startX = x1 + (startY - y1) / slope;
                }
                
                if (endY < 0) {
                    endY = 0;
                    endX = x1 + (endY - y1) / slope;
                }
                if (endY > this.height) {
                    endY = this.height;
                    endX = x1 + (endY - y1) / slope;
                }
                
                if (startX >= 0 && startX <= this.width && 
                    endX >= 0 && endX <= this.width) {
                    this.graphics.moveTo(startX, startY);
                    this.graphics.lineTo(endX, endY);
                }
            }
        }
    }
    
    /**
     * Вычисляет точку привязки для изометрической сетки
     */
    calculateSnapPoint(x, y) {
        // Преобразуем в изометрические координаты
        const isoX = (x - y * Math.cos(this.angleRad)) / this.isoWidth;
        const isoY = y / this.isoHeight;
        
        // Привязываем к сетке
        const snapIsoX = Math.round(isoX);
        const snapIsoY = Math.round(isoY);
        
        // Преобразуем обратно в экранные координаты
        const snapX = snapIsoX * this.isoWidth + snapIsoY * this.isoWidth * Math.cos(this.angleRad);
        const snapY = snapIsoY * this.isoHeight;
        
        return { x: snapX, y: snapY };
    }
    
    /**
     * Устанавливает угол изометрии
     */
    setAngle(angle) {
        this.angle = Math.max(15, Math.min(45, angle)); // Ограничиваем разумными пределами
        this.angleRad = (this.angle * Math.PI) / 180;
        this.isoHeight = this.size * Math.sin(this.angleRad);
        this.isoWidth = this.size * Math.cos(this.angleRad);
        this.updateVisual();
    }
    
    /**
     * Сериализует настройки изометрической сетки
     */
    serialize() {
        return {
            ...super.serialize(),
            angle: this.angle
        };
    }
}
