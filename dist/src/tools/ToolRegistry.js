export class ToolRegistry {
    tools = new Map();
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    listForModel(permissionContext) {
        return [...this.tools.values()]
            .filter((tool) => tool.isPermitted(permissionContext))
            .map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }));
    }
    async runTool(toolName, args, executionContext, permissionContext) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        if (!tool.isPermitted(permissionContext)) {
            throw new Error(`Tool is not permitted in this profile or mode: ${toolName}`);
        }
        return tool.run(args, executionContext);
    }
}
