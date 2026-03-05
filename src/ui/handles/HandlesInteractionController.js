import { Events } from '../../core/events/Events.js';

export class HandlesInteractionController {
    constructor(host) {
        this.host = host;
    }

    onHandleDown(e, box) {
        e.preventDefault();
        e.stopPropagation();
        const dir = e.currentTarget.dataset.dir;
        const id = e.currentTarget.dataset.id;
        const isGroup = id === '__group__';
        const world = this.host.core.pixi.worldLayer || this.host.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const tx = world?.x || 0;
        const ty = world?.y || 0;
        const rendererRes = (this.host.core.pixi.app.renderer?.resolution) || 1;
        const containerRect = this.host.container.getBoundingClientRect();
        const view = this.host.core.pixi.app.view;
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;

        const startCSS = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
        };
        const startScreen = {
            x: (startCSS.left - offsetLeft),
            y: (startCSS.top - offsetTop),
            w: startCSS.width,
            h: startCSS.height,
        };
        const startWorld = {
            x: ((startScreen.x * rendererRes) - tx) / s,
            y: ((startScreen.y * rendererRes) - ty) / s,
            width: (startScreen.w * rendererRes) / s,
            height: (startScreen.h * rendererRes) / s,
        };

        let objects = [id];
        if (isGroup) {
            const req = { selection: [] };
            this.host.eventBus.emit(Events.Tool.GetSelection, req);
            objects = req.selection || [];
            this.host.eventBus.emit(Events.Tool.GroupResizeStart, { objects, startBounds: { ...startWorld } });
        } else {
            this.host.eventBus.emit(Events.Tool.ResizeStart, { object: id, handle: dir });
        }

        const startMouse = { x: e.clientX, y: e.clientY };
        let isTextTarget = false;
        let isNoteTarget = false;
        {
            const req = { objectId: id, pixiObject: null };
            this.host.eventBus.emit(Events.Tool.GetObjectPixi, req);
            const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
            isTextTarget = (mbType === 'text' || mbType === 'simple-text');
            isNoteTarget = (mbType === 'note');
        }

