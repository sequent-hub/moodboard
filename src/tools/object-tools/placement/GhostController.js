import * as PIXI from 'pixi.js';
import { MINDMAP_LAYOUT } from '../../../ui/mindmap/MindmapLayoutConfig.js';

export class GhostController {
    constructor(host) {
        this.host = host;
    }

    showFileGhost() {
        const host = this.host;
        if (!host.selectedFile || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.6;
        if (host.app && host.app.view) {
            const rect = host.app.view.getBoundingClientRect();
            const cursorX = (typeof host.app.view._lastMouseX === 'number') ? host.app.view._lastMouseX : (rect.left + rect.width / 2);
            const cursorY = (typeof host.app.view._lastMouseY === 'number') ? host.app.view._lastMouseY : (rect.top + rect.height / 2);
            const worldPoint = host._toWorld(cursorX, cursorY);
            this.updateGhostPosition(worldPoint.x, worldPoint.y);
        }
        const fileFont = (host.selectedFile.properties?.fontFamily) || 'Caveat, Arial, cursive';
        const primaryFont = String(fileFont).split(',')[0].trim().replace(/^['"]|['"]$/g, '') || 'Caveat';
        void primaryFont;

        const width = host.selectedFile.properties.width || 120;
        const height = host.selectedFile.properties.height || 140;

        const shadow = new PIXI.Graphics();
        try {
            shadow.filters = [new PIXI.filters.BlurFilter(6)];
        } catch (e) {}
        shadow.beginFill(0x000000, 1);
        shadow.drawRect(0, 0, width, height);
        shadow.endFill();
        shadow.x = 2;
        shadow.y = 3;
        shadow.alpha = 0.18;

        const background = new PIXI.Graphics();
        background.beginFill(0xFFFFFF, 1);
        background.drawRect(0, 0, width, height);
        background.endFill();

        const icon = new PIXI.Graphics();
        const iconSize = Math.min(48, width * 0.4);
        const iconWidthDrawn = iconSize * 0.8;
        const iconX = (width - iconWidthDrawn) / 2;
        const iconY = 16;
        icon.beginFill(0x6B7280, 1);
        icon.drawRect(iconX, iconY, iconWidthDrawn, iconSize);
        icon.endFill();

        const fileName = host.selectedFile.fileName || 'File';
        const displayName = fileName;
        const nameText = new PIXI.Text(displayName, {
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
            fontSize: 12,
            fill: 0x333333,
            align: 'center',
            wordWrap: true,
            breakWords: true,
            wordWrapWidth: Math.max(1, width - 24)
        });
        nameText.anchor.set(0.5, 0);
        nameText.x = width / 2;
        nameText.y = iconY + iconSize + 8;

        host.ghostContainer.addChild(shadow);
        host.ghostContainer.addChild(background);
        host.ghostContainer.addChild(icon);
        host.ghostContainer.addChild(nameText);

        host.ghostContainer.pivot.x = width / 2;
        host.ghostContainer.pivot.y = height / 2;

        host.world.addChild(host.ghostContainer);
    }

    hideGhost() {
        const host = this.host;
        if (host.ghostContainer && host.world) {
            host.world.removeChild(host.ghostContainer);
            host.ghostContainer.destroy();
            host.ghostContainer = null;
        }
    }

    updateGhostPosition(x, y) {
        const host = this.host;
        if (host.ghostContainer) {
            host.ghostContainer.x = x;
            host.ghostContainer.y = y;
        }
    }

    async showImageGhost() {
        const host = this.host;
        if (!host.selectedImage || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.6;

        const isEmojiIcon = host.selectedImage.properties?.isEmojiIcon;
        const maxWidth = host.selectedImage.properties.width || (isEmojiIcon ? 64 : 300);
        const maxHeight = host.selectedImage.properties.height || (isEmojiIcon ? 64 : 200);

        try {
            const imageUrl = URL.createObjectURL(host.selectedImage.file);
            const texture = await PIXI.Texture.fromURL(imageUrl);

            const imageAspect = texture.width / texture.height;
            let width = maxWidth;
            let height = maxWidth / imageAspect;

            if (height > maxHeight) {
                height = maxHeight;
                width = maxHeight * imageAspect;
            }

            const sprite = new PIXI.Sprite(texture);
            sprite.width = width;
            sprite.height = height;

            const border = new PIXI.Graphics();
            border.lineStyle(2, 0xDEE2E6, 0.8);
            border.drawRoundedRect(-2, -2, width + 4, height + 4, 4);

            host.ghostContainer.addChild(border);
            host.ghostContainer.addChild(sprite);

            host.ghostContainer.pivot.x = width / 2;
            host.ghostContainer.pivot.y = height / 2;

            URL.revokeObjectURL(imageUrl);
        } catch (error) {
            console.warn('Не удалось загрузить превью изображения, показываем заглушку:', error);

            const graphics = new PIXI.Graphics();
            graphics.beginFill(0xF8F9FA, 0.8);
            graphics.lineStyle(2, 0xDEE2E6, 0.8);
            graphics.drawRoundedRect(0, 0, maxWidth, maxHeight, 8);
            graphics.endFill();

            graphics.beginFill(0x6C757D, 0.6);
            graphics.drawRoundedRect(maxWidth * 0.2, maxHeight * 0.15, maxWidth * 0.6, maxHeight * 0.3, 4);
            graphics.endFill();

            const fileName = host.selectedImage.fileName || 'Image';
            const displayName = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;

            const nameText = new PIXI.Text(displayName, {
                fontFamily: 'Arial, sans-serif',
                fontSize: 12,
                fill: 0x495057,
                align: 'center',
                wordWrap: true,
                wordWrapWidth: maxWidth - 10
            });

            nameText.x = (maxWidth - nameText.width) / 2;
            nameText.y = maxHeight * 0.55;

            host.ghostContainer.addChild(graphics);
            host.ghostContainer.addChild(nameText);

            host.ghostContainer.pivot.x = maxWidth / 2;
            host.ghostContainer.pivot.y = maxHeight / 2;
        }

        host.world.addChild(host.ghostContainer);
    }

    async showImageUrlGhost() {
        const host = this.host;
        if (!host.pending || host.pending.type !== 'image' || !host.world) return;
        const src = host.pending.properties?.src;
        if (!src) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.6;

        const isEmojiIcon = host.pending.properties?.isEmojiIcon;
        const maxWidth = host.pending.size?.width || host.pending.properties?.width || (isEmojiIcon ? 64 : 56);
        const maxHeight = host.pending.size?.height || host.pending.properties?.height || (isEmojiIcon ? 64 : 56);

        try {
            const texture = await PIXI.Texture.fromURL(src);
            const imageAspect = (texture.width || 1) / (texture.height || 1);
            let width = maxWidth;
            let height = maxWidth / imageAspect;
            if (height > maxHeight) {
                height = maxHeight;
                width = maxHeight * imageAspect;
            }

            const sprite = new PIXI.Sprite(texture);
            sprite.width = Math.max(1, Math.round(width));
            sprite.height = Math.max(1, Math.round(height));

            const border = new PIXI.Graphics();
            try { border.lineStyle({ width: 2, color: 0xDEE2E6, alpha: 0.8 }); }
            catch (_) { border.lineStyle(2, 0xDEE2E6, 0.8); }
            border.drawRoundedRect(-2, -2, sprite.width + 4, sprite.height + 4, 4);

            host.ghostContainer.addChild(border);
            host.ghostContainer.addChild(sprite);
            host.ghostContainer.pivot.set(sprite.width / 2, sprite.height / 2);
        } catch (e) {
            const g = new PIXI.Graphics();
            g.beginFill(0xF0F0F0, 0.8);
            g.lineStyle(2, 0xDEE2E6, 0.8);
            g.drawRoundedRect(0, 0, maxWidth, maxHeight, 8);
            g.endFill();
            host.ghostContainer.addChild(g);
            host.ghostContainer.pivot.set(maxWidth / 2, maxHeight / 2);
        }

        host.world.addChild(host.ghostContainer);

        if (!isEmojiIcon) {
            try {
                if (host.app && host.app.view && src) {
                    const cursorSize = 24;
                    const url = encodeURI(src);
                    host.cursor = `url(${url}) ${Math.floor(cursorSize / 2)} ${Math.floor(cursorSize / 2)}, default`;
                    host.app.view.style.cursor = host.cursor;
                }
            } catch (_) {}
        } else if (host.app && host.app.view) {
            host.cursor = 'default';
            host.app.view.style.cursor = host.cursor;
        }
    }

    showTextGhost() {
        const host = this.host;
        if (!host.pending || host.pending.type !== 'text' || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.6;

        const fontSize = host.pending.properties?.fontSize || 18;
        const width = 120;
        const height = fontSize + 20;

        const background = new PIXI.Graphics();
        background.beginFill(0xFFFFFF, 0.8);
        background.lineStyle(1, 0x007BFF, 0.8);
        background.drawRoundedRect(0, 0, width, height, 4);
        background.endFill();

        const placeholderText = new PIXI.Text('Текст', {
            fontFamily: 'Arial, sans-serif',
            fontSize: fontSize,
            fill: 0x6C757D,
            align: 'left'
        });

        placeholderText.x = 8;
        placeholderText.y = (height - placeholderText.height) / 2;

        const cursor = new PIXI.Graphics();
        cursor.lineStyle(2, 0x007BFF, 0.8);
        cursor.moveTo(placeholderText.x + placeholderText.width + 4, placeholderText.y);
        cursor.lineTo(placeholderText.x + placeholderText.width + 4, placeholderText.y + placeholderText.height);

        host.ghostContainer.addChild(background);
        host.ghostContainer.addChild(placeholderText);
        host.ghostContainer.addChild(cursor);

        host.ghostContainer.pivot.x = width / 2;
        host.ghostContainer.pivot.y = height / 2;

        host.world.addChild(host.ghostContainer);
    }

    showNoteGhost() {
        const host = this.host;
        if (!host.pending || host.pending.type !== 'note' || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.6;

        const width = host.pending.properties?.width || 250;
        const height = host.pending.properties?.height || 250;
        const backgroundColor = (typeof host.pending.properties?.backgroundColor === 'number')
            ? host.pending.properties.backgroundColor
            : 0xFFF9C4;
        const textColor = (typeof host.pending.properties?.textColor === 'number')
            ? host.pending.properties.textColor
            : 0x1A1A1A;
        void textColor;

        const background = new PIXI.Graphics();
        background.beginFill(backgroundColor, 1);
        background.drawRoundedRect(0, 0, width, height, 2);
        background.endFill();

        host.ghostContainer.addChild(background);

        host.ghostContainer.pivot.x = width / 2;
        host.ghostContainer.pivot.y = height / 2;

        host.world.addChild(host.ghostContainer);
    }

    showEmojiGhost() {
        const host = this.host;
        if (!host.pending || host.pending.type !== 'emoji' || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.7;

        const content = host.pending.properties?.content || '🙂';
        const fontSize = host.pending.properties?.fontSize || 48;
        const width = host.pending.properties?.width || fontSize;
        const height = host.pending.properties?.height || fontSize;

        const emojiText = new PIXI.Text(content, {
            fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Arial',
            fontSize: fontSize
        });

        if (typeof emojiText.anchor?.set === 'function') {
            emojiText.anchor.set(0, 0);
        }

        const bounds = emojiText.getLocalBounds();
        const baseW = Math.max(1, bounds.width || 1);
        const baseH = Math.max(1, bounds.height || 1);

        const scaleX = width / baseW;
        const scaleY = height / baseH;
        const scale = Math.min(scaleX, scaleY);

        emojiText.scale.set(scale, scale);

        const background = new PIXI.Graphics();
        background.beginFill(0xFFFFFF, 0.3);
        background.lineStyle(1, 0xDDDDDD, 0.5);
        background.drawRoundedRect(-4, -4, width + 8, height + 8, 4);
        background.endFill();

        host.ghostContainer.addChild(background);
        host.ghostContainer.addChild(emojiText);

        host.ghostContainer.pivot.x = width / 2;
        host.ghostContainer.pivot.y = height / 2;

        host.world.addChild(host.ghostContainer);
    }

    showFrameGhost() {
        const host = this.host;
        if (!host.pending || host.pending.type !== 'frame' || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.6;

        const width = host.pending.properties?.width || 200;
        const height = host.pending.properties?.height || 300;
        const fillColor = (host.pending.properties?.backgroundColor ?? host.pending.properties?.fillColor) ?? 0xFFFFFF;
        const title = host.pending.properties?.title || 'Новый';

        const rootStyles = (typeof window !== 'undefined') ? getComputedStyle(document.documentElement) : null;
        const cssBorderWidth = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-border-width') || '4') : 4;
        const cssCornerRadius = rootStyles ? parseFloat(rootStyles.getPropertyValue('--frame-corner-radius') || '6') : 6;
        const cssBorderColor = rootStyles ? rootStyles.getPropertyValue('--frame-border-color').trim() : '';
        const borderWidth = Number.isFinite(cssBorderWidth) ? cssBorderWidth : 4;
        const cornerRadius = Number.isFinite(cssCornerRadius) ? cssCornerRadius : 6;
        let strokeColor;
        if (cssBorderColor && cssBorderColor.startsWith('#')) {
            strokeColor = parseInt(cssBorderColor.slice(1), 16);
        } else {
            strokeColor = (typeof host.pending.properties?.borderColor === 'number') ? host.pending.properties.borderColor : 0xE0E0E0;
        }

        const frameGraphics = new PIXI.Graphics();
        try {
            frameGraphics.lineStyle({ width: borderWidth, color: strokeColor, alpha: 1, alignment: 1 });
        } catch (e) {
            frameGraphics.lineStyle(borderWidth, strokeColor, 1);
        }
        frameGraphics.beginFill(fillColor, 1);
        frameGraphics.drawRoundedRect(0, 0, width, height, cornerRadius);
        frameGraphics.endFill();

        const titleText = new PIXI.Text(title, {
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fill: 0x333333,
            fontWeight: 'bold'
        });
        titleText.anchor.set(0, 0);
        titleText.x = 8;
        titleText.y = 4;

        host.ghostContainer.addChild(frameGraphics);
        host.ghostContainer.addChild(titleText);

        host.ghostContainer.pivot.x = width / 2;
        host.ghostContainer.pivot.y = height / 2;

        host.world.addChild(host.ghostContainer);
    }

    showShapeGhost() {
        const host = this.host;
        if (!host.pending || host.pending.type !== 'shape' || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.6;

        const kind = host.pending.properties?.kind || 'square';
        const width = 100;
        const height = 100;
        const fillColor = 0x3b82f6;
        const cornerRadius = host.pending.properties?.cornerRadius || 10;

        const shapeGraphics = new PIXI.Graphics();
        shapeGraphics.beginFill(fillColor, 0.8);

        switch (kind) {
            case 'circle': {
                const r = Math.min(width, height) / 2;
                shapeGraphics.drawCircle(width / 2, height / 2, r);
                break;
            }
            case 'rounded': {
                const r = cornerRadius || 10;
                shapeGraphics.drawRoundedRect(0, 0, width, height, r);
                break;
            }
            case 'triangle': {
                shapeGraphics.moveTo(width / 2, 0);
                shapeGraphics.lineTo(width, height);
                shapeGraphics.lineTo(0, height);
                shapeGraphics.lineTo(width / 2, 0);
                break;
            }
            case 'diamond': {
                shapeGraphics.moveTo(width / 2, 0);
                shapeGraphics.lineTo(width, height / 2);
                shapeGraphics.lineTo(width / 2, height);
                shapeGraphics.lineTo(0, height / 2);
                shapeGraphics.lineTo(width / 2, 0);
                break;
            }
            case 'parallelogram': {
                const skew = Math.min(width * 0.25, 20);
                shapeGraphics.moveTo(skew, 0);
                shapeGraphics.lineTo(width, 0);
                shapeGraphics.lineTo(width - skew, height);
                shapeGraphics.lineTo(0, height);
                shapeGraphics.lineTo(skew, 0);
                break;
            }
            case 'arrow': {
                const shaftH = Math.max(6, height * 0.3);
                const shaftY = (height - shaftH) / 2;
                shapeGraphics.drawRect(0, shaftY, width * 0.6, shaftH);
                shapeGraphics.moveTo(width * 0.6, 0);
                shapeGraphics.lineTo(width, height / 2);
                shapeGraphics.lineTo(width * 0.6, height);
                shapeGraphics.lineTo(width * 0.6, 0);
                break;
            }
            case 'square':
            default: {
                shapeGraphics.drawRect(0, 0, width, height);
                break;
            }
        }
        shapeGraphics.endFill();

        const border = new PIXI.Graphics();
        border.lineStyle(2, 0x007BFF, 0.6);
        border.drawRect(-2, -2, width + 4, height + 4);

        host.ghostContainer.addChild(border);
        host.ghostContainer.addChild(shapeGraphics);

        host.ghostContainer.pivot.x = width / 2;
        host.ghostContainer.pivot.y = height / 2;

        host.world.addChild(host.ghostContainer);
    }

    showMindmapGhost() {
        const host = this.host;
        if (!host.pending || host.pending.type !== 'mindmap' || !host.world) return;

        this.hideGhost();

        host.ghostContainer = new PIXI.Container();
        host.ghostContainer.alpha = 0.75;

        const width = Math.max(1, Math.round(host.pending.properties?.width || MINDMAP_LAYOUT.width));
        const height = Math.max(1, Math.round(host.pending.properties?.height || MINDMAP_LAYOUT.height));
        const strokeColor = (typeof host.pending.properties?.strokeColor === 'number')
            ? host.pending.properties.strokeColor
            : 0x2563EB;
        const fillColor = (typeof host.pending.properties?.fillColor === 'number')
            ? host.pending.properties.fillColor
            : 0x3B82F6;
        const fillAlpha = (typeof host.pending.properties?.fillAlpha === 'number')
            ? host.pending.properties.fillAlpha
            : 0.25;
        const strokeWidth = (typeof host.pending.properties?.strokeWidth === 'number')
            ? host.pending.properties.strokeWidth
            : 2;
        const fontSize = Math.max(1, Math.round(host.pending.properties?.fontSize || MINDMAP_LAYOUT.fontSize));
        const fontFamily = host.pending.properties?.fontFamily || 'Roboto, Arial, sans-serif';
        const textColor = host.pending.properties?.textColor || 0x1e3a8a;
        const paddingX = Math.max(0, Math.round(host.pending.properties?.paddingX ?? MINDMAP_LAYOUT.paddingX));
        const placeholderText = 'Напишите что-нибудь';
        const dynamicRadius = Math.max(0, Math.floor(Math.min(width, height) / 2));
        const baseHeight = Math.max(
            1,
            Math.round(host.pending.properties?.capsuleBaseHeight || host.pending.properties?.height || MINDMAP_LAYOUT.height)
        );
        const baseRadius = Math.max(0, Math.floor(baseHeight / 2));
        const cornerRadius = Math.min(dynamicRadius, baseRadius);

        const graphics = new PIXI.Graphics();
        const drawGhostCapsule = (lineWidth, alpha = 1) => {
            try {
                graphics.lineStyle({
                    width: lineWidth,
                    color: strokeColor,
                    alpha,
                    alignment: 0,
                    cap: 'round',
                    join: 'round',
                    miterLimit: 2,
                });
            } catch (_) {
                graphics.lineStyle(lineWidth, strokeColor, alpha, 0);
            }
            graphics.drawRoundedRect(0, 0, width, height, cornerRadius);
        };

        try {
            graphics.beginFill(fillColor, fillAlpha);
            graphics.drawRoundedRect(0, 0, width, height, cornerRadius);
            graphics.endFill();
        } catch (_) {
            graphics.beginFill(fillColor, fillAlpha);
            graphics.drawRoundedRect(0, 0, width, height, cornerRadius);
            graphics.endFill();
        }

        drawGhostCapsule(strokeWidth + 1, 0.35);
        drawGhostCapsule(strokeWidth, 1);

        host.ghostContainer.addChild(graphics);

        try {
            const lineHeight = Math.max(1, Math.round(fontSize * 1.24));
            const rendererRes = Math.max(1, host.app?.renderer?.resolution || 1);
            const textScale = 1 / rendererRes;
            const placeholder = new PIXI.Text(placeholderText, {
                fontFamily,
                fontSize,
                fontWeight: '400',
                fill: textColor,
                align: 'left',
                lineHeight,
                wordWrap: false,
                breakWords: false,
            });
            placeholder.alpha = 0.45;
            placeholder.scale.set(textScale);
            placeholder.x = paddingX;
            const localBounds = placeholder.getLocalBounds();
            const measuredHeight = Math.max(1, Number.isFinite(localBounds?.height) ? localBounds.height : lineHeight);
            const scaledMeasuredHeight = measuredHeight * textScale;
            const targetY = (height - scaledMeasuredHeight) / 2;
            placeholder.y = (Math.round(targetY * 2) / 2) - 2;
            host.ghostContainer.addChild(placeholder);
        } catch (_) {}

        host.ghostContainer.pivot.x = width / 2;
        host.ghostContainer.pivot.y = height / 2;
        host.world.addChild(host.ghostContainer);
    }
}
