import { Events } from '../../core/events/Events.js';
import { ToolManagerGuards } from './ToolManagerGuards.js';

function createPointerEvent(manager, event, extras = {}) {
    const rect = manager.container.getBoundingClientRect();

    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        originalEvent: event,
        ...extras
    };
}

function rememberCursorPosition(manager, event) {
    manager.lastMousePos = { x: event.x, y: event.y };
    manager.eventBus.emit(Events.UI.CursorMove, { x: event.x, y: event.y });
}

export class ToolEventRouter {
    static handleMouseDown(manager, event) {
        if (!manager.activeTool) return;
        manager.isMouseDown = true;

        if (manager.spacePressed && event.button === 0) {
            this.handleAuxPanStart(manager, event);
            return;
        }
        if (event.button === 1) {
            this.handleAuxPanStart(manager, event);
            return;
        }

        const toolEvent = createPointerEvent(manager, event, {
            button: event.button,
            target: event.target
        });

        rememberCursorPosition(manager, toolEvent);
        manager.activeTool.onMouseDown(toolEvent);
    }

    static handleAuxPanStart(manager, event) {
        if (!ToolManagerGuards.isAuxPanStart(manager, event)) return;

        if (manager.hasActiveTool('pan')) {
            manager.previousTool = manager.activeTool?.name || null;
            manager.activateTemporaryTool('pan');

            const toolEvent = createPointerEvent(manager, event, {
                button: 0,
                target: event.target
            });

            rememberCursorPosition(manager, toolEvent);
            manager.activeTool.onMouseDown(toolEvent);
        }
    }

    static handleAuxPanEnd(manager, event) {
        if (ToolManagerGuards.isTemporaryPanActive(manager)) {
            const toolEvent = createPointerEvent(manager, event, {
                button: 0,
                target: event.target
            });

            rememberCursorPosition(manager, toolEvent);
            manager.activeTool.onMouseUp(toolEvent);
            manager.returnToPreviousTool();
        }
    }

    static handleMouseMove(manager, event) {
        if (!manager.activeTool) return;

        const toolEvent = createPointerEvent(manager, event, {
            target: event.target
        });

        rememberCursorPosition(manager, toolEvent);

        if (ToolManagerGuards.isTemporaryPanActive(manager) && manager.activeTool?.name === 'pan') {
            manager.activeTool.onMouseMove(toolEvent);
            manager.syncActiveToolCursor();
            return;
        }

        manager.activeTool.onMouseMove(toolEvent);
        manager.syncActiveToolCursor();
    }

    static handleMouseUp(manager, event) {
        if (!manager.activeTool) return;
        manager.isMouseDown = false;

        const toolEvent = createPointerEvent(manager, event, {
            button: event.button,
            target: event.target
        });

        rememberCursorPosition(manager, toolEvent);
        if (ToolManagerGuards.isTemporaryPanActive(manager)) {
            manager.handleAuxPanEnd(event);
            return;
        }

        manager.activeTool.onMouseUp(toolEvent);
        manager.syncActiveToolCursor();
    }

    static handleDoubleClick(manager, event) {
        if (!manager.activeTool) return;

        const toolEvent = createPointerEvent(manager, event, {
            target: event.target
        });

        rememberCursorPosition(manager, toolEvent);

        console.log('🔧 ToolManager: Double click event, active tool:', manager.activeTool.constructor.name);
        manager.activeTool.onDoubleClick(toolEvent);
    }

    static handleMouseWheel(manager, event) {
        if (!manager.activeTool) return;

        const toolEvent = createPointerEvent(manager, event, {
            delta: event.deltaY,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey
        });

        rememberCursorPosition(manager, toolEvent);

        manager.eventBus.emit(Events.Tool.WheelZoom, { x: toolEvent.x, y: toolEvent.y, delta: event.deltaY });
        event.preventDefault();

        if (event.ctrlKey) {
            event.preventDefault();
        }
    }

