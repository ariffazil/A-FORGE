import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export class RunMetricsLogger {
    directoryPath;
    constructor(directoryPath) {
        this.directoryPath = directoryPath;
    }
    async log(taskId, payload) {
        await mkdir(this.directoryPath, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filePath = join(this.directoryPath, `agent-workbench-run-${stamp}-${taskId}.json`);
        await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
        return filePath;
    }
}
