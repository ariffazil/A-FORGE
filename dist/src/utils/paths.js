import { relative, resolve } from "node:path";
export function resolveWorkingDirectory(cwd) {
    return resolve(cwd ?? process.cwd());
}
export function defaultMemoryPath(cwd) {
    return resolve(resolveWorkingDirectory(cwd), ".agent-workbench", "memory.json");
}
export function resolveSandboxedPath(workingDirectory, targetPath) {
    const resolved = resolve(workingDirectory, targetPath);
    const rel = relative(workingDirectory, resolved);
    if (rel === "" || (!rel.startsWith("..") && !rel.includes(`..${process.platform === "win32" ? "\\" : "/"}`))) {
        return resolved;
    }
    throw new Error(`Path escapes the working directory sandbox: ${targetPath}`);
}
