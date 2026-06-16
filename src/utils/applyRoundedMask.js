import * as PIXI from 'pixi.js';

/**
 * Применяет PIXI-маску с закруглёнными углами к спрайту изображения.
 * Sprite имеет anchor(0.5, 0.5), поэтому маска рисуется от (-w/2, -h/2) в локальных координатах.
 * @param {PIXI.Sprite} pixiObject
 * @param {number} radius — радиус в мировых пикселях (0 = убрать маску)
 */
export function applyRoundedMask(pixiObject, radius) {
    const w = pixiObject.width;
    const h = pixiObject.height;
    if (!w || !h) return;

    const maxR = Math.floor(Math.min(w, h) / 2);
    const r = Math.max(0, Math.min(Math.round(radius), maxR));

    if (pixiObject._borderRadiusMask) {
        pixiObject._borderRadiusMask.destroy({ children: true });
        pixiObject._borderRadiusMask = null;
    }
    pixiObject.mask = null;

    if (r <= 0) return;

    const sx = Math.abs(pixiObject.scale?.x || 1);
    const sy = Math.abs(pixiObject.scale?.y || 1);
    const localW = sx > 0 ? w / sx : w;
    const localH = sy > 0 ? h / sy : h;
    const localR = Math.min(r / Math.min(sx || 1, sy || 1), Math.floor(Math.min(localW, localH) / 2));

    const g = new PIXI.Graphics();
    g.beginFill(0xffffff);
    g.drawRoundedRect(-localW / 2, -localH / 2, localW, localH, localR);
    g.endFill();

    pixiObject.addChild(g);
    pixiObject._borderRadiusMask = g;
    pixiObject.mask = g;
}
