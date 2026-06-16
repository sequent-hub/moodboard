import { Events } from '../core/events/Events.js';
import { ApplyCropCommand } from '../core/commands/ApplyCropCommand.js';
import { CropOverlay } from '../ui/CropOverlay.js';

const ASPECT_RATIOS = {
    custom:    null,
    original:  null,
    square:    1,
    circle:    1,
    portrait:  3 / 4,
    landscape: 4 / 3,
    wide:      16 / 9,
};

/**
 * Оркестратор режима кадрирования изображения.
 * Управляет жизненным циклом CropOverlay и применяет команду ApplyCropCommand.
 */
export class CropController {
    constructor({ core, eventBus, container }) {
        this.core = core;
        this.eventBus = eventBus;
        this.container = container;

        this._overlay = null;
        this._objectId = null;
        this._currentImgBounds = null;
        this._onEscapeHandler = null;
        this._onViewportHandler = null;

        // Колбэк вызывается при входе/выходе из режима crop (true = вошли, false = вышли).
        // Устанавливается снаружи (ImagePropertiesPanel).
        this._onActivate = null;
        // Флаг: смена формата внутри активного crop — не нужно скрывать/показывать панель.
        this._changingFormat = false;
    }

    /**
     * Войти в режим кадрирования.
     * @param {string} objectId
     * @param {string} template - 'custom'|'original'|'circle'|'square'|'portrait'|'landscape'|'wide'
     */
    start(objectId, template) {
        const wasActive = !!this._overlay;
        this.cancel();

        let imgBounds = this._getObjectBounds(objectId);
        if (!imgBounds) return;

        // Для 'original' разворачиваем до оригинальных границ, если они сохранены
        if (template === 'original') {
            const objects = this.core.state.getObjects();
            const obj = objects.find(o => o.id === objectId);
            if (obj?.properties?.originalPosition && obj?.properties?.originalSize) {
                imgBounds = {
                    x: obj.properties.originalPosition.x,
                    y: obj.properties.originalPosition.y,
                    w: obj.properties.originalSize.width,
                    h: obj.properties.originalSize.height,
                };
            }
        }

        this._objectId = objectId;
        this._currentImgBounds = imgBounds;

        const aspectRatio = ASPECT_RATIOS[template] ?? null;
        const initCrop = this._computeInitialCrop(imgBounds, aspectRatio);

        this._overlay = new CropOverlay({
            container: this.container,
            core: this.core,
            imgBounds,
            initCrop,
            template,
            aspectRatio,
            onFormatChange: (newTemplate) => {
                this._changingFormat = true;
                this.start(objectId, newTemplate);
                this._changingFormat = false;
            },
            onCommit: (cropNorm) => this._commit(objectId, cropNorm, template),
            onCancel: () => this.cancel(),
        });

        if (!this._changingFormat && !wasActive) {
            this._onActivate?.(true);
        }

        this._onEscapeHandler = () => this.cancel();
        this.eventBus.on(Events.Keyboard.Escape, this._onEscapeHandler);

        this._onViewportHandler = () => {
            if (this._overlay && this._currentImgBounds) {
                this._overlay.reposition(this._currentImgBounds);
            }
        };
        this.eventBus.on(Events.Viewport.Changed, this._onViewportHandler);
        this.eventBus.on(Events.UI.ZoomPercent, this._onViewportHandler);
        this.eventBus.on(Events.Tool.PanUpdate, this._onViewportHandler);
    }

    /** Отменить режим кадрирования без применения. */
    cancel() {
        const wasActive = !!this._overlay;
        if (this._overlay) {
            this._overlay.destroy();
            this._overlay = null;
        }
        if (this._onEscapeHandler) {
            this.eventBus.off(Events.Keyboard.Escape, this._onEscapeHandler);
            this._onEscapeHandler = null;
        }
        if (this._onViewportHandler) {
            this.eventBus.off(Events.Viewport.Changed, this._onViewportHandler);
            this.eventBus.off(Events.UI.ZoomPercent, this._onViewportHandler);
            this.eventBus.off(Events.Tool.PanUpdate, this._onViewportHandler);
            this._onViewportHandler = null;
        }
        this._objectId = null;
        this._currentImgBounds = null;

        if (wasActive && !this._changingFormat) {
            this._onActivate?.(false);
        }
    }

