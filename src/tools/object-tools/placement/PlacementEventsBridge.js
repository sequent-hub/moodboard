import { Events } from '../../../core/events/Events.js';

export class PlacementEventsBridge {
    constructor(host) {
        this.host = host;
        this._attached = false;
    }

    attach() {
        if (this._attached || !this.host.eventBus) return;
        this._attached = true;

        this.host.eventBus.on(Events.Place.Set, (cfg) => {
            this.host.pending = cfg ? { ...cfg } : null;
            if (this.host.app && this.host.app.view) {
                const cur = this.host._getPendingCursor();
                this.host.cursor = cur;
                this.host.app.view.style.cursor = (cur === 'default') ? '' : cur;
            }
            this.host._updateCursorOverride();

            if (this.host.pending && this.host.app && this.host.world) {
                if (this.host.pending.type === 'note') {
                    this.host.showNoteGhost();
                } else if (this.host.pending.type === 'emoji') {
                    this.host.showEmojiGhost();
                } else if (this.host.pending.type === 'image') {
                    this.host.showImageUrlGhost();
                } else if (this.host.pending.type === 'frame') {
                    this.host.showFrameGhost();
                } else if (this.host.pending.type === 'frame-draw') {
                    this.host.startFrameDrawMode();
                } else if (this.host.pending.type === 'shape') {
                    this.host.showShapeGhost();
                }
                if (this.host.pending.placeOnMouseUp && this.host.app && this.host.app.view) {
                    const onUp = (ev) => {
                        this.host.app.view.removeEventListener('mouseup', onUp);
                        if (!this.host.pending) return;
                        const worldPoint = this.host._toWorld(ev.x, ev.y);
                        const position = {
                            x: Math.round(worldPoint.x - (this.host.pending.size?.width ?? 100) / 2),
                            y: Math.round(worldPoint.y - (this.host.pending.size?.height ?? 100) / 2)
                        };
                        const props = { ...(this.host.pending.properties || {}) };
                        this.host.payloadFactory.emitGenericPlacement(this.host.pending.type, position, props);
                        this.host.pending = null;
                        this.host.hideGhost();
                        this.host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                    };
                    this.host.app.view.addEventListener('mouseup', onUp, { once: true });
                }
            }
        });

        this.host.eventBus.on(Events.Tool.Activated, ({ tool }) => {
            if (tool === 'select') {
                this.host.sessionStore.clearSelectionState();
                this.host.hideGhost();
                this.host._updateCursorOverride();
            }
        });

        this.host.eventBus.on(Events.Place.FileSelected, (fileData) => {
            this.host.selectedFile = fileData;
            this.host.selectedImage = null;

            if (this.host.world) {
                this.host.showFileGhost();
            }
        });

        this.host.eventBus.on(Events.Place.FileCanceled, () => {
            this.host.selectedFile = null;
            this.host.hideGhost();
            this.host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
        });

        this.host.eventBus.on(Events.Place.ImageSelected, (imageData) => {
            this.host.selectedImage = imageData;
            this.host.selectedFile = null;
            this.host.showImageGhost();
        });

        this.host.eventBus.on(Events.Place.ImageCanceled, () => {
            this.host.selectedImage = null;
            this.host.hideGhost();
            this.host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
        });
    }
}
