export class ToolActivationController {
    constructor(manager) {
        this.manager = manager;
    }

    activateTool(toolName) {
        const tool = this.manager.registry.get(toolName);
        if (!tool) {
            console.warn(`Tool "${toolName}" not found`);
            return false;
        }

        if (this.manager.activeTool) {
            this.manager.activeTool.deactivate();
        }

        this.manager.activeTool = tool;

        if (typeof this.manager.activeTool.activate === 'function') {
            this.manager.activeTool.activate(this.manager.pixiApp);
        }
        this.manager.syncActiveToolCursor();

        return true;
    }

    activateTemporaryTool(toolName) {
        if (this.manager.activeTool) {
            this.manager.previousTool = this.manager.activeTool.name;
        }

        this.activateTool(toolName);
        this.manager.temporaryTool = toolName;
    }

    returnToPreviousTool() {
        if (this.manager.temporaryTool && this.manager.previousTool) {
            this.activateTool(this.manager.previousTool);
            this.manager.temporaryTool = null;
            this.manager.previousTool = null;
        }
    }

    activateDefaultTool() {
        if (this.manager.defaultTool) {
            this.activateTool(this.manager.defaultTool);
        }
    }
}
