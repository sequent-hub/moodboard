import * as PIXI from 'pixi.js';
import { Events } from '../../../core/events/Events.js';

export class PlacementInputRouter {
    constructor(host) {
        this.host = host;
    }

    startFrameDrawMode() {
        this.host.cursor = 'crosshair';
        if (this.host.app && this.host.app.view) this.host.app.view.style.cursor = this.host.cursor;
    }

    onMouseMove(event) {
        const host = this.host;
        if ((host.selectedFile || host.selectedImage || host.pending) && host.ghostContainer) {
            if (host.app && host.app.view) {
                host.app.view._lastMouseX = event.x;
                host.app.view._lastMouseY = event.y;
            }
            const worldPoint = host._toWorld(event.offsetX, event.offsetY);
            host.updateGhostPosition(worldPoint.x, worldPoint.y);
        }
    }

    onFrameDrawMove(event) {
        const host = this.host;
        if (!host._frameDrawState || !host._frameDrawState.graphics) return;
        const p = host._toWorld(event.offsetX, event.offsetY);
        const x = Math.min(host._frameDrawState.startX, p.x);
        const y = Math.min(host._frameDrawState.startY, p.y);
        const w = Math.abs(p.x - host._frameDrawState.startX);
        const h = Math.abs(p.y - host._frameDrawState.startY);
        const g = host._frameDrawState.graphics;
        g.clear();
        const x0 = Math.round(x);
        const y0 = Math.round(y);
        const w0 = Math.max(1, Math.round(w));
        const h0 = Math.max(1, Math.round(h));
        g.lineStyle(1, 0x3B82F6, 1, 1);
        g.beginFill(0xFFFFFF, 0.6);
        g.drawRect(x0, y0, w0, h0);
        g.endFill();
    }

    onFrameDrawUp(event) {
        const host = this.host;
        const g = host._frameDrawState?.graphics;
        if (!host._frameDrawState || !g) return;
        const p = host._toWorld(event.offsetX, event.offsetY);
        const x = Math.min(host._frameDrawState.startX, p.x);
        const y = Math.min(host._frameDrawState.startY, p.y);
        const w = Math.abs(p.x - host._frameDrawState.startX);
        const h = Math.abs(p.y - host._frameDrawState.startY);
        if (g.parent) g.parent.removeChild(g);
        g.destroy();
        host._frameDrawState = null;
        if (w >= 2 && h >= 2) {
            host.payloadFactory.emitFrameDrawPlacement(x, y, w, h);
        }
        host.pending = null;
        host.hideGhost();
        if (host.app && host.app.view) {
            host.app.view.removeEventListener('mousemove', host._onFrameDrawMoveBound);
            host.app.view.style.cursor = '';
        }
        host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
    }

