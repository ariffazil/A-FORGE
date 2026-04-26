/**
 * arifOS Preflight Integration — Seri Kembangan Phase 3
 *
 * Invokes the canonical arifos_preflight.py script before any file mutation.
 * This is "Physical Law" on the host; no exceptions.
 *
 * @constitutional F1 Amanah + F4 Clarity
 * @protocol SERI_KEMBANGAN_ACCORDS Phase 3
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PREFLIGHT_SCRIPT = "/root/arifOS/.arifos/arifos_preflight.py";

export type PreflightStatus = "PASS" | "QUALIFY" | "HOLD" | "ERROR";

export interface PreflightResult {
  ok: boolean;
  status: PreflightStatus;
  message: string;
}

/**
 * Run the canonical arifOS preflight check for a target file.
 *
 * @param agentId   Agent or session identifier (e.g. context.sessionId)
 * @param filePath  Absolute path to the file about to be mutated
 * @returns PreflightResult — ok=true means PROCEED, ok=false means 888-HOLD
 */
export async function runPreflight(agentId: string, filePath: string): Promise<PreflightResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [PREFLIGHT_SCRIPT, agentId, filePath],
      { timeout: 15000 }
    );
    const out = stdout.trim();
    if (out.startsWith("[PASS]")) {
      return { ok: true, status: "PASS", message: out };
    }
    if (out.startsWith("[QUALIFY]")) {
      return { ok: true, status: "QUALIFY", message: out };
    }
    // Unexpected stdout but exit 0
    return { ok: true, status: "PASS", message: out };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; code?: number };
    const out = (error.stdout ?? "").trim();
    const errMsg = (error.stderr ?? "").trim();

    if (out.startsWith("[888-HOLD]")) {
      return { ok: false, status: "HOLD", message: `${out}${errMsg ? " | " + errMsg : ""}` };
    }
    if (errMsg.includes("No such file") || errMsg.includes("not found")) {
      return { ok: false, status: "ERROR", message: `Preflight script missing: ${PREFLIGHT_SCRIPT}` };
    }
    return {
      ok: false,
      status: "ERROR",
      message: `Preflight failed: ${out || errMsg || String(err)}`,
    };
  }
}
