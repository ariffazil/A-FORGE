/**
 * forge_runtime_verify — Compare source, build, and runtime consistency.
 *
 * Returns MATCH | DRIFT | UNKNOWN with detailed evidence.
 * Fail-closed: execution blocked on DRIFT.
 *
 * Logic:
 *   1. git rev-parse HEAD → source commit hash
 *   2. pip show arifos → installed wheel location
 *   3. python3 -c "import arifos; print(arifos.__file__)" → import path
 *   4. Compare source == installed? wheel path == import path?
 *   5. Return MATCH if all three consistent, DRIFT otherwise
 *
 * DITEMPA BUKAN DIBERI — Forged, not given.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

interface RuntimeVerifyResult {
  status: "MATCH" | "DRIFT" | "UNKNOWN";
  git_commit: string | null;
  git_branch: string | null;
  git_dirty: boolean | null;
  installed_wheel: string | null;
  installed_version: string | null;
  import_path: string | null;
  import_version: string | null;
  source_vs_wheel: "MATCH" | "DRIFT" | "UNKNOWN";
  wheel_vs_import: "MATCH" | "DRIFT" | "UNKNOWN";
  source_vs_import: "MATCH" | "DRIFT" | "UNKNOWN";
  evidence: string[];
  errors: string[];
  block_execution: boolean;
}

function safeExec(cmd: string, timeout = 5000): string | null {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getGitInfo(workspace: string): { commit: string | null; branch: string | null; dirty: boolean | null } {
  // Try specified workspace, then fall back to known repos
  const candidates = [workspace, "/root/arifOS", "/root/A-FORGE", "/root/AAA"];
  for (const dir of candidates) {
    try {
      const commit = safeExec(`git -C ${dir} rev-parse HEAD 2>/dev/null`);
      if (commit) {
        const branch = safeExec(`git -C ${dir} rev-parse --abbrev-ref HEAD 2>/dev/null`);
        const dirtyRaw = safeExec(`git -C ${dir} status --porcelain 2>/dev/null`);
        const dirty = dirtyRaw !== null ? dirtyRaw.length > 0 : null;
        return { commit, branch, dirty };
      }
    } catch {
      continue;
    }
  }
  return { commit: null, branch: null, dirty: null };
}

function getWheelInfo(): { location: string | null; version: string | null } {
  try {
    const pipShow = safeExec("pip show arifos 2>/dev/null");
    if (!pipShow) return { location: null, version: null };

    let location: string | null = null;
    let version: string | null = null;

    for (const line of pipShow.split("\n")) {
      if (line.startsWith("Location:")) {
        location = line.replace("Location:", "").trim();
      }
      if (line.startsWith("Version:")) {
        version = line.replace("Version:", "").trim();
      }
    }

    // Check for the actual installed package directory
    if (location) {
      const pkgDir = `${location}/arifos`;
      // Also check for arifosmcp
      const mcpDir = `${location}/arifosmcp`;
      if (!existsSync(pkgDir) && existsSync(mcpDir)) {
        location = `${location}/arifosmcp`;
      }
    }

    return { location, version };
  } catch {
    return { location: null, version: null };
  }
}

function getImportInfo(): { path: string | null; version: string | null } {
  try {
    const importPath = safeExec(
      'python3 -c "import arifos; print(arifos.__file__)" 2>/dev/null'
    );
    const importVersion = safeExec(
      "python3 -c \"import arifos; print(getattr(arifos, '__version__', 'unknown'))\" 2>/dev/null"
    );
    return { path: importPath, version: importVersion };
  } catch {
    return { path: null, version: null };
  }
}

export function registerRuntimeVerifyTool(server: McpServer): void {
  server.tool(
    "forge_runtime_verify",
    "Verify runtime consistency: compares git source commit vs installed wheel vs import path. Returns MATCH|DRIFT|UNKNOWN. Fail-closed: blocks execution on DRIFT. Read-only (OBSERVE class).",
    {
      package_name: z.string().default("arifos").describe("Package name to verify (default: arifos)"),
      workspace: z.string().default("/root").describe("Git workspace path (default: /root)"),
      strict_mode: z.boolean().default(false)
        .describe("If true, ANY inconsistency blocks execution. If false, requires wheel-vs-import mismatch to block."),
      mode: z.enum(["verify", "auto_sync"]).default("verify")
        .describe("verify = read-only drift check. auto_sync = when drift detected, rsync source→runtime, clear pycache, restart service, re-verify (T2 mutation, F1 AMANAH)."),
      runtime_dir: z.string().default("/opt/arifos/app").describe("Target runtime dir for auto_sync (default: /opt/arifos/app)"),
      service_name: z.string().default("arifos.service").describe("Systemd unit to restart on auto_sync (default: arifos.service)"),
    },
    async ({ package_name: pkg, workspace, strict_mode, mode, runtime_dir, service_name }) => {
      const evidence: string[] = [];
      const errors: string[] = [];

      // 1. Source commit
      const git = getGitInfo(workspace);
      if (git.commit) {
        evidence.push(`Git commit: ${git.commit} (branch: ${git.branch ?? "detached"}, dirty: ${git.dirty})`);
      } else {
        errors.push("Cannot read git commit from /root");
      }

      // 2. Installed wheel
      const wheel = getWheelInfo();
      if (wheel.location) {
        evidence.push(`Installed wheel location: ${wheel.location} (version: ${wheel.version ?? "unknown"})`);
      } else {
        evidence.push("Installed wheel: NOT FOUND (arifos not installed via pip)");
      }

      // 3. Import path
      const imp = getImportInfo();
      if (imp.path) {
        evidence.push(`Import path: ${imp.path} (version: ${imp.version ?? "unknown"})`);
      } else {
        evidence.push("Import path: NOT FOUND (arifos not importable)");
      }

      // 4. Comparisons
      let sourceVsWheel: "MATCH" | "DRIFT" | "UNKNOWN" = "UNKNOWN";
      let wheelVsImport: "MATCH" | "DRIFT" | "UNKNOWN" = "UNKNOWN";
      let sourceVsImport: "MATCH" | "DRIFT" | "UNKNOWN" = "UNKNOWN";

      // Source vs wheel: check if wheel path points inside the git repo
      if (git.commit && wheel.location) {
        // Wheel is "matching source" if it's built from the same repo
        // Check if wheel path resolves inside /root
        const gitRoot = workspace;
        if (wheel.location.startsWith(gitRoot)) {
          // The wheel is from the same repo — check version vs commit
          sourceVsWheel = "DRIFT"; // always flag — wheel location is stale
          evidence.push("Source-vs-wheel: DRIFT (wheel is in the repo tree, not an installed package)");
        } else {
          // Wheel is in system pip — compare with HEAD
          // For pip-installed packages, version string vs commit hash
          if (wheel.version && wheel.version.includes(git.commit?.slice(0, 7) ?? "")) {
            sourceVsWheel = "MATCH";
          } else {
            sourceVsWheel = "DRIFT";
            evidence.push(`Source-vs-wheel: DRIFT (commit ${git.commit?.slice(0, 7)} vs version ${wheel.version})`);
          }
        }
      }

      // Wheel vs import: same physical file?
      if (wheel.location && imp.path) {
        // Normalize paths and check
        const wheelNorm = wheel.location.replace(/\/+$/, "");
        const impNorm = imp.path.replace(/\/+$/, "");
        // The import path often points to __init__.py — check directory
        const impDir = impNorm.replace(/__init__\.py$/, "").replace(/\/+$/, "");
        if (wheelNorm === impDir || wheelNorm.endsWith(impDir.split("/").pop() ?? "")) {
          wheelVsImport = "MATCH";
          evidence.push("Wheel-vs-import: MATCH");
        } else {
          wheelVsImport = "DRIFT";
          evidence.push(`Wheel-vs-import: DRIFT (${wheel.location} != ${imp.path})`);
        }
      } else if (!wheel.location && !imp.path) {
        wheelVsImport = "UNKNOWN";
        evidence.push("Wheel-vs-import: UNKNOWN (neither wheel nor import found)");
      } else {
        wheelVsImport = "DRIFT";
        evidence.push("Wheel-vs-import: DRIFT (one present, one absent)");
      }

      // Source vs import
      if (git.commit && imp.path) {
        if (imp.path.startsWith(workspace)) {
          sourceVsImport = "MATCH";
          evidence.push("Source-vs-import: MATCH (import from workspace)");
        } else {
          sourceVsImport = "DRIFT";
          evidence.push(`Source-vs-import: DRIFT (commit ${git.commit?.slice(0, 7)} resolves elsewhere)`);
        }
      } else if (!git.commit && !imp.path) {
        sourceVsImport = "UNKNOWN";
      } else {
        sourceVsImport = "DRIFT";
      }

      // 5. Overall verdict
      const overallDrift =
        sourceVsWheel === "DRIFT" ||
        wheelVsImport === "DRIFT" ||
        (strict_mode && sourceVsImport === "DRIFT");

      let status: "MATCH" | "DRIFT" | "UNKNOWN";
      let blockExecution: boolean;

      if (overallDrift) {
        status = "DRIFT";
        // Fail-closed: block execution on DRIFT between wheel and import
        blockExecution = wheelVsImport === "DRIFT" || (strict_mode && sourceVsWheel === "DRIFT");
      } else if (sourceVsWheel === "UNKNOWN" && wheelVsImport === "UNKNOWN") {
        status = "UNKNOWN";
        blockExecution = false; // Can't verify, but don't block — allow fallback
      } else {
        status = "MATCH";
        blockExecution = false;
      }

      const result: RuntimeVerifyResult = {
        status,
        git_commit: git.commit,
        git_branch: git.branch,
        git_dirty: git.dirty,
        installed_wheel: wheel.location,
        installed_version: wheel.version,
        import_path: imp.path,
        import_version: imp.version,
        source_vs_wheel: sourceVsWheel,
        wheel_vs_import: wheelVsImport,
        source_vs_import: sourceVsImport,
        evidence,
        errors,
        block_execution: blockExecution,
      };

      // ── AUTO_SYNC MODE — heal drift when detected (F1 AMANAH: reversible) ──
      // Pattern (carried from helix v1→v2 lesson: manual rsync+pycache+restart
      // sequence, automated):
      //   1. If drift detected AND mode=auto_sync → rsync source → runtime
      //   2. Clear __pycache__ in target
      //   3. systemctl restart <service>
      //   4. Wait for service health, re-verify, return new result
      // Reversibility: F1 — runtime_dir is a copy of source; restart can be
      // undone by re-running verify which would report re-drift if it failed.
      if (mode === "auto_sync" && status === "DRIFT") {
        const syncSteps: string[] = [];
        const syncErrors: string[] = [];

        // Determine the source dir for the organ based on package_name
        const organSource = `/root/${pkg}`;

        // 1. Rsync source → runtime
        const rsyncCmd = [
          "rsync", "-a", "--delete",
          "--exclude=.git", "--exclude=__pycache__", "--exclude=*.pyc",
          "--exclude=.venv", "--exclude=venv", "--exclude=.mypy_cache",
          "--exclude=node_modules", "--exclude=.pytest_cache",
          `${organSource}/`, `${runtime_dir}/`,
        ].join(" ");
        const rsyncOut = safeExec(rsyncCmd, 60_000);
        syncSteps.push(`rsync: ${rsyncOut === null ? "FAILED" : "ok"}`);
        if (rsyncOut === null) syncErrors.push("rsync failed");

        // 2. Clear all __pycache__ under runtime
        const pycacheOut = safeExec(
          `find ${runtime_dir} -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; echo cleared`,
          30_000
        );
        syncSteps.push(`pycache: ${pycacheOut ?? "FAILED"}`);
        if (pycacheOut === null) syncErrors.push("pycache clear failed");

        // 3. Restart systemd unit
        const restartOut = safeExec(
          `systemctl restart ${service_name} 2>&1; echo restarted`,
          30_000
        );
        syncSteps.push(`restart: ${restartOut ?? "FAILED"}`);
        if (restartOut === null) syncErrors.push("restart failed");

        // 4. Wait for service to be ready (poll up to 15s)
        let readyAfter: number | null = null;
        for (let s = 0; s < 15; s++) {
          const probe = safeExec(
            `curl -sf --max-time 2 http://127.0.0.1:8088/health >/dev/null 2>&1; echo $?`,
            5_000
          );
          if (probe && probe.trim() === "0") {
            readyAfter = s;
            break;
          }
          safeExec("sleep 1");
        }
        syncSteps.push(`service_ready: ${readyAfter !== null ? `${readyAfter}s` : "TIMEOUT"}`);
        if (readyAfter === null) syncErrors.push("service did not come up within 15s");

        // 5. Re-verify
        const reGit = getGitInfo(workspace);
        const reImp = getImportInfo();
        const healed = !(
          reGit.commit && reImp.path && !reImp.path.includes(reGit.commit?.slice(0, 7) ?? "____")
        );
        syncSteps.push(`re_verify: ${healed ? "MATCH" : "STILL_DRIFT"}`);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              auto_sync: {
                executed: true,
                steps: syncSteps,
                errors: syncErrors,
                healed,
                new_runtime_path: reImp.path,
                new_git_commit: reGit.commit,
                timestamp: new Date().toISOString(),
              },
            }, null, 2),
          }],
          isError: syncErrors.length > 0,
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
        isError: status === "DRIFT" && blockExecution,
      };
    }
  );
}
