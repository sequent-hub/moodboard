import * as PIXI from 'pixi.js';

/**
 * Класс объекта «Фрейм» (контейнерная прямоугольная область)
 * Отвечает за создание PIXI-графики, изменение размеров и изменение заливки.
 */
export class FrameObject {
    /**
     * @param {Object} objectData Полные данные объекта из состояния
     */
    constructor(objectData) {
        this.objectData = objectData || {};
        this.width = this.objectData.width || 100;
        this.height = this.objectData.height || 100;
        this.borderWidth = 2;
        this.fillColor = 0xFFFFFF; // Непрозрачный белый
        this.strokeColor = this.objectData.borderColor || 0x333333;

        this.graphics = new PIXI.Graphics();
        this._draw(this.width, this.height, this.fillColor);
    }

    /**
     * Возвращает PIXI-объект
     */
    getPixi() {
        return this.graphics;
    }

    /**
     * Установить цвет заливки фрейма (без изменения размеров)
     * @param {number} color Цвет заливки (hex)
     */
    setFill(color) {
        if (typeof color === 'number') {
            this.fillColor = color;
        }
        this._redrawPreserveTransform(this.width, this.height, this.fillColor);
    }

    /**
     * Обновить размер фрейма
     * @param {{width:number,height:number}} size
     */
    updateSize(size) {
        if (!size) return;
        const w = Math.max(0, size.width || 0);
        const h = Math.max(0, size.height || 0);
        this.width = w;
        this.height = h;
        this._redrawPreserveTransform(w, h, this.fillColor);
    }

    /**
     * Перерисовать с сохранением трансформаций (позиция, pivot, rotation)
     */
    _redrawPreserveTransform(width, height, color) {
        const g = this.graphics;
        const x = g.x;
        const y = g.y;
        const rot = g.rotation || 0;
        const pivotX = g.pivot?.x || 0;
        const pivotY = g.pivot?.y || 0;

        this._draw(width, height, color);

        g.pivot.set(pivotX, pivotY);
        g.x = x;
        g.y = y;
        g.rotation = rot;
    }

    /**
     * Базовая отрисовка
     */
    _draw(width, height, color) {
        const g = this.graphics;
        g.clear();
        g.lineStyle(this.borderWidth, this.strokeColor, 1);
        g.beginFill(typeof color === 'number' ? color : 0xFFFFFF, 1);
        const halfBorder = this.borderWidth / 2;
        g.drawRect(halfBorder, halfBorder, Math.max(0, width - this.borderWidth), Math.max(0, height - this.borderWidth));
        g.endFill();
    }
}