    static async handleDrop(manager, event) {
        event.preventDefault();

        const rect = manager.container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        manager.lastMousePos = { x, y };
        manager.eventBus.emit(Events.UI.CursorMove, { x, y });

        const dt = event.dataTransfer;
        if (!dt) return;

        const toWorldPosition = (screenX, screenY) => {
            const world = manager.core?.pixi?.worldLayer || manager.core?.pixi?.app?.stage;
            const scale = world?.scale?.x || 1;
            if (!world) {
                return { x: Math.round(screenX), y: Math.round(screenY) };
            }
            return {
                x: Math.round((screenX - (world.x || 0)) / scale),
                y: Math.round((screenY - (world.y || 0)) / scale)
            };
        };
        const getFanOffset = (offsetIndex) => {
            if (offsetIndex <= 0) return { dx: 0, dy: 0 };
            const step = 25;
            const directions = [
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 1 },
                { x: -1, y: 1 },
                { x: -1, y: 0 },
                { x: -1, y: -1 },
                { x: 0, y: -1 },
                { x: 1, y: -1 }
            ];
            const index = offsetIndex - 1;
            const direction = directions[index % directions.length];
            const ring = Math.floor(index / directions.length) + 1;
            return { dx: direction.x * step * ring, dy: direction.y * step * ring };
        };

        const emitAt = (src, name, imageId = null, offsetIndex = 0) => {
            const offset = 25 * offsetIndex;
            manager.eventBus.emit(Events.UI.PasteImageAt, {
                x: x + offset,
                y: y + offset,
                src,
                name,
                imageId
            });
        };

