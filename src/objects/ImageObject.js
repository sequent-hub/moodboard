import * as PIXI from 'pixi.js';

/**
 * ImageObject — отображение загруженного изображения как спрайт
 */
export class ImageObject {
    constructor(objectData = {}) {
        this.objectData = objectData;
        let src = objectData.properties?.src || objectData.src;
        const isEmojiIcon = !!objectData.properties?.isEmojiIcon;
        // Не используем устаревшие blob: URL — они недолговечны и приводят к ERR_FILE_NOT_FOUND
        if (typeof src === 'string' && src.startsWith('blob:')) {
            src = null;
        }
        this.width = Math.max(1, Math.round(objectData.width || objectData.properties?.width || 200));
        this.height = Math.max(1, Math.round(objectData.height || objectData.properties?.height || 150));
        const texture = src ? PIXI.Texture.from(src, { resourceOptions: { resolution: (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1 } }) : PIXI.Texture.WHITE;
        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5, 0.5); // центр для совместимости с позиционированием по центру
        if (isEmojiIcon) {
            this.sprite.roundPixels = true; // без nearest, чтобы не форсить увеличение
        }
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

        if (this.sprite.texture.baseTexture) {
            // Ставим ту же resolution, что у renderer, чтобы минимизировать блюр
            try {
                const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
                this.sprite.texture.baseTexture.setResolution(dpr);
            } catch (_) {}
            // оставляем стандартную фильтрацию, чтобы не усиливать пиксельную лесенку при уменьшении
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
        let w = Math.max(1, size.width || 1);
        let h = Math.max(1, size.height || 1);
        // Если объект помечен как emoji icon — сохраняем квадратные пропорции
        const isEmojiIcon = !!(this.objectData?.properties?.isEmojiIcon);
        if (isEmojiIcon) {
            const s = Math.max(w, h);
            w = s; h = s;
        }
        const apply = () => {
            const texW = this.sprite.texture.width || 1;
            const texH = this.sprite.texture.height || 1;
            this.sprite.scale.set(w / texW, h / texH);
        };
        if (this.sprite.texture.baseTexture?.valid) apply(); else this.sprite.texture.baseTexture?.once('loaded', apply);
    }
}


