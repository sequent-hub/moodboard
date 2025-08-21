import * as PIXI from 'pixi.js';

/**
 * Класс объекта «Текст» — PIXI-объект служит только для хит-тестов/манипуляций.
 * Визуальный рендер текста выполняет HtmlTextLayer.
 */
export class TextObject {
    /**
     * @param {Object} objectData
     *  - properties.content: string
     *  - properties.fontSize: number
     *  - width/height: габариты текстового блока
     */
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.content = objectData.content || objectData.properties?.content || '';
        this.fontSize = objectData.fontSize || objectData.properties?.fontSize || 16;

        // Создаем невидимый прямоугольник для хит-теста
        const w = Math.max(1, objectData.width || 160);
        const h = Math.max(1, objectData.height || 36);
        this.rect = new PIXI.Graphics();
        this._drawRect(w, h);

        // Метаданные типа
        this.rect._mb = {
            ...(this.rect._mb || {}),
            type: 'text',
            properties: {
                content: this.content,
                fontSize: this.fontSize,
                baseW: w,
                baseH: h
            }
        };
    }

    _drawRect(width, height) {
        const g = this.rect;
        g.clear();
        // Едва заметная заливка для стабильного containsPoint (почти прозрачная)
        g.beginFill(0x000000, 0.001);
        g.drawRect(0, 0, width, height);
        g.endFill();
    }

    getPixi() {
        return this.rect;
    }

    setText(content) {
        this.content = content;
        if (this.rect && this.rect._mb) {
            this.rect._mb.properties = {
                ...(this.rect._mb.properties || {}),
                content: content
            };
        }
    }

    setStyle({ fontSize } = {}) {
        if (typeof fontSize === 'number') this.fontSize = fontSize;
        if (this.rect && this.rect._mb) {
            this.rect._mb.properties = {
                ...(this.rect._mb.properties || {}),
                fontSize: this.fontSize
            };
        }
    }

    /** Обновление габаритов хит-бокса */
    updateSize(size) {
        if (!size) return;
        const w = Math.max(1, size.width || 1);
        const h = Math.max(1, size.height || 1);
        const t = this.rect;
        const prevCenter = { x: t.x, y: t.y };
        const prevRot = t.rotation || 0;
        this._drawRect(w, h);
        // Центрируем pivot по новым размерам и восстанавливаем центр в мире
        t.pivot.set(w / 2, h / 2);
        t.x = prevCenter.x;
        t.y = prevCenter.y;
        t.rotation = prevRot;
        // Не обновляем baseW/baseH — они служат опорой для масштабирования шрифта в HtmlTextLayer
    }
}