        const files = dt.files ? Array.from(dt.files) : [];
        const imageFiles = files.filter((file) => file.type && file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            let index = 0;
            for (const file of imageFiles) {
                try {
                    if (manager.core && manager.core.imageUploadService) {
                        const uploadResult = await manager.core.imageUploadService.uploadImage(file, file.name || 'image');
                        emitAt(uploadResult.url, uploadResult.name, uploadResult.imageId || uploadResult.id, index++);
                    } else {
                        await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                emitAt(reader.result, file.name || 'image', null, index++);
                                resolve();
                            };
                            reader.readAsDataURL(file);
                        });
                    }
                } catch (error) {
                    console.warn('Ошибка загрузки изображения через drag-and-drop:', error);
                    await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            emitAt(reader.result, file.name || 'image', null, index++);
                            resolve();
                        };
                        reader.readAsDataURL(file);
                    });
                }
            }
            return;
        }

        const nonImageFiles = files.filter((file) => !file.type || !file.type.startsWith('image/'));
        if (nonImageFiles.length > 0) {
            let index = 0;
            for (const file of nonImageFiles) {
                const fanOffset = getFanOffset(index++);
                const worldPoint = toWorldPosition(x + fanOffset.dx, y + fanOffset.dy);
                const fallbackProps = {
                    fileName: file.name || 'file',
                    fileSize: file.size || 0,
                    mimeType: file.type || 'application/octet-stream',
                    formattedSize: null,
                    url: null,
                    width: 120,
                    height: 140
                };
                const position = {
                    x: Math.round(worldPoint.x - fallbackProps.width / 2),
                    y: Math.round(worldPoint.y - fallbackProps.height / 2)
                };
                try {
                    if (manager.core && manager.core.fileUploadService) {
                        const uploadResult = await manager.core.fileUploadService.uploadFile(file, file.name || 'file');
                        const objectWidth = fallbackProps.width;
                        const objectHeight = fallbackProps.height;
                        const centeredPosition = {
                            x: Math.round(worldPoint.x - objectWidth / 2),
                            y: Math.round(worldPoint.y - objectHeight / 2)
                        };
                        manager.eventBus.emit(Events.UI.ToolbarAction, {
                            type: 'file',
                            id: 'file',
                            position: centeredPosition,
                            properties: {
                                fileName: uploadResult.name,
                                fileSize: uploadResult.size,
                                mimeType: uploadResult.mimeType,
                                formattedSize: uploadResult.formattedSize,
                                url: uploadResult.url,
                                width: 120,
                                height: 140
                            },
                            fileId: uploadResult.fileId || uploadResult.id || null
                        });
                    } else {
                        manager.eventBus.emit(Events.UI.ToolbarAction, {
                            type: 'file',
                            id: 'file',
                            position,
                            properties: fallbackProps
                        });
                    }
                } catch (error) {
                    console.warn('Ошибка загрузки файла через drag-and-drop:', error);
                    manager.eventBus.emit(Events.UI.ToolbarAction, {
                        type: 'file',
                        id: 'file',
                        position,
                        properties: fallbackProps
                    });
                }
            }
            return;
        }

        const html = dt.getData('text/html');
        if (html && html.includes('<img')) {
            const match = html.match(/<img[^>]*src\s*=\s*"([^"]+)"/i);
            if (match && match[1]) {
                const url = match[1];
                if (/^data:image\//i.test(url)) {
                    emitAt(url, 'clipboard-image.png');
                    return;
                }
                if (/^https?:\/\//i.test(url)) {
                    try {
                        const response = await fetch(url, { mode: 'cors' });
                        const blob = await response.blob();
                        const dataUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        emitAt(dataUrl, url.split('/').pop() || 'image');
                    } catch (_) {
                        emitAt(url, url.split('/').pop() || 'image');
                    }
                    return;
                }
            }
        }

        const uriList = dt.getData('text/uri-list') || '';
        if (uriList) {
            const lines = uriList.split('\n').filter((line) => !!line && !line.startsWith('#'));
            const urls = lines.filter((line) => /^https?:\/\//i.test(line));
            let index = 0;
            for (const url of urls) {
                const isImage = /(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
                if (!isImage) continue;
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    const blob = await response.blob();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    emitAt(dataUrl, url.split('/').pop() || 'image', index++);
                } catch (_) {
                    emitAt(url, url.split('/').pop() || 'image', index++);
                }
            }
            if (index > 0) return;
        }

        const text = dt.getData('text/plain') || '';
        if (text) {
            const trimmed = text.trim();
            const isDataUrl = /^data:image\//i.test(trimmed);
            const isHttpUrl = /^https?:\/\//i.test(trimmed);
            const looksLikeImage = /(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmed);
            if (isDataUrl) {
                emitAt(trimmed, 'clipboard-image.png');
                return;
            }
            if (isHttpUrl && looksLikeImage) {
                try {
                    const response = await fetch(trimmed, { mode: 'cors' });
                    const blob = await response.blob();
                    const dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    emitAt(dataUrl, trimmed.split('/').pop() || 'image');
                } catch (_) {
                    emitAt(trimmed, trimmed.split('/').pop() || 'image');
                }
            }
        }
    }

    static handleKeyDown(manager, event) {
        this.handleHotkeys(manager, event);

        if (!manager.activeTool) return;

        const toolEvent = {
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            originalEvent: event
        };

        manager.activeTool.onKeyDown(toolEvent);

        if (event.key === ' ' && !event.repeat) {
            manager.spacePressed = true;
        }
    }

    static handleKeyUp(manager, event) {
        if (!manager.activeTool) return;

        const toolEvent = {
            key: event.key,
            code: event.code,
            originalEvent: event
        };

        manager.activeTool.onKeyUp(toolEvent);

        if (event.key === ' ') {
            manager.spacePressed = false;
            if (ToolManagerGuards.isTemporaryPanActive(manager)) {
                if (manager.activeTool?.name === 'pan' && manager.isMouseDown) {
                    manager.activeTool.onMouseUp({ x: 0, y: 0, button: 0, target: manager.container, originalEvent: event });
                }
                manager.returnToPreviousTool();
            }
        }
    }

    static handleHotkeys(manager, event) {
        if (ToolManagerGuards.shouldIgnoreHotkeys(event)) {
            return;
        }

        const tools = manager.registry ? manager.registry.values() : manager.tools.values();
        for (const tool of tools) {
            if (tool.hotkey === event.key.toLowerCase()) {
                manager.activateTool(tool.name);
                event.preventDefault();
                break;
            }
        }

        switch (event.key) {
            case 'Escape':
                manager.activateDefaultTool();
                event.preventDefault();
                break;
        }
    }
}
