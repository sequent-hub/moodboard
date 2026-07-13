import * as PIXI from 'pixi.js';

/**
 * Градиентная заглушка, которую показываем в мировом слое на месте будущего
 * изображения, пока идёт загрузка на сервер и подтверждение сохранения
 * (OS drag-and-drop). Заглушка живёт в worldLayer, поэтому панится/зумится
 * вместе с доской и точно совпадает по месту и размеру с приземляемой картинкой.
 */

function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function buildGradientCanvas(w, h, radius) {
    const canvas = document.createElement('canvas');
    // Ограничиваем разрешение текстуры: заглушка временная, огромные битмапы не нужны.
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext('2d');
    roundRectPath(ctx, 0, 0, cw, ch, radius * scale);
    ctx.clip();

    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, '#e9edf2');
    grad.addColorStop(0.5, '#f5f7f9');
    grad.addColorStop(1, '#dde3ea');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    return canvas;
}

function buildShimmerCanvas(bandW, h) {
    const canvas = document.createElement('canvas');
    const cw = Math.max(1, Math.round(bandW));
    const ch = Math.max(1, Math.round(Math.min(h, 512)));
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, cw, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    return canvas;
}

/**
 * @param {PIXI.Application} app - для тикера shimmer-анимации
 * @param {number} width - мировая ширина будущего изображения
 * @param {number} height - мировая высота будущего изображения
 * @returns {{ node: PIXI.Container, destroy: () => void }}
 */
export function createDropPlaceholder(app, width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const radius = Math.max(4, Math.min(12, Math.min(w, h) * 0.08));

    const container = new PIXI.Container();
    container.name = 'futurello-drop-placeholder';
    container.eventMode = 'none';
    container.interactiveChildren = false;

    const textures = [];
    let tickerFn = null;

    const baseTexture = PIXI.Texture.from(buildGradientCanvas(w, h, radius));
    textures.push(baseTexture);
    const base = new PIXI.Sprite(baseTexture);
    base.width = w;
    base.height = h;
    container.addChild(base);

    try {
        const bandW = Math.max(48, Math.round(w * 0.35));
        const shimmerTexture = PIXI.Texture.from(buildShimmerCanvas(bandW, h));
        textures.push(shimmerTexture);
        const shimmer = new PIXI.Sprite(shimmerTexture);
        shimmer.width = bandW;
        shimmer.height = h;
        shimmer.x = -bandW;
        container.addChild(shimmer);

        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff, 1);
        mask.drawRoundedRect(0, 0, w, h, radius);
        mask.endFill();
        container.addChild(mask);
        shimmer.mask = mask;

        const travel = w + bandW;
        const speed = travel / 72; // ~1.2 c при 60 fps
        tickerFn = () => {
            shimmer.x += speed;
            if (shimmer.x > w) {
                shimmer.x = -bandW;
            }
        };
        app?.ticker?.add(tickerFn);
    } catch (_) {
        // shimmer необязателен — при сбое остаётся статичный градиент
    }

    const destroy = () => {
        try {
            if (tickerFn) {
                app?.ticker?.remove(tickerFn);
            }
        } catch (_) { /* no-op */ }
        try {
            if (container.parent) {
                container.parent.removeChild(container);
            }
        } catch (_) { /* no-op */ }
        try {
            container.destroy({ children: true });
        } catch (_) { /* no-op */ }
        for (const texture of textures) {
            try {
                texture.destroy(true);
            } catch (_) { /* no-op */ }
        }
    };

    return { node: container, destroy };
}
