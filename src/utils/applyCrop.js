import * as PIXI from 'pixi.js';
import { applyRoundedMask } from './applyRoundedMask.js';

/**
 * Применяет или снимает кроп на PIXI-спрайте изображения.
 *
 * @param {PIXI.Sprite} sprite
 * @param {object|null} cropRect  - { x, y, w, h } нормализованные 0..1 от оригинальной текстуры, или null
 * @param {string|null} cropShape - 'circle' | 'rect' | null
 * @param {{ width: number, height: number }} displaySize - размер отображения в мировых пикселях
 * @param {{ x: number, y: number }} position - top-left позиция в мировых координатах
 * @param {number} [borderRadius=0] - радиус скругления (переприменяем после снятия кропа)
 */
export function applyCropToSprite(sprite, cropRect, cropShape, displaySize, position, borderRadius = 0) {
    if (!sprite || !sprite.texture?.baseTexture) return;

    const baseTex = sprite.texture.baseTexture;
    // Оригинальные размеры текстуры (до любого кропа)
    const baseW = sprite._mb?.properties?.baseW || baseTex.realWidth || baseTex.width || 1;
    const baseH = sprite._mb?.properties?.baseH || baseTex.realHeight || baseTex.height || 1;
    const src = sprite._mb?.properties?.src;

    // Снять circle-маску кропа
    if (sprite._cropCircleMask) {
        if (sprite.mask === sprite._cropCircleMask) sprite.mask = null;
        try { sprite._cropCircleMask.destroy({ children: true }); } catch (_) {}
        sprite._cropCircleMask = null;
    }

    const { width: dW, height: dH } = displaySize;

    if (cropRect) {
        const { x: nx, y: ny, w: nw, h: nh } = cropRect;
        const frameX = Math.max(0, Math.round(nx * baseW));
        const frameY = Math.max(0, Math.round(ny * baseH));
        const frameW = Math.max(1, Math.min(Math.round(nw * baseW), baseW - frameX));
        const frameH = Math.max(1, Math.min(Math.round(nh * baseH), baseH - frameY));

        // Новая текстура с кадрированием
        const croppedTex = new PIXI.Texture(baseTex, new PIXI.Rectangle(frameX, frameY, frameW, frameH));
        sprite.texture = croppedTex;
        sprite.scale.set(dW / frameW, dH / frameH);
        sprite.x = Math.round(position.x + dW / 2);
        sprite.y = Math.round(position.y + dH / 2);

        // Сбросить borderRadius-маску — circle или radius переустановит её
        if (sprite._borderRadiusMask) {
            if (sprite.mask === sprite._borderRadiusMask) sprite.mask = null;
            try { sprite._borderRadiusMask.destroy({ children: true }); } catch (_) {}
            sprite._borderRadiusMask = null;
        }

        if (cropShape === 'circle') {
            // Вписанная окружность в локальных координатах спрайта (local = texture frame px)
            const r = Math.min(frameW, frameH) / 2;
            const g = new PIXI.Graphics();
            g.beginFill(0xffffff);
            g.drawCircle(0, 0, r);
            g.endFill();
            sprite.addChild(g);
            sprite._cropCircleMask = g;
            sprite.mask = g;
        } else if (borderRadius > 0) {
            applyRoundedMask(sprite, borderRadius);
        }

    } else {
        // Восстановить оригинальную текстуру
        if (src) {
            try {
                const origTex = PIXI.Texture.from(src);
                if (origTex) sprite.texture = origTex;
            } catch (_) {}
        }

        const texW = sprite.texture.width || 1;
        const texH = sprite.texture.height || 1;
        sprite.scale.set(dW / texW, dH / texH);
        sprite.x = Math.round(position.x + dW / 2);
        sprite.y = Math.round(position.y + dH / 2);

        // Сбросить borderRadius-маску и переприменить если нужно
        if (sprite._borderRadiusMask) {
            if (sprite.mask === sprite._borderRadiusMask) sprite.mask = null;
            try { sprite._borderRadiusMask.destroy({ children: true }); } catch (_) {}
            sprite._borderRadiusMask = null;
        }
        if (borderRadius > 0) {
            applyRoundedMask(sprite, borderRadius);
        }
    }
}
