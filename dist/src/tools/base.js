export class BaseTool {
    experimental = false;
    isPermitted(permissionContext) {
        if (!permissionContext.enabledTools.has(this.name)) {
            return false;
        }
        if (this.experimental && !permissionContext.experimentalToolsEnabled) {
            return false;
        }
        if (this.riskLevel === "dangerous" && !permissionContext.dangerousToolsEnabled) {
            return false;
        }
        return true;
    }
}
