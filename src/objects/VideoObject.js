import * as PIXI from 'pixi.js';

/**
 * VideoObject — отображение видео как спрайт с видео-текстурой.
 *
 * MVP: спрайт с muted-видео, клик по телу переключает play/pause.
 * Трансформации (resize/rotate/move/z-order) переиспользуют конвейер ImageObject:
 * единственный display-object — Sprite с anchor(0.5).
 */
export class VideoObject {
    constructor(objectData = {}) {
        this.objectData = objectData;
        let src = objectData.src || objectData.properties?.src;
        // blob: недолговечны — не используем (ERR_FILE_NOT_FOUND после перезагрузки)
        if (typeof src === 'string' && src.startsWith('blob:')) {
            src = null;
        }
        this.src = src;
        this.width = Math.max(1, Math.round(objectData.width || objectData.properties?.width || 300));
        this.height = Math.max(1, Math.round(objectData.height || objectData.properties?.height || 169));

        this.videoEl = null;
        let texture = PIXI.Texture.WHITE;
        if (src) {
            const video = document.createElement('video');
            video.src = src;
            video.muted = true;
            video.loop = objectData.properties?.loop ?? true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            video.preload = 'auto';
            this.videoEl = video;
            // autoPlay:false — стартуем на паузе, первый кадр показываем после loadeddata
            texture = PIXI.Texture.from(video, { resourceOptions: { autoPlay: false } });
        }

        this.sprite = new PIXI.Sprite(texture);
        this.sprite.anchor.set(0.5, 0.5);
        if (!src) {
            this.sprite.tint = 0xcccccc;
        }

        this._fitToSize = () => {
            const texW = this.sprite.texture.width || 1;
            const texH = this.sprite.texture.height || 1;
            this.sprite._mb = {
                ...(this.sprite._mb || {}),
                type: this.objectData?.type || 'video',
                properties: {
                    ...((this.sprite._mb || {}).properties || {}),
                    src,
                    baseW: texW,
                    baseH: texH
                }
            };
            this.sprite.scale.set(this.width / texW, this.height / texH);
        };

        const onError = () => {
            this.sprite.texture = PIXI.Texture.WHITE;
            this.sprite.tint = 0xcccccc;
            this._fitToSize();
        };

        if (this.videoEl) {
            // Показать первый кадр на паузе: после loadeddata толкнуть кадр в GPU
            this.videoEl.addEventListener('loadeddata', () => {
                try { this.sprite.texture.update(); } catch (_) {}
                this._fitToSize();
            }, { once: true });
            this.videoEl.addEventListener('error', onError, { once: true });
        }

        if (this.sprite.texture.baseTexture?.valid) {
            this._fitToSize();
        } else if (this.sprite.texture.baseTexture) {
            this.sprite.texture.baseTexture.once('loaded', this._fitToSize);
        }

        this._setupPlaybackToggle();
    }

    /**
     * Клик по телу видео (без перетаскивания) переключает play/pause.
     * Порог движения отсекает drag, чтобы перемещение не триггерило тоггл.
     */
    _setupPlaybackToggle() {
        this.sprite.eventMode = 'static';
        let down = null;
        this._onDown = (e) => { down = { x: e.global.x, y: e.global.y }; };
        this._onUp = (e) => {
            if (!down) return;
            const dx = e.global.x - down.x;
            const dy = e.global.y - down.y;
            down = null;
            if (Math.hypot(dx, dy) < 5) {
                this.toggle();
            }
        };
        this.sprite.on('pointerdown', this._onDown);
        this.sprite.on('pointerup', this._onUp);
        this.sprite.on('pointerupoutside', () => { down = null; });
    }

    play() {
        if (!this.videoEl) return;
        const p = this.videoEl.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {});
        }
    }

    pause() {
        if (this.videoEl) {
            this.videoEl.pause();
        }
    }

    toggle() {
        if (!this.videoEl) return;
        if (this.videoEl.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    getPixi() {
        return this.sprite;
    }

    updateSize(size) {
        if (!size) return;
        this.width = Math.max(1, Math.round(size.width || 1));
        this.height = Math.max(1, Math.round(size.height || 1));
        const apply = () => {
            const texW = this.sprite.texture.width || 1;
            const texH = this.sprite.texture.height || 1;
            this.sprite.scale.set(this.width / texW, this.height / texH);
        };
        if (this.sprite.texture.baseTexture?.valid) {
            apply();
        } else {
            this.sprite.texture.baseTexture?.once('loaded', apply);
        }
    }

    /**
     * Остановить видео и освободить ресурсы (вызывается при удалении объекта).
     * Без этого HTMLVideoElement продолжает жить и тикать текстуру — утечка.
     */
    destroy() {
        if (this.videoEl) {
            try {
                this.videoEl.pause();
                this.videoEl.removeAttribute('src');
                this.videoEl.load();
            } catch (_) {}
            this.videoEl = null;
        }
        try {
            this.sprite?.off('pointerdown', this._onDown);
            this.sprite?.off('pointerup', this._onUp);
        } catch (_) {}
        try {
            if (this.sprite?.texture && this.sprite.texture !== PIXI.Texture.WHITE) {
                this.sprite.texture.destroy(true);
            }
        } catch (_) {}
    }
}
