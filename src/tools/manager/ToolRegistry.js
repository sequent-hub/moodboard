export class ToolRegistry {
    constructor(manager) {
        this.manager = manager;
    }

    register(tool) {
        this.manager.tools.set(tool.name, tool);

        if (!this.manager.defaultTool) {
            this.manager.defaultTool = tool.name;
        }
    }

    get(toolName) {
        return this.manager.tools.get(toolName);
    }

    has(toolName) {
        return this.manager.tools.has(toolName);
    }

    getAll() {
        return Array.from(this.manager.tools.values());
    }

    values() {
        return this.manager.tools.values();
    }

    clear() {
        this.manager.tools.clear();
    }
}