    destroy() {
        this.cancel();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Приватные
    // ─────────────────────────────────────────────────────────────────────

    _getObjectBounds(objectId) {
        const posData  = { objectId, position: null };
        const sizeData = { objectId, size: null };
        this.eventBus.emit(Events.Tool.GetObjectPosition, posData);
        this.eventBus.emit(Events.Tool.GetObjectSize, sizeData);
        if (!posData.position || !sizeData.size) return null;
        return {
            x: posData.position.x,
            y: posData.position.y,
            w: sizeData.size.width,
            h: sizeData.size.height,
        };
    }

    _computeInitialCrop(imgBounds, aspectRatio) {
        if (!aspectRatio) {
            return { x: 0, y: 0, w: 1, h: 1 };
        }
        // Вписать прямоугольник с нужным AR в центр изображения
        const imgAR = imgBounds.w / imgBounds.h;
        let normW, normH;
        if (imgAR > aspectRatio) {
            normH = 1;
            normW = aspectRatio / imgAR;
        } else {
            normW = 1;
            normH = imgAR / aspectRatio;
        }
        return {
            x: (1 - normW) / 2,
            y: (1 - normH) / 2,
            w: normW,
            h: normH,
        };
    }

    _commit(objectId, cropNorm, template) {
        // Сначала снимаем оверлей
        this.cancel();

        const objects = this.core.state.getObjects();
        const obj = objects.find(o => o.id === objectId);
        if (!obj) return;

        // Запоминаем оригинал (один раз при первом кропе)
        const isFirstCrop = !obj.properties?.originalPosition;
        const originalPosition = isFirstCrop
            ? { ...obj.position }
            : { ...obj.properties.originalPosition };
        const originalSize = isFirstCrop
            ? { width: obj.width, height: obj.height }
            : { ...obj.properties.originalSize };

        const existingCrop = obj.properties?.cropRect || null;
        let newX, newY, newW, newH, finalCropRect;

        if (template === 'original') {
            // cropNorm задан относительно оригинальных границ
            newX = originalPosition.x + cropNorm.x * originalSize.width;
            newY = originalPosition.y + cropNorm.y * originalSize.height;
            newW = cropNorm.w * originalSize.width;
            newH = cropNorm.h * originalSize.height;
            finalCropRect = { ...cropNorm };
        } else {
            // Новая позиция и размер (в мировых пикселях)
            newX = obj.position.x + cropNorm.x * obj.width;
            newY = obj.position.y + cropNorm.y * obj.height;
            newW = cropNorm.w * obj.width;
            newH = cropNorm.h * obj.height;

            // Составной cropRect относительно ОРИГИНАЛЬНОЙ текстуры
            if (existingCrop) {
                finalCropRect = {
                    x: existingCrop.x + cropNorm.x * existingCrop.w,
                    y: existingCrop.y + cropNorm.y * existingCrop.h,
                    w: cropNorm.w * existingCrop.w,
                    h: cropNorm.h * existingCrop.h,
                };
            } else {
                finalCropRect = { ...cropNorm };
            }
        }

        const before = {
            cropRect:         existingCrop ? { ...existingCrop } : null,
            cropShape:        obj.properties?.cropShape || null,
            position:         { ...obj.position },
            size:             { width: obj.width, height: obj.height },
            originalPosition: { ...originalPosition },
            originalSize:     { ...originalSize },
            borderRadius:     obj.properties?.borderRadius || 0,
        };

        const after = {
            cropRect:         finalCropRect,
            cropShape:        template === 'circle' ? 'circle' : 'rect',
            position:         { x: newX, y: newY },
            size:             { width: newW, height: newH },
            originalPosition,
            originalSize,
            borderRadius:     obj.properties?.borderRadius || 0,
        };

        const cmd = new ApplyCropCommand(this.core, objectId, before, after);
        this.core.history.executeCommand(cmd);
    }
}
