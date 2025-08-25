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
        // Используем backgroundColor из данных объекта, если есть, иначе белый
        this.fillColor = this.objectData.backgroundColor || this.objectData.properties?.backgroundColor || 0xFFFFFF;
        this.strokeColor = this.objectData.borderColor || 0x333333;
        this.title = this.objectData.title || this.objectData.properties?.title || 'Новый';

        // Создаем контейнер для фрейма и заголовка
        this.container = new PIXI.Container();
        
        // Графика для прямоугольника фрейма
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        
        // Текст заголовка
        this.titleText = new PIXI.Text(this.title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: 0x333333,
            fontWeight: 'bold'
        });
        this.titleText.anchor.set(0, 1); // Левый нижний угол текста
        this.titleText.y = -5; // Немного выше фрейма
        this.container.addChild(this.titleText);
        
        this._draw(this.width, this.height, this.fillColor);
    }

    /**
     * Возвращает PIXI-объект
     */
    getPixi() {
        return this.container;
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
     * Установить заголовок фрейма
     * @param {string} title Новый заголовок
     */
    setTitle(title) {
        this.title = title || 'Новый';
        if (this.titleText) {
            this.titleText.text = this.title;
        }
    }

    /**
     * Установить цвет фона фрейма
     * @param {number} backgroundColor Цвет фона (hex)
     */
    setBackgroundColor(backgroundColor) {
        if (typeof backgroundColor === 'number') {
            this.fillColor = backgroundColor;
            this._redrawPreserveTransform(this.width, this.height, this.fillColor);
        }
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
        const container = this.container;
        const x = container.x;
        const y = container.y;
        const rot = container.rotation || 0;
        const pivotX = container.pivot?.x || 0;
        const pivotY = container.pivot?.y || 0;

        this._draw(width, height, color);

        container.pivot.set(pivotX, pivotY);
        container.x = x;
        container.y = y;
        container.rotation = rot;
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

