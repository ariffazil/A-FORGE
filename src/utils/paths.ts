import { relative, resolve } from "node:path";

export function resolveWorkingDirectory(cwd?: string): string {
  return resolve(cwd ?? process.cwd());
}

export function defaultMemoryPath(cwd?: string): string {
  return resolve(resolveWorkingDirectory(cwd), ".agent-workbench", "memory.json");
}

export function resolveSandboxedPath(workingDirectory: string, targetPath: string): string {
  const resolved = resolve(workingDirectory, targetPath);
  const rel = relative(workingDirectory, resolved);

  if (rel === "" || (!rel.startsWith("..") && !rel.includes(`..${process.platform === "win32" ? "\\" : "/"}`))) {
    return resolved;
  }

  throw new Error(`Path escapes the working directory sandbox: ${targetPath}`);
}
