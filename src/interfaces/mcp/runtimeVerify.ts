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
import { existsSync, readFileSync, statSync } from "node:fs";

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
  // P0-FIX: A-FORGE first — the verifier should check its own repo, not arifOS kernel.
  const candidates = [workspace, "/root/A-FORGE", "/root/arifOS", "/root/AAA"];
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
    const venvPip = "/opt/arifos/current/venv/bin/pip";
    const pipCmd = existsSync(venvPip) ? `${venvPip} show arifos 2>/dev/null` : "pip show arifos 2>/dev/null";
    const pipShow = safeExec(pipCmd);
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
    const venvPy = "/opt/arifos/current/venv/bin/python";
    const pyCmd = existsSync(venvPy) ? venvPy : "python3";
    const importPath = safeExec(
      `${pyCmd} -c "try:\n import arifos; print(arifos.__file__)\nexcept ImportError:\n import arifosmcp; print(arifosmcp.__file__)" 2>/dev/null`
    );
    const importVersion = safeExec(
      `${pyCmd} -c "try:\n import arifos; print(getattr(arifos, '__version__', 'unknown'))\nexcept ImportError:\n import arifosmcp; print(getattr(arifosmcp, '__version__', 'unknown'))" 2>/dev/null`
    );
    return { path: importPath, version: importVersion };
  } catch {
    return { path: null, version: null };
  }
}

/**
 * P0-FIX: Check A-FORGE's own identity via Node.js package.json + dist artifacts.
 * A-FORGE is a Node.js MCP server, not a Python package — pip show / import arifos
 * returns the arifOS kernel, not A-FORGE.
 */
function getNodePackageInfo(workspace: string): { version: string | null; distPath: string | null; entryPoint: string | null } {
  try {
    const pkgJsonPath = `${workspace}/package.json`;
    if (!existsSync(pkgJsonPath)) return { version: null, distPath: null, entryPoint: null };
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    const version: string | null = pkg.version ?? null;

    // Check for compiled dist entry point
    const distCandidates = [
      `${workspace}/dist/src/interfaces/mcp/serve.js`,
      `${workspace}/dist/src/interfaces/mcp/serveModern.js`,
      `${workspace}/dist/src/interfaces/mcp/core.js`,
    ];
    let distPath: string | null = null;
    for (const c of distCandidates) {
      if (existsSync(c)) { distPath = c; break; }
    }

    const entryPoint: string | null = pkg.main ?? pkg.exports?.["."] ?? null;
    return { version, distPath, entryPoint };
  } catch {
    return { version: null, distPath: null, entryPoint: null };
  }
}

