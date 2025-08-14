import * as PIXI from 'pixi.js';

/**
 * Класс объекта «Эмоджи»
 * Текстовый смайл с корректным масштабированием под заданные размеры
 */
export class EmojiObject {
    /**
     * @param {Object} objectData
     *  - properties.content: строка-эмоджи
     *  - properties.fontSize: базовый размер шрифта
     *  - width/height: целевые размеры (при создании/ресайзе)
     */
    constructor(objectData = {}) {
        this.objectData = objectData;
        this.content = objectData.properties?.content || '🙂';
        this.baseFontSize = objectData.properties?.fontSize || 48;

        const style = new PIXI.TextStyle({
            fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Arial',
            fontSize: this.baseFontSize
        });

        this.text = new PIXI.Text(this.content, style);
        // Важный момент: якорь в левом верхнем углу, чтобы позиция соответствовала state.position
        if (typeof this.text.anchor?.set === 'function') {
            this.text.anchor.set(0, 0);
        }

        // Базовые размеры исходного глифа для дальнейшего масштабирования
        const bounds = this.text.getLocalBounds();
        this.baseW = Math.max(1, bounds.width || 1);
        this.baseH = Math.max(1, bounds.height || 1);

        // Если заданы целевые габариты — приводим к ним равномерным масштабом
        const targetW = objectData.width || this.baseW;
        const targetH = objectData.height || this.baseH;
        this._applyUniformScaleToFit(targetW, targetH);

        // Метаданные для движка
        this.text._mb = {
            ...(this.text._mb || {}),
            type: 'emoji',
            properties: {
                content: this.content,
                fontSize: this.baseFontSize,
                baseW: this.baseW,
                baseH: this.baseH
            }
        };
    }

    getPixi() {
        return this.text;
    }

    setContent(content) {
        this.content = content;
        this.text.text = content;
        const b = this.text.getLocalBounds();
        this.baseW = Math.max(1, b.width || 1);
        this.baseH = Math.max(1, b.height || 1);
    }

    setFontSize(fontSize) {
        this.baseFontSize = fontSize;
        this.text.style = new PIXI.TextStyle({
            fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Arial',
            fontSize: this.baseFontSize
        });
        const b = this.text.getLocalBounds();
        this.baseW = Math.max(1, b.width || 1);
        this.baseH = Math.max(1, b.height || 1);
    }

    /** Масштабирование под указанные габариты без сдвига позиции */
    updateSize(size) {
        if (!size) return;
        const t = this.text;
        const prev = { x: t.x, y: t.y, rot: t.rotation, px: t.pivot?.x || 0, py: t.pivot?.y || 0 };
        const w = Math.max(1, size.width || 1);
        const h = Math.max(1, size.height || 1);
        this._applyUniformScaleToFit(w, h);
        t.pivot.set(prev.px, prev.py);
        t.x = prev.x;
        t.y = prev.y;
        t.rotation = prev.rot;
    }

    _applyUniformScaleToFit(targetW, targetH) {
        const sx = targetW / (this.baseW || 1);
        const sy = targetH / (this.baseH || 1);
        const s = Math.min(sx, sy);
        this.text.scale.set(s, s);
    }
}


