const PASSIVE_FALSE = { passive: false };

export class ToolManagerLifecycle {
    static initEventListeners(manager, defaultCursor) {
        if (!manager.container) return;

        manager.container.addEventListener('mousedown', (event) => manager.handleMouseDown(event));
        manager.container.addEventListener('mousemove', (event) => manager.handleMouseMove(event));
        manager.container.addEventListener('mouseup', (event) => manager.handleMouseUp(event));
        manager.container.addEventListener('mouseenter', () => {
            manager.isMouseOverContainer = true;
            if (!manager.activeTool) {
                manager.container.style.cursor = defaultCursor;
                return;
            }
            manager.syncActiveToolCursor();
        });
        manager.container.addEventListener('mouseleave', () => {
            manager.isMouseOverContainer = false;
        });

        manager.container.addEventListener('dragenter', (event) => {
            event.preventDefault();
        });
        manager.container.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        });
        manager.container.addEventListener('dragleave', () => {
            // можно снимать подсветку, если добавим в будущем
        });
        manager.container.addEventListener('drop', (event) => manager.handleDrop(event));

        document.addEventListener('mousemove', (event) => manager.handleMouseMove(event));
        document.addEventListener('mouseup', (event) => {
            manager.handleMouseUp(event);
            if (manager.temporaryTool === 'pan') {
                manager.handleAuxPanEnd(event);
            }
        });
        manager.container.addEventListener('dblclick', (event) => manager.handleDoubleClick(event));
        manager.container.addEventListener('wheel', (event) => manager.handleMouseWheel(event), PASSIVE_FALSE);

        manager._onWindowWheel = (event) => {
            try {
                if (event && event.ctrlKey && manager.isMouseOverContainer) {
                    event.preventDefault();
                }
            } catch (_) {}
        };
        window.addEventListener('wheel', manager._onWindowWheel, PASSIVE_FALSE);

        document.addEventListener('keydown', (event) => manager.handleKeyDown(event));
        document.addEventListener('keyup', (event) => manager.handleKeyUp(event));

        manager.container.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            if (!manager.activeTool) return;
            const rect = manager.container.getBoundingClientRect();
            const toolEvent = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                originalEvent: event
            };
            if (typeof manager.activeTool.onContextMenu === 'function') {
                manager.activeTool.onContextMenu(toolEvent);
            }
        });
    }

    static destroy(manager) {
        for (const tool of manager.registry.values()) {
            tool.destroy();
        }

        manager.registry.clear();
        manager.activeTool = null;

        if (manager.container) {
            manager.container.removeEventListener('mousedown', manager.handleMouseDown);
            manager.container.removeEventListener('mousemove', manager.handleMouseMove);
            manager.container.removeEventListener('mouseup', manager.handleMouseUp);
            manager.container.removeEventListener('dblclick', manager.handleDoubleClick);
            manager.container.removeEventListener('wheel', manager.handleMouseWheel);
            manager.container.removeEventListener('contextmenu', (event) => event.preventDefault());
            manager.container.removeEventListener('dragenter', (event) => event.preventDefault());
            manager.container.removeEventListener('dragover', (event) => event.preventDefault());
            manager.container.removeEventListener('dragleave', () => {});
            manager.container.removeEventListener('drop', manager.handleDrop);
        }
        document.removeEventListener('mousemove', manager.handleMouseMove);
        document.removeEventListener('mouseup', manager.handleMouseUp);

        document.removeEventListener('keydown', manager.handleKeyDown);
        document.removeEventListener('keyup', manager.handleKeyUp);
        if (manager._onWindowWheel) {
            try {
                window.removeEventListener('wheel', manager._onWindowWheel);
            } catch (_) {}
            manager._onWindowWheel = null;
        }

        const cursorStyles = manager.getPixiCursorStyles();
        if (cursorStyles && manager._originalPixiCursorStyles) {
            cursorStyles.pointer = manager._originalPixiCursorStyles.pointer;
            cursorStyles.default = manager._originalPixiCursorStyles.default;
        }
        manager._originalPixiCursorStyles = null;
    }
}
