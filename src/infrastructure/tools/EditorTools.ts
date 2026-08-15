/**
 * EditorTools — diff-only file editing, replacing freeform write.
 *
 * ApplyPatchesTool is the only write tool available to agents when diff_mode=true.
 * It accepts unified diffs and applies them via `patch` CLI or pure-JS equivalent.
 * No raw write_file exposure — all writes go through this interface.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { BaseTool } from "./base.js";
import type { ToolExecutionContext, ToolResult } from "../../domain/types/tool.js";
import type { PatchResult } from "../../domain/types/policy.js";
import { resolveSandboxedPath } from "../../utils/paths.js";
import { AmanahLockManager } from "../../domain/governance/index.js";
import { runPreflight } from "../../domain/governance/preflight.js";
import { ensureAmanahLock, releaseAutoLock } from "./amanah-auto-acquire.js";

const execFileAsync = promisify(execFile);

const execOptions = { timeout: 30000 };

export interface PatchRequest {
  file_path: string;
  unified_diff: string;
}

export class ApplyPatchesTool extends BaseTool {
  readonly name = "apply_patches";
  readonly description =
    "Apply a list of unified diffs to files. Diff-only — no raw content writes.";
  readonly riskLevel = "guarded" as const;
  readonly parameters = {
    type: "object" as const,
    properties: {
      patches: {
        type: "array" as const,
        description: "Array of patches to apply",
        items: {
          type: "object" as const,
          properties: {
            file_path: { type: "string" as const, description: "Relative path" },
            unified_diff: { type: "string" as const, description: "Unified diff string" },
          },
          required: ["file_path", "unified_diff"],
          additionalProperties: false,
        },
      },
    },
    required: ["patches"],
    additionalProperties: false,
  };

  async run(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const patches = args.patches as PatchRequest[];
    const results: PatchResult[] = [];

    // F1 AMANAH Guard 2: Auto-acquire locks for ALL patched files
    // Transparent to agent — auto-acquire if no lock, 423 if held by other
    const amanah = AmanahLockManager.getInstance();
    const autoLocks: Array<{ lockId: string; resourceId: string }> = [];

    for (const patch of patches) {
      const targetPath = resolveSandboxedPath(context.workingDirectory, patch.file_path);

      const lock = await ensureAmanahLock(
        targetPath,
        context.sessionId ?? "unknown",
        context.sessionId ?? "unknown", // session IS the actor
        `auto-acquired for apply_patches: ${targetPath}`
      );

      if (!lock.ok) {
        results.push({
          file_path: patch.file_path,
          applied: false,
          stdout: "",
          stderr: lock.error!,
        });
        // Release any locks we already acquired
        for (const al of autoLocks) {
          await releaseAutoLock(al.lockId, context.sessionId ?? "unknown", "rollback on lock conflict");
        }
        return {
          ok: false,
          output: JSON.stringify(results, null, 2),
          metadata: { applied: false, count: results.length, verdict: lock.verdict, holder: lock.holder, floor: "F1" },
        };
      }

      if (lock.isAutoAcquired && lock.lock_id) {
        autoLocks.push({ lockId: lock.lock_id, resourceId: targetPath });
      }
    }

    try {
      // F4 Pre-flight entropy check
      for (const patch of patches) {
        const targetPath = resolveSandboxedPath(context.workingDirectory, patch.file_path);
        const preflight = await runPreflight(context.sessionId, targetPath);
        if (!preflight.ok) {
          results.push({
            file_path: patch.file_path,
            applied: false,
            stdout: "",
            stderr: `888-HOLD: ${preflight.message}`,
          });
        }
      }
      const preflightFailures = results.filter((r) => !r.applied && r.stderr.includes("888-HOLD"));
      if (preflightFailures.length > 0) {
        return {
          ok: false,
          output: JSON.stringify(results, null, 2),
          metadata: { applied: false, count: results.length, verdict: "888-HOLD", floor: "F1+F4", preflightFailures },
        };
      }

      for (const patch of patches) {
        const targetPath = resolveSandboxedPath(context.workingDirectory, patch.file_path);

        if (Buffer.byteLength(patch.unified_diff, "utf8") > (context.policy?.maxFileBytes ?? 262144)) {
          results.push({
            file_path: patch.file_path,
            applied: false,
            stdout: "",
            stderr: "Diff exceeds max size limit",
          });
          continue;
        }

        try {
          const result = await applyUnifiedDiff(targetPath, patch.unified_diff, context.workingDirectory);
          results.push(result);
        } catch (err) {
          results.push({
            file_path: patch.file_path,
            applied: false,
            stdout: "",
            stderr: String(err),
          });
        }
      }

      const allApplied = results.every((r) => r.applied);
      return {
        ok: allApplied,
        output: JSON.stringify(results, null, 2),
        metadata: { applied: allApplied, count: results.length, auto_locks: autoLocks.length },
      };
    } finally {
      // Release all auto-acquired locks
      for (const al of autoLocks) {
        await releaseAutoLock(al.lockId, context.sessionId ?? "unknown", "auto-release after patches");
      }
    }
  }
}

async function applyUnifiedDiff(
  targetPath: string,
  diff: string,
  cwd: string,
): Promise<PatchResult> {
  const tmpDiffPath = resolve(tmpdir(), `patch-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(tmpDiffPath, diff, "utf8");

    const { stdout, stderr } = await execFileAsync(
      "patch",
      ["-p1", "--dry-run", "--quiet", "-i", tmpDiffPath],
      { ...execOptions, cwd },
    );

    await execFileAsync("patch", ["-p1", "--quiet", "-i", tmpDiffPath], {
      ...execOptions,
      cwd,
    });

    return { file_path: targetPath, applied: true, stdout, stderr };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string };
    return {
      file_path: targetPath,
      applied: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(err),
    };
  } finally {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpDiffPath);
    } catch {
      // best-effort cleanup
    }
  }
}

export async function applyPatches(patches: PatchRequest[]): Promise<PatchResult[]> {
  const results: PatchResult[] = [];

  for (const patch of patches) {
    try {
      const result = await applyUnifiedDiff(patch.file_path, patch.unified_diff, process.cwd());
      results.push(result);
    } catch (err) {
      results.push({
        file_path: patch.file_path,
        applied: false,
        stdout: "",
        stderr: String(err),
      });
    }
  }

  return results;
}
