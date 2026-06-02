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
                if (event && event.ctrlKey && manager.isMouseOverContainer) {
                    event.preventDefault();
                }
            } catch (_) {}
        };
        window.addEventListener('wheel', manager._onWindowWheel, PASSIVE_FALSE);
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
