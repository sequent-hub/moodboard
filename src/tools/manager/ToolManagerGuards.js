export class ToolManagerGuards {
    static isCursorLockedToActiveTool(manager) {
        return !!manager.activeTool && manager.activeTool.name !== 'select';
    }

    static getPixiCursorStyles(manager) {
        const renderer = manager.pixiApp && manager.pixiApp.renderer;
        if (!renderer) return null;

        const events = renderer.events || (renderer.plugins && renderer.plugins.interaction);
        return events && events.cursorStyles ? events.cursorStyles : null;
    }

    static getActiveToolCursor(manager, defaultCursor = '') {
        const cursor = manager.activeTool && manager.activeTool.cursor;
        if (typeof cursor === 'string' && cursor.length > 0) return cursor;
        return defaultCursor;
    }

    static shouldIgnoreHotkeys(event) {
        return event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
    }

    static isAuxPanStart(manager, event) {
        const isMiddle = event.button === 1;
        const isSpaceLeft = event.button === 0 && manager.spacePressed;
        return isMiddle || isSpaceLeft;
    }

    static isTemporaryPanActive(manager) {
        return manager.temporaryTool === 'pan';
    }
}
