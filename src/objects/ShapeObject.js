import * as PIXI from 'pixi.js';
import { drawShape } from './shape/ShapeDrawer.js';

const DEFAULTS = {
    borderColor: 0xd4d4d4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderOpacity: 1,
};

/**
 * Класс объекта «Фигура»
 * Отвечает за создание и перерисовку фигур разных типов с сохранением формы при ресайзе.
 *
 * State-контракт:
 *   color: <number>                   — заливка
 *   properties.kind                   — square|rounded|circle|triangle|diamond|parallelogram|arrow
 *   properties.cornerRadius           — радиус скругления (применяется к square тоже, 0..N)
 *   properties.borderColor            — цвет обводки (PIXI number), дефолт 0xD4D4D4
 *   properties.borderWidth            — толщина обводки (world px), дефолт 1
 *   properties.borderStyle            — 'solid'|'dashed'|'dotted', дефолт 'solid'
 *   properties.borderOpacity          — 0..1, дефолт 1
 */
export class ShapeObject {
    /**
     * @param {Object} objectData Полные данные объекта из состояния
     */
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.width = objectData.width || 100;
        this.height = objectData.height || 100;
        this.fillColor = objectData.color ?? 0xffffff;

        const props = objectData.properties || {};
        this.kind = props.kind || 'square';
        this.cornerRadius = props.cornerRadius ?? (this.kind === 'rounded' ? 10 : 0);
        this.borderColor = props.borderColor ?? DEFAULTS.borderColor;
        this.borderWidth = props.borderWidth ?? DEFAULTS.borderWidth;
        this.borderStyle = props.borderStyle ?? DEFAULTS.borderStyle;
        this.borderOpacity = props.borderOpacity ?? DEFAULTS.borderOpacity;

        this.graphics = new PIXI.Graphics();
        this._draw(this.width, this.height);
    }

    /** Возвращает PIXI-объект */
    getPixi() {
        return this.graphics;
    }

    /** Установить цвет заливки */
    setColor(color) {
        if (typeof color === 'number') {
            this.fillColor = color;
            this._redrawPreserveTransform(this.width, this.height);
        }
    }

    /** Обновить параметры обводки */
    setStroke({ borderColor, borderWidth, borderStyle, borderOpacity } = {}) {
        if (typeof borderColor === 'number') this.borderColor = borderColor;
        if (typeof borderWidth === 'number') this.borderWidth = borderWidth;
        if (borderStyle !== undefined) this.borderStyle = borderStyle;
        if (typeof borderOpacity === 'number') this.borderOpacity = borderOpacity;
        this._redrawPreserveTransform(this.width, this.height);
    }

    /** Обновить свойства фигуры (тип, радиус скругления, стиль обводки) */
    setProperties({ kind, cornerRadius, borderStyle } = {}) {
        if (kind) this.kind = kind;
        if (typeof cornerRadius === 'number') this.cornerRadius = cornerRadius;
        if (borderStyle !== undefined) this.borderStyle = borderStyle;
        this._redrawPreserveTransform(this.width, this.height);
    }

    /** Обновить размер фигуры */
    updateSize(size) {
        if (!size) return;
        const w = Math.max(0, size.width || 0);
        const h = Math.max(0, size.height || 0);
        this.width = w;
        this.height = h;
        this._redrawPreserveTransform(w, h);
    }

    /** Перерисовать с сохранением трансформаций */
    _redrawPreserveTransform(width, height) {
        const g = this.graphics;
        const centerX = g.x;
        const centerY = g.y;
        const rot = g.rotation || 0;

        this._draw(width, height);
        // pivot — всегда центр, чтобы согласовываться с ядром (top-left → center)
        g.pivot.set(width / 2, height / 2);
        g.x = centerX;
        g.y = centerY;
        g.rotation = rot;
    }

    /** Непосредственная отрисовка фигуры */
    _draw(w, h) {
        drawShape(this.graphics, w, h, this.fillColor, this.kind, this.cornerRadius, {
            borderColor: this.borderColor,
            borderWidth: this.borderWidth,
            borderStyle: this.borderStyle,
            borderOpacity: this.borderOpacity,
        });
    }
}
