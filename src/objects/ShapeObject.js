import * as PIXI from 'pixi.js';

/**
 * Класс объекта «Фигура»
 * Отвечает за создание и перерисовку фигур разных типов с сохранением формы при ресайзе.
 */
export class ShapeObject {
    /**
     * @param {Object} objectData Полные данные объекта из состояния
     *  - width, height
     *  - color
     *  - properties.kind: 'square' | 'rounded' | 'circle' | 'triangle' | 'diamond' | 'parallelogram' | 'arrow'
     *  - properties.cornerRadius?: number (для rounded)
     */
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.width = objectData.width || 100;
        this.height = objectData.height || 100;
        this.fillColor = objectData.color ?? 0x3b82f6;
        const props = objectData.properties || {};
        this.kind = props.kind || 'square';
        this.cornerRadius = props.cornerRadius || 10;

        this.graphics = new PIXI.Graphics();
        this._draw(this.width, this.height, this.fillColor, this.kind, this.cornerRadius);
    }

    /** Возвращает PIXI-объект */
    getPixi() {
        return this.graphics;
    }

    /** Установить цвет заливки */
    setColor(color) {
        if (typeof color === 'number') {
            this.fillColor = color;
            this._redrawPreserveTransform(this.width, this.height, this.fillColor, this.kind, this.cornerRadius);
        }
    }

    /** Обновить свойства фигуры (тип, радиус скругления) */
    setProperties({ kind, cornerRadius } = {}) {
        if (kind) this.kind = kind;
        if (typeof cornerRadius === 'number') this.cornerRadius = cornerRadius;
        this._redrawPreserveTransform(this.width, this.height, this.fillColor, this.kind, this.cornerRadius);
    }

    /** Обновить размер фигуры */
    updateSize(size) {
        if (!size) return;
        const w = Math.max(0, size.width || 0);
        const h = Math.max(0, size.height || 0);
        this.width = w;
        this.height = h;
        this._redrawPreserveTransform(w, h, this.fillColor, this.kind, this.cornerRadius);
    }

    /** Перерисовать с сохранением трансформаций */
    _redrawPreserveTransform(width, height, color, kind, cornerRadius) {
        const g = this.graphics;
        // Сохраняем текущий центр и поворот
        const centerX = g.x;
        const centerY = g.y;
        const rot = g.rotation || 0;

        this._draw(width, height, color, kind, cornerRadius);
        // ВАЖНО: для согласованности с ядром (позиция — левый-верх, PIXI — центр)
        // pivot должен всегда быть в центре объекта (w/2, h/2)
        g.pivot.set(width / 2, height / 2);
        // Восстанавливаем центр
        g.x = centerX;
        g.y = centerY;
        g.rotation = rot;
    }

    /** Непосредственная отрисовка фигуры */
    _draw(w, h, color, kind, cornerRadius) {
        const g = this.graphics;
        g.clear();
        g.beginFill(color, 1);
        switch (kind) {
            case 'circle': {
                const r = Math.min(w, h) / 2;
                g.drawCircle(w / 2, h / 2, r);
                break;
            }
            case 'rounded': {
                const r = cornerRadius || 10;
                g.drawRoundedRect(0, 0, w, h, r);
                break;
            }
            case 'triangle': {
                g.moveTo(w / 2, 0);
                g.lineTo(w, h);
                g.lineTo(0, h);
                g.lineTo(w / 2, 0);
                break;
            }
            case 'diamond': {
                g.moveTo(w / 2, 0);
                g.lineTo(w, h / 2);
                g.lineTo(w / 2, h);
                g.lineTo(0, h / 2);
                g.lineTo(w / 2, 0);
                break;
            }
            case 'parallelogram': {
                const skew = Math.min(w * 0.25, 20);
                g.moveTo(skew, 0);
                g.lineTo(w, 0);
                g.lineTo(w - skew, h);
                g.lineTo(0, h);
                g.lineTo(skew, 0);
                break;
            }
            case 'arrow': {
                const shaftH = Math.max(6, h * 0.3);
                const shaftY = (h - shaftH) / 2;
                g.drawRect(0, shaftY, w * 0.6, shaftH);
                g.moveTo(w * 0.6, 0);
                g.lineTo(w, h / 2);
                g.lineTo(w * 0.6, h);
                g.lineTo(w * 0.6, 0);
                break;
            }
            case 'square':
            default: {
                g.drawRect(0, 0, w, h);
                break;
            }
        }
        g.endFill();
    }
}

