import { Events } from '../../core/events/Events.js';

export class PlacementToolV2 {
    constructor(eventBus, core) {
        this.eventBus = eventBus;
        this.core = core;
        this._onImageSelected = (payload) => this.handleImageSelected(payload);
        this._onImageCanceled = () => this.handleImageCanceled();
    }

    attach() {
        if (!this.eventBus) return;
        this.eventBus.on(Events.Place.ImageObject2Selected, this._onImageSelected);
        this.eventBus.on(Events.Place.ImageObject2Canceled, this._onImageCanceled);
    }

    destroy() {
        if (!this.eventBus) return;
        this.eventBus.off(Events.Place.ImageObject2Selected, this._onImageSelected);
        this.eventBus.off(Events.Place.ImageObject2Canceled, this._onImageCanceled);
    }

    handleImageSelected(payload) {
        if (!payload || !payload.file || !this.eventBus || !this.core?.pixi?.app?.view) return;

        const objectUrl = URL.createObjectURL(payload.file);
        const targetWidth = Math.max(1, payload.defaults?.width || 320);
        const fallbackHeight = Math.max(1, payload.defaults?.height || 220);

        const placeImageObject2 = (finalWidth, finalHeight) => {
            const center = this.getWorldCenter();
            if (!center) {
                URL.revokeObjectURL(objectUrl);
                return;
            }

            this.eventBus.emit(Events.UI.ToolbarAction, {
                type: 'image2',
                id: 'image2',
                position: {
                    x: Math.round(center.x - finalWidth / 2),
                    y: Math.round(center.y - finalHeight / 2)
                },
                properties: {
                    src: objectUrl,
                    name: payload.fileName || payload.file.name || 'image-object2',
                    width: finalWidth,
                    height: finalHeight,
                    source: 'image-object2'
                }
            });
        };

        const image = new Image();
        image.onload = () => {
            const width = targetWidth;
            const naturalWidth = Math.max(1, image.naturalWidth || width);
            const naturalHeight = Math.max(1, image.naturalHeight || fallbackHeight);
            const height = Math.max(1, Math.round((naturalHeight / naturalWidth) * width));
            placeImageObject2(width, height);
        };
        image.onerror = () => {
            placeImageObject2(targetWidth, fallbackHeight);
        };
        image.src = objectUrl;
    }

    handleImageCanceled() {
        // Новая логика отмены для ImageObject2 будет реализована здесь
    }

    getWorldCenter() {
        const app = this.core?.pixi?.app;
        const world = this.core?.pixi?.worldLayer || app?.stage;
        const view = app?.view;
        if (!world || !view) return null;

        const screenX = (view.clientWidth || 0) / 2;
        const screenY = (view.clientHeight || 0) / 2;
        const scale = world.scale?.x || 1;

        return {
            x: (screenX - (world.x || 0)) / scale,
            y: (screenY - (world.y || 0)) / scale
        };
    }
}