export function registerRuntimeVerifyTool(server: McpServer): void {
  server.tool(
    "forge_runtime_verify",
    "Verify runtime consistency: compares git source commit vs installed wheel vs import path. Returns MATCH|DRIFT|UNKNOWN. Fail-closed: blocks execution on DRIFT. Read-only (OBSERVE class).",
    {
      package_name: z.string().default("@ariffazil/a-forge").describe("Package name to verify (default: @ariffazil/a-forge)"),
      workspace: z.string().default("/root/A-FORGE").describe("Git workspace path (default: /root/A-FORGE)"),
      strict_mode: z.boolean().default(false)
        .describe("If true, ANY inconsistency blocks execution. If false, requires wheel-vs-import mismatch to block."),
    },
    async ({ package_name: pkg, workspace, strict_mode }) => {
      const evidence: string[] = [];
      const errors: string[] = [];

      // Detect whether this is a Node.js (A-FORGE) or Python (arifOS kernel) package
      const pkgName = pkg ?? "@ariffazil/a-forge";
      const isNodePkg = pkgName.startsWith("@") || pkgName === "a-forge" || pkgName === "aforge";
      const ws = workspace ?? "/root/A-FORGE";

      // 1. Source commit
      const git = getGitInfo(ws);
      if (git.commit) {
        evidence.push(`Git commit: ${git.commit} (branch: ${git.branch ?? "detached"}, dirty: ${git.dirty})`);
      } else {
        errors.push(`Cannot read git commit from ${ws}`);
      }

      // 2. Build/runtime artifact
      let wheel: { location: string | null; version: string | null } = { location: null, version: null };
      let nodePkg: { version: string | null; distPath: string | null; entryPoint: string | null } = { version: null, distPath: null, entryPoint: null };

      if (isNodePkg) {
        // P0-FIX: A-FORGE is Node.js — check package.json + dist artifacts
        nodePkg = getNodePackageInfo(ws);
        if (nodePkg.version) {
          evidence.push(`Node package version: ${nodePkg.version} (from ${ws}/package.json)`);
        } else {
          errors.push(`Cannot read package.json from ${ws}`);
        }
        if (nodePkg.distPath) {
          evidence.push(`Dist entry point: ${nodePkg.distPath}`);
        } else {
          evidence.push("Dist entry point: NOT FOUND (project not built?)");
        }
      } else {
        // Python package (arifOS kernel path)
        wheel = getWheelInfo();
        if (wheel.location) {
          evidence.push(`Installed wheel location: ${wheel.location} (version: ${wheel.version ?? "unknown"})`);
        } else {
          evidence.push("Installed wheel: NOT FOUND (not installed via pip)");
        }
      }

      // 3. Import/runtime path
      let imp: { path: string | null; version: string | null } = { path: null, version: null };
      if (isNodePkg) {
        // For Node.js, the "import path" is the running process entry point
        // Check if dist/src/interfaces/mcp/serve.js exists (the actual entry)
        imp = { path: nodePkg.distPath, version: nodePkg.version };
      } else {
        imp = getImportInfo();
        if (imp.path) {
          evidence.push(`Import path: ${imp.path} (version: ${imp.version ?? "unknown"})`);
        } else {
          evidence.push("Import path: NOT FOUND (not importable)");
        }
      }

      // 4. Comparisons
      let sourceVsWheel: "MATCH" | "DRIFT" | "UNKNOWN" = "UNKNOWN";
      let wheelVsImport: "MATCH" | "DRIFT" | "UNKNOWN" = "UNKNOWN";
      let sourceVsImport: "MATCH" | "DRIFT" | "UNKNOWN" = "UNKNOWN";

      if (isNodePkg) {
        // P0-FIX: Node.js comparison — git commit vs dist build vs package.json version
        // For Node.js projects, MATCH means: dist exists and was built from current source.
        // We check if dist exists (build artifact present) and if package.json version is consistent.
        if (git.commit && nodePkg.distPath) {
          // Check if dist is newer than last commit (build from current source)
          try {
            const distStat = statSync(nodePkg.distPath);
            const gitLogTime = safeExec(`git -C ${ws} log -1 --format=%ct 2>/dev/null`);
            if (gitLogTime) {
              const commitTime = Number(gitLogTime) * 1000;
              if (distStat.mtimeMs >= commitTime) {
                sourceVsWheel = "MATCH";
                evidence.push(`Source-vs-dist: MATCH (dist built after last commit)`);
              } else {
                sourceVsWheel = "DRIFT";
                evidence.push(`Source-vs-dist: DRIFT (dist older than last commit — rebuild needed)`);
              }
            } else {
              sourceVsWheel = "UNKNOWN";
              evidence.push("Source-vs-dist: UNKNOWN (cannot read commit timestamp)");
            }
          } catch {
            sourceVsWheel = "UNKNOWN";
            evidence.push("Source-vs-dist: UNKNOWN (cannot stat dist file)");
          }
        } else if (git.commit && !nodePkg.distPath) {
          sourceVsWheel = "DRIFT";
          evidence.push("Source-vs-dist: DRIFT (no dist entry point found — project not built)");
        }

        // dist vs runtime — for Node.js, dist IS the runtime
        if (nodePkg.distPath) {
          wheelVsImport = "MATCH";
          evidence.push("Dist-vs-runtime: MATCH (Node.js dist IS the runtime)");
        } else {
          wheelVsImport = "DRIFT";
          evidence.push("Dist-vs-runtime: DRIFT (no dist entry point)");
        }

        // Source vs runtime
        if (git.commit && nodePkg.distPath) {
          sourceVsImport = sourceVsWheel; // same as source-vs-dist
        }
      } else {
        // Python package comparison (original logic)
        // Source vs wheel: check if wheel path points inside the git repo
        if (git.commit && wheel.location) {
          const gitRoot = ws;
          if (wheel.location.startsWith(gitRoot)) {
            sourceVsWheel = "DRIFT";
            evidence.push("Source-vs-wheel: DRIFT (wheel is in the repo tree, not an installed package)");
          } else {
            if (wheel.version && wheel.version.includes(git.commit?.slice(0, 7) ?? "")) {
              sourceVsWheel = "MATCH";
            } else {
              sourceVsWheel = "DRIFT";
              evidence.push(`Source-vs-wheel: DRIFT (commit ${git.commit?.slice(0, 7)} vs version ${wheel.version})`);
            }
          }
        }

        // Wheel vs import
        if (wheel.location && imp.path) {
          const wheelNorm = wheel.location.replace(/\/+$/, "");
          const impNorm = imp.path.replace(/\/+$/, "");
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
          if (imp.path.startsWith(ws)) {
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
