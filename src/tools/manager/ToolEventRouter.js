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

function nowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function isDropDebugEnabled() {
    try {
        if (typeof window === 'undefined') return false;
        if (window.__MB_DND_DEBUG__ === true) return true;
        if (window.localStorage && typeof window.localStorage.getItem === 'function') {
            return window.localStorage.getItem('mb:dnd:debug') === '1';
        }
    } catch (_) {}
    return false;
}

function createDropDiagnostics() {
    return {
        enabled: isDropDebugEnabled(),
        dropId: `drop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: nowMs()
    };
}

function logDropDebug(diagnostics, stage, payload = {}) {
    if (!diagnostics?.enabled) return;
    try {
        const elapsedMs = Math.round(nowMs() - diagnostics.startedAt);
        console.debug('[moodboard:dnd]', {
            dropId: diagnostics.dropId,
            stage,
            elapsedMs,
            ...payload
        });
    } catch (_) {}
}

const DROP_LIMITS = {
    maxFilesPerDrop: 50,
    maxFileSizeBytes: 50 * 1024 * 1024
};

function showDropWarning(manager, message, diagnostics, extra = {}) {
    logDropDebug(diagnostics, 'drop_warning', { message, ...extra });
    try {
        const ws = (typeof window !== 'undefined' && window.moodboard && window.moodboard.workspaceManager)
            ? window.moodboard.workspaceManager
            : null;
        if (ws && typeof ws.showNotification === 'function') {
            ws.showNotification(message);
        }
    } catch (_) {}
}

async function mapWithConcurrency(items, limit, iterator) {
    const safeLimit = Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 1);
    const results = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            if (currentIndex >= items.length) return;
            results[currentIndex] = await iterator(items[currentIndex], currentIndex);
        }
    };

    const workers = [];
    const workersCount = Math.min(safeLimit, items.length);
    for (let i = 0; i < workersCount; i += 1) {
        workers.push(worker());
    }
    await Promise.all(workers);
    return results;
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
        const diagnostics = createDropDiagnostics();
        manager._dropSessionSeq = (manager._dropSessionSeq || 0) + 1;
        const dropSession = manager._dropSessionSeq;
        const isCurrentDrop = () => manager._dropSessionSeq === dropSession;

        const rect = manager.container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        manager.lastMousePos = { x, y };
        manager.eventBus.emit(Events.UI.CursorMove, { x, y });

        const dt = event.dataTransfer;
        if (!dt) {
            logDropDebug(diagnostics, 'drop_no_data_transfer');
            return;
        }
        logDropDebug(diagnostics, 'drop_received', {
            localX: Math.round(x),
            localY: Math.round(y),
            filesCount: dt.files ? dt.files.length : 0
        });

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

        const emitAt = (src, name, offsetIndex = 0) => {
            if (!isCurrentDrop()) {
                logDropDebug(diagnostics, 'emit_skipped_stale_drop', { route: 'image', offsetIndex });
                return;
            }
            const offset = 25 * offsetIndex;
            manager.eventBus.emit(Events.UI.PasteImageAt, {
                x: x + offset,
                y: y + offset,
                src,
                name
            });
        };

        const files = dt.files ? Array.from(dt.files) : [];
        let limitedFiles = files;
        if (limitedFiles.length > DROP_LIMITS.maxFilesPerDrop) {
            showDropWarning(
                manager,
                `Обработаны первые ${DROP_LIMITS.maxFilesPerDrop} файлов из ${limitedFiles.length}`,
                diagnostics,
                { filesCount: limitedFiles.length, maxFilesPerDrop: DROP_LIMITS.maxFilesPerDrop }
            );
            limitedFiles = limitedFiles.slice(0, DROP_LIMITS.maxFilesPerDrop);
        }
        const oversized = limitedFiles.filter((file) => (file?.size || 0) > DROP_LIMITS.maxFileSizeBytes);
        if (oversized.length > 0) {
            showDropWarning(
                manager,
                `Пропущено ${oversized.length} файлов: размер каждого должен быть не более 50 МБ`,
                diagnostics,
                { oversizedCount: oversized.length, maxFileSizeBytes: DROP_LIMITS.maxFileSizeBytes }
            );
            limitedFiles = limitedFiles.filter((file) => (file?.size || 0) <= DROP_LIMITS.maxFileSizeBytes);
        }

        const imageFiles = limitedFiles.filter((file) => file.type && file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
            logDropDebug(diagnostics, 'route_image_files', { count: imageFiles.length });
            const imagePlacements = await mapWithConcurrency(imageFiles, 2, async (file, index) => {
                logDropDebug(diagnostics, 'image_upload_start', {
                    fileName: file.name || 'image',
                    fileSize: file.size || 0,
                    mimeType: file.type || null
                });
                try {
                    if (manager.core && manager.core.imageUploadService) {
                        const uploadResult = await manager.core.imageUploadService.uploadImage(file, file.name || 'image');
                        if (!isCurrentDrop()) {
                            logDropDebug(diagnostics, 'image_upload_stale_drop_ignored', {
                                fileName: uploadResult?.name || file.name || 'image'
                            });
                            return null;
                        }
                        logDropDebug(diagnostics, 'image_upload_success', {
                            fileName: uploadResult?.name || file.name || 'image'
                        });
                        return {
                            src: uploadResult.url,
                            name: uploadResult.name,
                            index
                        };
                    } else {
                        showDropWarning(
                            manager,
                            `Не удалось добавить "${file.name || 'image'}": сервис загрузки изображений недоступен`,
                            diagnostics,
                            { fileName: file.name || 'image' }
                        );
                        return null;
                    }
                } catch (error) {
                    console.warn('Ошибка загрузки изображения через drag-and-drop:', error);
                    logDropDebug(diagnostics, 'image_upload_error', {
                        fileName: file.name || 'image',
                        message: error?.message || String(error)
                    });
                    showDropWarning(
                        manager,
                        `Не удалось загрузить "${file.name || 'image'}" на сервер. Изображение не добавлено.`,
                        diagnostics,
                        {
                            fileName: file.name || 'image',
                            message: error?.message || String(error)
                        }
                    );
                    return null;
                }
            });
            for (const placement of imagePlacements) {
                if (!placement) continue;
                emitAt(placement.src, placement.name, placement.index);
            }
            logDropDebug(diagnostics, 'drop_done', { route: 'image_files', itemsProcessed: imageFiles.length });
            return;
        }

        const nonImageFiles = limitedFiles.filter((file) => !file.type || !file.type.startsWith('image/'));
        if (nonImageFiles.length > 0) {
            logDropDebug(diagnostics, 'route_non_image_files', { count: nonImageFiles.length });
            const filePlacements = await mapWithConcurrency(nonImageFiles, 2, async (file, index) => {
                const fanOffset = getFanOffset(index);
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
                logDropDebug(diagnostics, 'file_prepare', {
                    fileName: fallbackProps.fileName,
                    worldX: worldPoint.x,
                    worldY: worldPoint.y,
                    placeX: position.x,
                    placeY: position.y
                });
                try {
                    if (manager.core && manager.core.fileUploadService) {
                        const uploadResult = await manager.core.fileUploadService.uploadFile(file, file.name || 'file');
                        if (!isCurrentDrop()) {
                            logDropDebug(diagnostics, 'file_upload_stale_drop_ignored', {
                                fileName: uploadResult?.name || fallbackProps.fileName
                            });
                            return null;
                        }
                        const objectWidth = fallbackProps.width;
                        const objectHeight = fallbackProps.height;
                        const centeredPosition = {
                            x: Math.round(worldPoint.x - objectWidth / 2),
                            y: Math.round(worldPoint.y - objectHeight / 2)
                        };
                        logDropDebug(diagnostics, 'file_upload_success', {
                            fileName: uploadResult?.name || fallbackProps.fileName,
                            fileId: uploadResult?.fileId || uploadResult?.id || null
                        });
                        return {
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
                        };
                    } else {
                        showDropWarning(
                            manager,
                            `Не удалось добавить "${fallbackProps.fileName}": сервис загрузки файлов недоступен`,
                            diagnostics,
                            { fileName: fallbackProps.fileName }
                        );
                        return null;
                    }
                } catch (error) {
                    console.warn('Ошибка загрузки файла через drag-and-drop:', error);
                    logDropDebug(diagnostics, 'file_upload_error', {
                        fileName: fallbackProps.fileName,
                        message: error?.message || String(error)
                    });
                    showDropWarning(
                        manager,
                        `Не удалось загрузить "${fallbackProps.fileName}" на сервер. Файл не добавлен.`,
                        diagnostics,
                        {
                            fileName: fallbackProps.fileName,
                            message: error?.message || String(error)
                        }
                    );
                    return null;
                }
            });
            for (const actionPayload of filePlacements) {
                if (!actionPayload) continue;
                if (!isCurrentDrop()) break;
                manager.eventBus.emit(Events.UI.ToolbarAction, actionPayload);
            }
            logDropDebug(diagnostics, 'drop_done', { route: 'non_image_files', itemsProcessed: nonImageFiles.length });
            return;
        }

        const html = dt.getData('text/html');
        if (html && html.includes('<img')) {
            logDropDebug(diagnostics, 'route_html_image');
            const match = html.match(/<img[^>]*src\s*=\s*"([^"]+)"/i);
            if (match && match[1]) {
                const url = match[1];
                if (/^data:image\//i.test(url)) {
                    emitAt(url, 'clipboard-image.png');
                    logDropDebug(diagnostics, 'drop_done', { route: 'html_data_image' });
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
                        logDropDebug(diagnostics, 'drop_done', { route: 'html_http_image_fetched' });
                    } catch (_) {
                        emitAt(url, url.split('/').pop() || 'image');
                        logDropDebug(diagnostics, 'drop_done', { route: 'html_http_image_direct' });
                    }
                    return;
                }
            }
        }

        const uriList = dt.getData('text/uri-list') || '';
        if (uriList) {
            logDropDebug(diagnostics, 'route_uri_list');
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
            if (index > 0) {
                logDropDebug(diagnostics, 'drop_done', { route: 'uri_list_images', itemsProcessed: index });
                return;
            }
        }

        const text = dt.getData('text/plain') || '';
        if (text) {
            logDropDebug(diagnostics, 'route_text_plain');
            const trimmed = text.trim();
            const isDataUrl = /^data:image\//i.test(trimmed);
            const isHttpUrl = /^https?:\/\//i.test(trimmed);
            const looksLikeImage = /(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmed);
            if (isDataUrl) {
                emitAt(trimmed, 'clipboard-image.png');
                logDropDebug(diagnostics, 'drop_done', { route: 'text_data_image' });
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
                    logDropDebug(diagnostics, 'drop_done', { route: 'text_http_image_fetched' });
                } catch (_) {
                    emitAt(trimmed, trimmed.split('/').pop() || 'image');
                    logDropDebug(diagnostics, 'drop_done', { route: 'text_http_image_direct' });
                }
            }
        }
        logDropDebug(diagnostics, 'drop_done', { route: 'no_supported_payload' });
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