        const onMove = (ev) => {
            const dx = ev.clientX - startMouse.x;
            const dy = ev.clientY - startMouse.y;
            let newLeft = startCSS.left;
            let newTop = startCSS.top;
            let newW = startCSS.width;
            let newH = startCSS.height;

            if (dir.includes('e')) newW = Math.max(1, startCSS.width + dx);
            if (dir.includes('s')) newH = Math.max(1, startCSS.height + dy);
            if (dir.includes('w')) {
                newW = Math.max(1, startCSS.width - dx);
                newLeft = startCSS.left + dx;
            }
            if (dir.includes('n')) {
                newH = Math.max(1, startCSS.height - dy);
                newTop = startCSS.top + dy;
            }

            if (isNoteTarget) {
                const sNote = Math.max(newW, newH);
                newW = sNote;
                newH = sNote;
                if (dir.includes('w')) newLeft = startCSS.left + (startCSS.width - sNote);
                if (dir.includes('n')) newTop = startCSS.top + (startCSS.height - sNote);
            }

            if (isTextTarget) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el && typeof window.getComputedStyle === 'function') {
                        const cs = window.getComputedStyle(el);
                        const meas = document.createElement('span');
                        meas.style.position = 'absolute';
                        meas.style.visibility = 'hidden';
                        meas.style.whiteSpace = 'pre';
                        meas.style.fontFamily = cs.fontFamily;
                        meas.style.fontSize = cs.fontSize;
                        meas.style.fontWeight = cs.fontWeight;
                        meas.style.fontStyle = cs.fontStyle;
                        meas.style.letterSpacing = cs.letterSpacing || 'normal';
                        meas.textContent = 'WWW';
                        document.body.appendChild(meas);
                        const minWidthPx = Math.max(1, Math.ceil(meas.getBoundingClientRect().width));
                        meas.remove();
                        if (newW < minWidthPx) {
                            if (dir.includes('w')) {
                                newLeft = startCSS.left + (startCSS.width - minWidthPx);
                            }
                            newW = minWidthPx;
                        }
                    }
                } catch (_) {}
            }

            if (isTextTarget) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el) {
                        let minWidthPx = 0;
                        try {
                            const cs = window.getComputedStyle(el);
                            const meas = document.createElement('span');
                            meas.style.position = 'absolute';
                            meas.style.visibility = 'hidden';
                            meas.style.whiteSpace = 'pre';
                            meas.style.fontFamily = cs.fontFamily;
                            meas.style.fontSize = cs.fontSize;
                            meas.style.fontWeight = cs.fontWeight;
                            meas.style.fontStyle = cs.fontStyle;
                            meas.style.letterSpacing = cs.letterSpacing || 'normal';
                            meas.textContent = 'WWW';
                            document.body.appendChild(meas);
                            minWidthPx = Math.max(1, Math.ceil(meas.getBoundingClientRect().width));
                            meas.remove();
                        } catch (_) {}

                        if (minWidthPx > 0 && newW < minWidthPx) {
                            if (dir.includes('w')) {
                                newLeft = startCSS.left + (startCSS.width - minWidthPx);
                            }
                            newW = minWidthPx;
                        }
                        el.style.width = `${Math.max(1, Math.round(newW))}px`;
                        el.style.height = 'auto';
                        const measured = Math.max(1, Math.round(el.scrollHeight));
                        newH = measured;
                    }
                } catch (_) {}
            }

            box.style.left = `${Math.round(newLeft)}px`;
            box.style.top = `${Math.round(newTop)}px`;
            box.style.width = `${Math.round(newW)}px`;
            box.style.height = `${Math.round(newH)}px`;
            this.host._repositionBoxChildren(box);

            const screenX = (newLeft - offsetLeft);
            const screenY = (newTop - offsetTop);
            const screenW = newW;
            const screenH = newH;
            const worldX = ((screenX * rendererRes) - tx) / s;
            const worldY = ((screenY * rendererRes) - ty) / s;
            const worldW = (screenW * rendererRes) / s;
            const worldH = (screenH * rendererRes) / s;

            if (isGroup) {
                this.host.eventBus.emit(Events.Tool.GroupResizeUpdate, {
                    objects,
                    startBounds: { ...startWorld },
                    newBounds: { x: worldX, y: worldY, width: worldW, height: worldH },
                });
            } else {
                let isFrameTarget = false;
                {
                    const req = { objectId: id, pixiObject: null };
                    this.host.eventBus.emit(Events.Tool.GetObjectPixi, req);
                    const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
                    isFrameTarget = mbType === 'frame';
                }
                const isLeftOrTop = dir.includes('w') || dir.includes('n');
                const resizeData = {
                    object: id,
                    size: { width: worldW, height: worldH },
                    position: isFrameTarget ? null : (isLeftOrTop ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y }),
                };
                this.host.eventBus.emit(Events.Tool.ResizeUpdate, resizeData);
            }
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const endCSS = {
                left: parseFloat(box.style.left),
                top: parseFloat(box.style.top),
                width: parseFloat(box.style.width),
                height: parseFloat(box.style.height),
            };
            const screenX = (endCSS.left - offsetLeft);
            const screenY = (endCSS.top - offsetTop);
            const screenW = endCSS.width;
            const screenH = endCSS.height;
            const worldX = ((screenX * rendererRes) - tx) / s;
            const worldY = ((screenY * rendererRes) - ty) / s;
            const worldW = (screenW * rendererRes) / s;
            const worldH = (screenH * rendererRes) / s;

            if (isGroup) {
                this.host.eventBus.emit(Events.Tool.GroupResizeEnd, { objects });
            } else {
                const isEdgeLeftOrTop = dir.includes('w') || dir.includes('n');
                let isFrameTarget = false;
                {
                    const req = { objectId: id, pixiObject: null };
                    this.host.eventBus.emit(Events.Tool.GetObjectPixi, req);
                    const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
                    isFrameTarget = mbType === 'frame';
                }
                const resizeEndData = {
                    object: id,
                    oldSize: { width: startWorld.width, height: startWorld.height },
                    newSize: { width: worldW, height: worldH },
                    oldPosition: { x: startWorld.x, y: startWorld.y },
                    newPosition: isFrameTarget ? null : (isEdgeLeftOrTop ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y }),
                };
                this.host.eventBus.emit(Events.Tool.ResizeEnd, resizeEndData);
                try {
                    const req2 = { objectId: id, pixiObject: null };
                    this.host.eventBus.emit(Events.Tool.GetObjectPixi, req2);
                    const mbType2 = req2.pixiObject && req2.pixiObject._mb && req2.pixiObject._mb.type;
                    if (mbType2 === 'text' || mbType2 === 'simple-text') {
                        const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                        const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                        if (el) {
                            el.style.width = `${Math.max(1, Math.round(endCSS.width))}px`;
                            el.style.height = 'auto';
                            const measured = Math.max(1, Math.round(el.scrollHeight));
                            const worldH2 = (measured * rendererRes) / s;
                            const fixData = {
                                object: id,
                                size: { width: worldW, height: worldH2 },
                                position: isFrameTarget ? null : (isEdgeLeftOrTop ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y }),
                            };
                            this.host.eventBus.emit(Events.Tool.ResizeUpdate, fixData);
                        }
                    }
                } catch (_) {}
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    onEdgeResizeDown(e) {
        e.preventDefault();
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const isGroup = id === '__group__';
        const edge = e.currentTarget.dataset.edge;
        const world = this.host.core.pixi.worldLayer || this.host.core.pixi.app.stage;
        const s = world?.scale?.x || 1;
        const tx = world?.x || 0;
        const ty = world?.y || 0;
        const rendererRes = (this.host.core.pixi.app.renderer?.resolution) || 1;
        const containerRect = this.host.container.getBoundingClientRect();
        const view = this.host.core.pixi.app.view;
        const viewRect = view.getBoundingClientRect();
        const offsetLeft = viewRect.left - containerRect.left;
        const offsetTop = viewRect.top - containerRect.top;

        const box = e.currentTarget.parentElement;
        const startCSS = {
            left: parseFloat(box.style.left),
            top: parseFloat(box.style.top),
            width: parseFloat(box.style.width),
            height: parseFloat(box.style.height),
        };
        const startScreen = {
            x: (startCSS.left - offsetLeft),
            y: (startCSS.top - offsetTop),
            w: startCSS.width,
            h: startCSS.height,
        };
        const startWorld = {
            x: ((startScreen.x * rendererRes) - tx) / s,
            y: ((startScreen.y * rendererRes) - ty) / s,
            width: (startScreen.w * rendererRes) / s,
            height: (startScreen.h * rendererRes) / s,
        };

        let objects = [id];
        if (isGroup) {
            const req = { selection: [] };
            this.host.eventBus.emit(Events.Tool.GetSelection, req);
            objects = req.selection || [];
            this.host.eventBus.emit(Events.Tool.GroupResizeStart, { objects, startBounds: { ...startWorld } });
        } else {
            this.host.eventBus.emit(Events.Tool.ResizeStart, { object: id, handle: edge === 'top' ? 'n' : edge === 'bottom' ? 's' : edge === 'left' ? 'w' : 'e' });
        }

        const startMouse = { x: e.clientX, y: e.clientY };
        let isTextTarget = false;
        let isNoteTarget = false;
        {
            const req = { objectId: id, pixiObject: null };
            this.host.eventBus.emit(Events.Tool.GetObjectPixi, req);
            const mbType = req.pixiObject && req.pixiObject._mb && req.pixiObject._mb.type;
            isTextTarget = (mbType === 'text' || mbType === 'simple-text');
            isNoteTarget = (mbType === 'note');
        }

        const onMove = (ev) => {
            const dxCSS = ev.clientX - startMouse.x;
            const dyCSS = ev.clientY - startMouse.y;
            let newLeft = startCSS.left;
            let newTop = startCSS.top;
            let newW = startCSS.width;
            let newH = startCSS.height;
            if (edge === 'right') newW = Math.max(1, startCSS.width + dxCSS);
            if (edge === 'bottom') newH = Math.max(1, startCSS.height + dyCSS);
            if (edge === 'left') {
                newW = Math.max(1, startCSS.width - dxCSS);
                newLeft = startCSS.left + dxCSS;
            }
            if (edge === 'top') {
                newH = Math.max(1, startCSS.height - dyCSS);
                newTop = startCSS.top + dyCSS;
            }

            if (isNoteTarget) {
                const sNote = Math.max(newW, newH);
                switch (edge) {
                    case 'right':
                        newW = sNote;
                        newH = sNote;
                        newTop = startCSS.top + Math.round((startCSS.height - sNote) / 2);
                        break;
                    case 'left':
                        newW = sNote;
                        newH = sNote;
                        newLeft = startCSS.left + (startCSS.width - sNote);
                        newTop = startCSS.top + Math.round((startCSS.height - sNote) / 2);
                        break;
                    case 'bottom':
                        newW = sNote;
                        newH = sNote;
                        newLeft = startCSS.left + Math.round((startCSS.width - sNote) / 2);
                        break;
                    case 'top':
                        newW = sNote;
                        newH = sNote;
                        newTop = startCSS.top + (startCSS.height - sNote);
                        newLeft = startCSS.left + Math.round((startCSS.width - sNote) / 2);
                        break;
                }
            }

            if (isTextTarget) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el && typeof window.getComputedStyle === 'function') {
                        const cs = window.getComputedStyle(el);
                        const meas = document.createElement('span');
                        meas.style.position = 'absolute';
                        meas.style.visibility = 'hidden';
                        meas.style.whiteSpace = 'pre';
                        meas.style.fontFamily = cs.fontFamily;
                        meas.style.fontSize = cs.fontSize;
                        meas.style.fontWeight = cs.fontWeight;
                        meas.style.fontStyle = cs.fontStyle;
                        meas.style.letterSpacing = cs.letterSpacing || 'normal';
                        meas.textContent = 'WWW';
                        document.body.appendChild(meas);
                        const minWidthPx = Math.max(1, Math.ceil(meas.getBoundingClientRect().width));
                        meas.remove();
                        if (newW < minWidthPx) {
                            if (edge === 'left') {
                                newLeft = startCSS.left + (startCSS.width - minWidthPx);
                            }
                            newW = minWidthPx;
                        }
                    }
                } catch (_) {}
            }

            const widthChanged = (edge === 'left' || edge === 'right');
            if (isTextTarget && widthChanged) {
                try {
                    const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                    const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                    if (el) {
                        el.style.width = `${Math.max(1, Math.round(newW))}px`;
                        el.style.height = 'auto';
                        const measured = Math.max(1, Math.round(el.scrollHeight));
                        newH = measured;
                    }
                } catch (_) {}
            }

            box.style.left = `${newLeft}px`;
            box.style.top = `${newTop}px`;
            box.style.width = `${newW}px`;
            box.style.height = `${newH}px`;
            this.host._repositionBoxChildren(box);

            const screenX = (newLeft - offsetLeft);
            const screenY = (newTop - offsetTop);
            const screenW = newW;
            const screenH = newH;
            const worldX = ((screenX * rendererRes) - tx) / s;
            const worldY = ((screenY * rendererRes) - ty) / s;
            const worldW = (screenW * rendererRes) / s;
            const worldH = (screenH * rendererRes) / s;
            const edgePositionChanged = (newLeft !== startCSS.left) || (newTop !== startCSS.top);

            if (isGroup) {
                this.host.eventBus.emit(Events.Tool.GroupResizeUpdate, {
                    objects,
                    startBounds: { ...startWorld },
                    newBounds: { x: worldX, y: worldY, width: worldW, height: worldH },
                });
            } else {
                const edgeResizeData = {
                    object: id,
                    size: { width: worldW, height: worldH },
                    position: edgePositionChanged ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y },
                };
                this.host.eventBus.emit(Events.Tool.ResizeUpdate, edgeResizeData);
            }
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const endCSS = {
                left: parseFloat(box.style.left),
                top: parseFloat(box.style.top),
                width: parseFloat(box.style.width),
                height: parseFloat(box.style.height),
            };
            const screenX = (endCSS.left - offsetLeft);
            const screenY = (endCSS.top - offsetTop);
            const screenW = endCSS.width;
            const screenH = endCSS.height;
            const worldX = ((screenX * rendererRes) - tx) / s;
            const worldY = ((screenY * rendererRes) - ty) / s;
            const worldW = (screenW * rendererRes) / s;
            const worldH = (screenH * rendererRes) / s;

            if (isGroup) {
                this.host.eventBus.emit(Events.Tool.GroupResizeEnd, { objects });
            } else {
                const edgeFinalPositionChanged = (endCSS.left !== startCSS.left) || (endCSS.top !== startCSS.top);
                let finalWorldH = worldH;
                if (isTextTarget && (edge === 'left' || edge === 'right')) {
                    try {
                        const textLayer = (typeof window !== 'undefined') ? window.moodboardHtmlTextLayer : null;
                        const el = textLayer && textLayer.idToEl ? textLayer.idToEl.get && textLayer.idToEl.get(id) : null;
                        if (el) {
                            el.style.width = `${Math.max(1, Math.round(endCSS.width))}px`;
                            el.style.height = 'auto';
                            const measured = Math.max(1, Math.round(el.scrollHeight));
                            finalWorldH = (measured * rendererRes) / s;
                        }
                    } catch (_) {}
                }

                const edgeResizeEndData = {
                    object: id,
                    oldSize: { width: startWorld.width, height: startWorld.height },
                    newSize: { width: worldW, height: finalWorldH },
                    oldPosition: { x: startWorld.x, y: startWorld.y },
                    newPosition: edgeFinalPositionChanged ? { x: worldX, y: worldY } : { x: startWorld.x, y: startWorld.y },
                };
                this.host.eventBus.emit(Events.Tool.ResizeEnd, edgeResizeEndData);
            }
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    onRotateHandleDown(e, box) {
        e.preventDefault();
        e.stopPropagation();

        const handleElement = e.currentTarget;
        const id = handleElement?.dataset?.id;
        if (!id) return;
        const isGroup = id === '__group__';

        const boxLeft = parseFloat(box.style.left);
        const boxTop = parseFloat(box.style.top);
        const boxWidth = parseFloat(box.style.width);
        const boxHeight = parseFloat(box.style.height);
        const centerX = boxLeft + boxWidth / 2;
        const centerY = boxTop + boxHeight / 2;
        const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

        let startRotation = 0;
        if (!isGroup) {
            const rotationData = { objectId: id, rotation: 0 };
            this.host.eventBus.emit(Events.Tool.GetObjectRotation, rotationData);
            startRotation = (rotationData.rotation || 0) * Math.PI / 180;
        }

        if (handleElement) {
            handleElement.style.cursor = 'grabbing';
        }

        if (isGroup) {
            const req = { selection: [] };
            this.host.eventBus.emit(Events.Tool.GetSelection, req);
            const objects = req.selection || [];
            let centerWorldX = centerX;
            let centerWorldY = centerY;
            try {
                const centerWorld = this.host.positioningService.cssPointToWorld(centerX, centerY);
                centerWorldX = centerWorld.x;
                centerWorldY = centerWorld.y;
            } catch (_) {}
            this.host.eventBus.emit(Events.Tool.GroupRotateStart, {
                objects,
                center: { x: centerWorldX, y: centerWorldY },
            });
        }

        const onRotateMove = (ev) => {
            const currentAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
            const deltaAngle = currentAngle - startAngle;
            const newRotation = startRotation + deltaAngle;

            if (isGroup) {
                const req = { selection: [] };
                this.host.eventBus.emit(Events.Tool.GetSelection, req);
                const objects = req.selection || [];
                this.host.eventBus.emit(Events.Tool.GroupRotateUpdate, {
                    objects,
                    angle: newRotation * 180 / Math.PI,
                });
            } else {
                this.host.eventBus.emit(Events.Tool.RotateUpdate, {
                    object: id,
                    angle: newRotation * 180 / Math.PI,
                });
            }
        };

        const onRotateUp = (ev) => {
            document.removeEventListener('mousemove', onRotateMove);
            document.removeEventListener('mouseup', onRotateUp);

            if (handleElement) {
                handleElement.style.cursor = 'grab';
            }

            const finalAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
            const finalDeltaAngle = finalAngle - startAngle;
            const finalRotation = startRotation + finalDeltaAngle;

            if (isGroup) {
                const req = { selection: [] };
                this.host.eventBus.emit(Events.Tool.GetSelection, req);
                const objects = req.selection || [];
                this.host.eventBus.emit(Events.Tool.GroupRotateEnd, { objects });
            } else {
                this.host.eventBus.emit(Events.Tool.RotateEnd, {
                    object: id,
                    oldAngle: startRotation * 180 / Math.PI,
                    newAngle: finalRotation * 180 / Math.PI,
                });
            }
        };

        document.addEventListener('mousemove', onRotateMove);
        document.addEventListener('mouseup', onRotateUp);
    }
}
