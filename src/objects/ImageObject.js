import * as PIXI from 'pixi.js';

/**
 * ImageObject — отображение загруженного изображения как спрайт
 */
export class ImageObject {
    constructor(objectData = {}) {
        this.objectData = objectData;
        let src = objectData.properties?.src || objectData.src;
        // Не используем устаревшие blob: URL — они недолговечны и приводят к ERR_FILE_NOT_FOUND
        if (typeof src === 'string' && src.startsWith('blob:')) {
            src = null;
        }
        this.width = objectData.width || objectData.properties?.width || 200;
        this.height = objectData.height || objectData.properties?.height || 150;
        const texture = src ? PIXI.Texture.from(src) : PIXI.Texture.WHITE;
        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5, 0.5); // центр для совместимости с позиционированием по центру
        if (!src) {
            this.sprite.tint = 0xcccccc;
        }

        const fitToSize = () => {
            const texW = this.sprite.texture.width || 1;
            const texH = this.sprite.texture.height || 1;
            const sx = this.width / texW;
            const sy = this.height / texH;
            this.sprite.scale.set(sx, sy);
            // Обновим метаданные базовых размеров
            this.sprite._mb = {
                ...(this.sprite._mb || {}),
                type: 'image',
                properties: { src, baseW: texW, baseH: texH }
            };
        };

        const onError = () => {
            // Фолбек на плейсхолдер без спама ошибками
            this.sprite.texture = PIXI.Texture.WHITE;
            this.sprite.tint = 0xcccccc;
            fitToSize();
        };

        if (this.sprite.texture.baseTexture) {
            this.sprite.texture.baseTexture.once('error', onError);
        }

        if (this.sprite.texture.baseTexture?.valid) {
            fitToSize();
        } else if (this.sprite.texture.baseTexture) {
            this.sprite.texture.baseTexture.once('loaded', fitToSize);
        }
    }

    getPixi() {
        return this.sprite;
    }

    updateSize(size) {
        if (!size) return;
        const w = Math.max(1, size.width || 1);
        const h = Math.max(1, size.height || 1);
        const apply = () => {
            const texW = this.sprite.texture.width || 1;
            const texH = this.sprite.texture.height || 1;
            this.sprite.scale.set(w / texW, h / texH);
        };
        if (this.sprite.texture.baseTexture?.valid) apply(); else this.sprite.texture.baseTexture?.once('loaded', apply);
    }
}


