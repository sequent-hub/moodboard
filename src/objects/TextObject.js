import * as PIXI from 'pixi.js';

/**
 * Класс объекта «Текст»
 * Отвечает за создание текстового PIXI-объекта и корректное масштабирование по size.
 */
export class TextObject {
    /**
     * @param {Object} objectData
     *  - content: string
     *  - color, fontFamily, fontSize, fontWeight, fontStyle
     *  - width/height: целевые размеры для первичного масштаба
     */
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.content = objectData.content || objectData.properties?.content || 'Text';
        this.fontFamily = objectData.fontFamily || objectData.properties?.fontFamily || 'Arial';
        this.fontSize = objectData.fontSize || objectData.properties?.fontSize || 16;
        this.color = objectData.color || objectData.properties?.color || 0x000000;
        this.fontWeight = objectData.fontWeight || objectData.properties?.fontWeight || 'normal';
        this.fontStyle = objectData.fontStyle || objectData.properties?.fontStyle || 'normal';

        const style = new PIXI.TextStyle({
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fill: this.color,
            fontWeight: this.fontWeight,
            fontStyle: this.fontStyle
        });
        this.text = new PIXI.Text(this.content, style);

        // Базовые размеры для масштабирования
        const bounds = this.text.getLocalBounds();
        this.baseW = Math.max(1, bounds.width || 1);
        this.baseH = Math.max(1, bounds.height || 1);

        // Первичное приведение к целевым размерам из objectData (если заданы)
        const targetW = objectData.width || this.baseW;
        const targetH = objectData.height || this.baseH;
        this._applyScaleToFit(targetW, targetH);

        // Сохраняем мета
        this.text._mb = {
            ...(this.text._mb || {}),
            type: 'text',
            properties: {
                content: this.content,
                fontFamily: this.fontFamily,
                fontSize: this.fontSize,
                color: this.color,
                fontWeight: this.fontWeight,
                fontStyle: this.fontStyle,
                baseW: this.baseW,
                baseH: this.baseH
            }
        };
    }

    getPixi() {
        return this.text;
    }

    setText(content) {
        this.content = content;
        this.text.text = content;
        const bounds = this.text.getLocalBounds();
        this.baseW = Math.max(1, bounds.width || 1);
        this.baseH = Math.max(1, bounds.height || 1);
    }

    setStyle({ fontFamily, fontSize, color, fontWeight, fontStyle } = {}) {
        if (fontFamily) this.fontFamily = fontFamily;
        if (typeof fontSize === 'number') this.fontSize = fontSize;
        if (typeof color === 'number') this.color = color;
        if (fontWeight) this.fontWeight = fontWeight;
        if (fontStyle) this.fontStyle = fontStyle;
        this.text.style = new PIXI.TextStyle({
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fill: this.color,
            fontWeight: this.fontWeight,
            fontStyle: this.fontStyle
        });
        const bounds = this.text.getLocalBounds();
        this.baseW = Math.max(1, bounds.width || 1);
        this.baseH = Math.max(1, bounds.height || 1);
    }

    /** Масштабирование текста под указанные размеры */
    updateSize(size) {
        if (!size) return;
        const targetW = Math.max(1, size.width || 1);
        const targetH = Math.max(1, size.height || 1);
        const t = this.text;
        const prev = { x: t.x, y: t.y, rot: t.rotation, px: t.pivot?.x || 0, py: t.pivot?.y || 0 };
        this._applyScaleToFit(targetW, targetH);
        t.pivot.set(prev.px, prev.py);
        t.x = prev.x;
        t.y = prev.y;
        t.rotation = prev.rot;
    }

    _applyScaleToFit(targetW, targetH) {
        const sx = targetW / (this.baseW || 1);
        const sy = targetH / (this.baseH || 1);
        const s = Math.min(sx, sy);
        this.text.scale.set(s, s);
    }
}