    onMouseDown(event) {
        const host = this.host;
        host.__baseOnMouseDown(event);

        if (host.selectedFile) {
            host.placeSelectedFile(event);
            return;
        }

        if (host.selectedImage) {
            host.placeSelectedImage(event);
            return;
        }

        if (!host.pending) return;
        if (host.pending.placeOnMouseUp) {
            const onUp = (ev) => {
                host.app.view.removeEventListener('mouseup', onUp);
                const worldPoint = host._toWorld(ev.x, ev.y);
                const position = {
                    x: Math.round(worldPoint.x - (host.pending.size?.width ?? 100) / 2),
                    y: Math.round(worldPoint.y - (host.pending.size?.height ?? 100) / 2)
                };
                const props = { ...(host.pending.properties || {}) };
                host.payloadFactory.emitGenericPlacement(host.pending.type, position, props);
                host.pending = null;
                host.hideGhost();
                host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
            };
            host.app.view.addEventListener('mouseup', onUp, { once: true });
            return;
        }
        if (host.pending.type === 'frame-draw') {
            const start = host._toWorld(event.x, event.y);
            host._frameDrawState = { startX: start.x, startY: start.y, graphics: null };
            if (host.world) {
                const g = new PIXI.Graphics();
                g.zIndex = 3000;
                host.world.addChild(g);
                host._frameDrawState.graphics = g;
            }
            host._onFrameDrawMoveBound = (ev) => host._onFrameDrawMove(ev);
            host._onFrameDrawUpBound = (ev) => host._onFrameDrawUp(ev);
            host.app.view.addEventListener('mousemove', host._onFrameDrawMoveBound);
            host.app.view.addEventListener('mouseup', host._onFrameDrawUpBound, { once: true });
            return;
        }

        const worldPoint = host._toWorld(event.x, event.y);
        let position = {
            x: Math.round(worldPoint.x - (host.pending.size?.width ?? 100) / 2),
            y: Math.round(worldPoint.y - (host.pending.size?.height ?? 100) / 2)
        };

        let props = host.pending.properties || {};
        const isTextWithEditing = host.pending.type === 'text' && props.editOnCreate;
        const isImage = host.pending.type === 'image';
        const isFile = host.pending.type === 'file';
        const presetSize = {
            width: (host.pending.size && host.pending.size.width) ? host.pending.size.width : (props.width || 200),
            height: (host.pending.size && host.pending.size.height) ? host.pending.size.height : (props.height || 150),
        };

        if (isTextWithEditing) {
            let worldForText = worldPoint;
            try {
                const app = host.app;
                const view = app?.view;
                const worldLayer = host.world || host._getWorldLayer();
                if (view && view.parentElement && worldLayer && worldLayer.toLocal) {
                    const containerRect = view.parentElement.getBoundingClientRect();
                    const viewRect = view.getBoundingClientRect();
                    const offsetLeft = viewRect.left - containerRect.left;
                    const offsetTop = viewRect.top - containerRect.top;
                    const screenX = event.x - offsetLeft;
                    const screenY = event.y - offsetTop;
                    const globalPoint = new PIXI.Point(screenX, screenY);
                    const local = worldLayer.toLocal(globalPoint);
                    worldForText = { x: local.x, y: local.y };
                }
                console.log('🧭 Text click', {
                    cursor: { x: event.x, y: event.y },
                    world: { x: Math.round(worldForText.x), y: Math.round(worldForText.y) }
                });
            } catch (_) {}
            position = {
                x: Math.round(worldForText.x),
                y: Math.round(worldForText.y)
            };
            const handleObjectCreated = (objectData) => {
                if (objectData.type === 'text') {
                    host.eventBus.off('object:created', handleObjectCreated);
                    host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                    setTimeout(() => {
                        host.eventBus.emit(Events.Tool.ObjectEdit, {
                            object: {
                                id: objectData.id,
                                type: 'text',
                                position: objectData.position,
                                properties: { fontSize: props.fontSize || 18, content: '' }
                            },
                            create: true
                        });
                    }, 50);
                }
            };

            host.eventBus.on('object:created', handleObjectCreated);
            host.payloadFactory.emitTextPlacement(position, props);
        } else if (host.pending.type === 'frame') {
            const width = props.width || presetSize.width || 200;
            const height = props.height || presetSize.height || 300;
            position = {
                x: Math.round(worldPoint.x - width / 2),
                y: Math.round(worldPoint.y - height / 2)
            };
            host.payloadFactory.emitFramePlacement(position, props, width, height);
        } else if (isImage && props.selectFileOnPlace) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
                try {
                    const file = input.files && input.files[0];
                    if (!file) return;
                    try {
                        const uploadResult = await host.core.imageUploadService.uploadImage(file, file.name);
                        const natW = uploadResult.width || 1;
                        const natH = uploadResult.height || 1;
                        const targetW = 300;
                        const targetH = Math.max(1, Math.round(natH * (targetW / natW)));
                        host.payloadFactory.emitImageUploaded(position, uploadResult, targetW, targetH);
                    } catch (error) {
                        console.error('Ошибка загрузки изображения:', error);
                        alert('Ошибка загрузки изображения: ' + error.message);
                    }
                } finally {
                    input.remove();
                }
            }, { once: true });
            input.click();
        } else if (isFile && props.selectFileOnPlace) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '*/*';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', async () => {
                try {
                    const file = input.files && input.files[0];
                    if (!file) return;

                    try {
                        const uploadResult = await host.core.fileUploadService.uploadFile(file, file.name);
                        host.payloadFactory.emitFileUploaded(position, uploadResult, props.width || 120, props.height || 140);
                        host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                    } catch (uploadError) {
                        console.error('Ошибка загрузки файла на сервер:', uploadError);
                        const fileName = file.name;
                        const fileSize = file.size;
                        const mimeType = file.type;

                        host.payloadFactory.emitFileFallback(position, fileName, fileSize, mimeType, props.width || 120, props.height || 140);
                        host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
                        alert('Ошибка загрузки файла на сервер. Файл добавлен локально.');
                    }
                } catch (error) {
                    console.error('Ошибка при выборе файла:', error);
                    alert('Ошибка при выборе файла: ' + error.message);
                } finally {
                    input.remove();
                }
            }, { once: true });
            input.click();
        } else {
            if (host.pending.type === 'note') {
                const base = 250;
                const noteW = (typeof props.width === 'number') ? props.width : base;
                const noteH = (typeof props.height === 'number') ? props.height : base;
                const side = Math.max(noteW, noteH);
                props = { ...props, width: side, height: side };
                position = {
                    x: Math.round(worldPoint.x - side / 2),
                    y: Math.round(worldPoint.y - side / 2)
                };
            }
            host.payloadFactory.emitGenericPlacement(host.pending.type, position, props);
        }

        host.pending = null;
        host.hideGhost();
        if (!isTextWithEditing && !(isFile && props.selectFileOnPlace)) {
            host.eventBus.emit(Events.Keyboard.ToolSelect, { tool: 'select' });
        }
    }
}
