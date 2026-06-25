import { Events } from '../../core/events/Events.js';

const PASSIVE_FALSE = { passive: false };

export class ToolManagerLifecycle {
    static initEventListeners(manager, defaultCursor) {
        if (!manager.container) return;

        // Bound-ссылки для корректного removeEventListener в destroy()
        manager._onPointerDown = (e) => manager.gestures.onPointerDown(e);
        manager._onPointerEnter = () => {
            manager.isMouseOverContainer = true;
            if (!manager.activeTool) {
                manager.container.style.cursor = defaultCursor;
                return;
            }
            manager.syncActiveToolCursor();
        };
        manager._onPointerLeave = () => {
            manager.isMouseOverContainer = false;
        };
        manager._onDragEnter = (e) => { e.preventDefault(); };
        manager._onDragOver = (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        };
        manager._onDragLeave = () => {};
        manager._onDrop = (e) => manager.handleDrop(e);
        manager._onDblClick = (e) => manager.handleDoubleClick(e);
        manager._onWheel = (e) => manager.handleMouseWheel(e);
        manager._onContextMenu = (e) => {
            e.preventDefault();
            if (!manager.activeTool) return;
            if (manager.activeTool.name === 'draw') {
                manager.activateDefaultTool();
                return;
            }
            const rect = manager.container.getBoundingClientRect();
            const toolEvent = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                originalEvent: e
            };
            if (typeof manager.activeTool.onContextMenu === 'function') {
                manager.activeTool.onContextMenu(toolEvent);
            }
        };

        manager.container.addEventListener('pointerdown', manager._onPointerDown);
        manager.container.addEventListener('pointerenter', manager._onPointerEnter);
        manager.container.addEventListener('pointerleave', manager._onPointerLeave);
        manager.container.addEventListener('dragenter', manager._onDragEnter);
        manager.container.addEventListener('dragover', manager._onDragOver);
        manager.container.addEventListener('dragleave', manager._onDragLeave);
        manager.container.addEventListener('drop', manager._onDrop);
        manager.container.addEventListener('dblclick', manager._onDblClick);
        manager.container.addEventListener('wheel', manager._onWheel, PASSIVE_FALSE);
        manager.container.addEventListener('contextmenu', manager._onContextMenu);

        // pointermove только на document — исключает двойной вызов (ранее mousemove висел и на container, и на document)
        manager._onDocPointermove = (e) => manager.gestures.onPointerMove(e);
        manager._onDocPointerup = (e) => manager.gestures.onPointerUp(e);
        manager._onDocPointercancel = (e) => manager.gestures.onPointerUp(e);
        manager._onDocKeydown = (e) => manager.handleKeyDown(e);
        manager._onDocKeyup = (e) => manager.handleKeyUp(e);

        document.addEventListener('pointermove', manager._onDocPointermove);
        document.addEventListener('pointerup', manager._onDocPointerup);
        document.addEventListener('pointercancel', manager._onDocPointercancel);
        document.addEventListener('keydown', manager._onDocKeydown);
        document.addEventListener('keyup', manager._onDocKeyup);

        manager._onWindowWheel = (event) => {
            try {
                if (!event || !(event.ctrlKey || event.metaKey)) return;
                // Гасим браузерный зум страницы при Ctrl/Cmd+колесо в пределах мудборда,
                // независимо от того, над холстом курсор или над HTML-панелью
                event.preventDefault();

                // _onWheel (на canvas) ловит зум, когда цель события — сам canvas.
                // HTML-оверлеи (textarea редактора текста, ручки и т.п.) — соседи canvas,
                // а не его потомки, поэтому их wheel-события не всплывают через canvas.
                // Ловим их здесь: эмитируем WheelZoom, если событие пришло изнутри
                // контейнера мудборда, но НЕ с самого canvas (чтобы не дублировать).
                if (event.target !== manager.container) {
                    const parent = manager.container && manager.container.parentElement;
                    if (parent && parent.contains(event.target)) {
                        const canvasRect = manager.container.getBoundingClientRect();
                        const x = event.clientX - canvasRect.left;
                        const y = event.clientY - canvasRect.top;
                        manager.eventBus.emit(Events.Tool.WheelZoom, { x, y, delta: event.deltaY });
                    }
                }
            } catch (_) {}
        };
        window.addEventListener('wheel', manager._onWindowWheel, PASSIVE_FALSE);

        // Перехватываем браузерный зум страницы (Ctrl +/-/0) и масштабируем только холст
        manager._onWindowZoomKeys = (event) => {
            try {
                if (!event || !(event.ctrlKey || event.metaKey) || event.altKey) return;
                const key = event.key;
                let zoomEvent = null;
                if (key === '=' || key === '+') {
                    zoomEvent = Events.UI.ZoomIn;
                } else if (key === '-' || key === '_') {
                    zoomEvent = Events.UI.ZoomOut;
                } else if (key === '0') {
                    zoomEvent = Events.UI.ZoomReset;
                }
                if (!zoomEvent) return;
                event.preventDefault();
                event.stopPropagation();
                manager.eventBus.emit(zoomEvent);
            } catch (_) {}
        };
        window.addEventListener('keydown', manager._onWindowZoomKeys, true);
    }

    static destroy(manager) {
        for (const tool of manager.registry.values()) {
            tool.destroy();
        }

        manager.registry.clear();
        manager.activeTool = null;

        if (manager.container) {
            manager.container.removeEventListener('pointerdown', manager._onPointerDown);
            manager.container.removeEventListener('pointerenter', manager._onPointerEnter);
            manager.container.removeEventListener('pointerleave', manager._onPointerLeave);
            manager.container.removeEventListener('dragenter', manager._onDragEnter);
            manager.container.removeEventListener('dragover', manager._onDragOver);
            manager.container.removeEventListener('dragleave', manager._onDragLeave);
            manager.container.removeEventListener('drop', manager._onDrop);
            manager.container.removeEventListener('dblclick', manager._onDblClick);
            manager.container.removeEventListener('wheel', manager._onWheel);
            manager.container.removeEventListener('contextmenu', manager._onContextMenu);
        }

        document.removeEventListener('pointermove', manager._onDocPointermove);
        document.removeEventListener('pointerup', manager._onDocPointerup);
        document.removeEventListener('pointercancel', manager._onDocPointercancel);
        document.removeEventListener('keydown', manager._onDocKeydown);
        document.removeEventListener('keyup', manager._onDocKeyup);

        if (manager._onWindowWheel) {
            try {
                window.removeEventListener('wheel', manager._onWindowWheel);
            } catch (_) {}
            manager._onWindowWheel = null;
        }

        if (manager._onWindowZoomKeys) {
            try {
                window.removeEventListener('keydown', manager._onWindowZoomKeys, true);
            } catch (_) {}
            manager._onWindowZoomKeys = null;
        }

        if (manager.gestures) {
            manager.gestures.destroy();
        }

        const cursorStyles = manager.getPixiCursorStyles();
        if (cursorStyles && manager._originalPixiCursorStyles) {
            cursorStyles.pointer = manager._originalPixiCursorStyles.pointer;
            cursorStyles.default = manager._originalPixiCursorStyles.default;
        }
        manager._originalPixiCursorStyles = null;
    }
}
