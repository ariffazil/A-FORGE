#!/usr/bin/env node
/**
 * Metabolism Convergence Tracker — C1
 *
 * Reads cooling receipts from VAULT999 seal_chain.jsonl, tracks
 * consecutive DIVERGING count, and escalates to F13 at 3× DIVERGING.
 *
 * Usage:
 *   node /root/A-FORGE/scripts/metabolism-tracker.js [--threshold=3] [--dry-run]
 *
 * Returns JSON with:
 *   - total_coolings: int
 *   - current_streak: { convergence: string, count: int }
 *   - needs_escalation: bool
 *   - escalation: { type: string, message: string, trigger_seqs: int[] }
 *
 * DITEMPA BUKAN DIBERI — Tracking is forged, not given.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Resolve A-FORGE root from this script: scripts/metabolism-tracker.cjs → ..
const A_FORGE_ROOT = path.resolve(__dirname, "..");

// Locator: shell out to Python paths_resolver for cross-language SOT.
function _resolveOrgan(name) {
  try {
    return execSync(
      `python3 -c "import sys; sys.path.insert(0, '${A_FORGE_ROOT}/paradox-engine'); from paths_resolver import org_path; print(org_path('${name}'))"`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    // Fallback to relative resolution if Python unavailable
    if (name === "AAA") return path.resolve(A_FORGE_ROOT, "..", "AAA");
    if (name === "arifOS") return path.resolve(A_FORGE_ROOT, "..", "arifOS");
    if (name === "VAULT999") return path.resolve(A_FORGE_ROOT, "..", "arifOS", "VAULT999");
    return A_FORGE_ROOT;
  }
}

const SEAL_CHAIN_PATH =
  process.env.VAULT999_PATH ||
  "/root/.local/share/arifos/vault999/seal_chain.jsonl";
const SEAL_CHAIN_JS =
  process.env.SEAL_CHAIN_JS_PATH ||
  `${_resolveOrgan("AAA")}/a2a-server/seal_chain.js`;
const F13_SEAL_CHAIN_PATH =
  process.env.F13_ESCALATION_PATH ||
  "/root/.local/share/arifos/vault999/F13_ESCALATIONS.md";

// Parse args
const args = process.argv.slice(2);
const THRESHOLD = parseInt(
  args.find((a) => a.startsWith("--threshold="))?.split("=")[1] || "3",
  10
);
const DRY_RUN = args.includes("--dry-run");

function readSealChain(path) {
  if (!fs.existsSync(path)) {
    return { ok: false, error: `Chain not found: ${path}` };
  }
  try {
    const text = fs.readFileSync(path, "utf-8");
    const entries = text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
    return { ok: true, entries };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function classifyConvergence(entry) {
  // Check direct cooling receipt fields
  if (entry.event_type === "cooling.receipt" || entry.event_type === "cooling.receipt") {
    const meta = entry.metabolism || (entry.payload && entry.payload.metabolism) || {};
    return meta.convergence || null;
  }
  // Check payload-level convergence
  const payload = entry.payload || {};
  if (payload.event_type === "cooling.receipt" || payload.event_type === "cooling.receipt") {
    const meta = payload.metabolism || {};
    return meta.convergence || null;
  }
  return null;
}

function main() {
  const result = readSealChain(SEAL_CHAIN_PATH);
  if (!result.ok) {
    console.error(JSON.stringify({ error: result.error, status: "FAILED" }));
    process.exit(1);
  }

  const { entries } = result;

  // Filter cooling receipts
  const coolingEntries = entries.filter((e) => {
    const conv = classifyConvergence(e);
    return conv !== null;
  });

  if (coolingEntries.length === 0) {
    console.log(
      JSON.stringify(
        {
          status: "OK",
          total_coolings: 0,
          current_streak: null,
          needs_escalation: false,
          message: "No cooling receipts found in seal chain",
        },
        null,
        2
      )
    );
    return;
  }

  // Track consecutive DIVERGING from the most recent entries
  let divergingStreak = 0;
  let otherStreak = 0;
  let currentConvergence = null;
  const triggerSeqs = [];
  let streakStarted = false;

  // Process in reverse (most recent first)
  for (let i = coolingEntries.length - 1; i >= 0; i--) {
    const e = coolingEntries[i];
    const conv = classifyConvergence(e);

    if (!conv) continue;

    if (!streakStarted) {
      currentConvergence = conv;
      streakStarted = true;
    }

    if (conv !== currentConvergence) break;

    if (conv === "DIVERGING") {
      divergingStreak++;
      triggerSeqs.push(e.seq || e.entry_seq || i);
    } else if (conv === "CONVERGING" || conv === "STABLE" || conv === "first_cooling") {
      otherStreak++;
    }
  }

  const needsEscalation = divergingStreak >= THRESHOLD;
  const escalation = needsEscalation
    ? {
        type: "F13_SOVEREIGN",
        message: `${divergingStreak} consecutive DIVERGING cooling receipts detected. Pattern escalation threshold (${THRESHOLD}) reached. Must escalate to Arif (F13) for sovereign decision.`,
        trigger_seqs: triggerSeqs.slice(0, THRESHOLD),
        convergence_path: divergingStreak,
        recommendation:
          "Route to arif_judge with F13_SOVEREIGN required_authority. Each DIVERGING cooling indicates increasing drift from original SEAL intent.",
      }
    : null;

  const output = {
    status: needsEscalation ? "ESCALATION_REQUIRED" : "OK",
    total_coolings: coolingEntries.length,
    last_cooling_seq:
      coolingEntries[coolingEntries.length - 1]?.seq || "unknown",
    current_streak: {
      type: divergingStreak > 0 ? "DIVERGING" : currentConvergence,
      count: Math.max(divergingStreak, otherStreak),
      diverging_count: divergingStreak,
      converging_count: otherStreak,
    },
    threshold: THRESHOLD,
    needs_escalation: needsEscalation,
    escalation: escalation,
    run_mode: DRY_RUN ? "dry_run" : "live",
    timestamp: new Date().toISOString(),
  };

  // Fix the variable name typo above
  output.current_streak.type =
    divergingStreak > 0 ? "DIVERGING" : currentConvergence;

  // If not dry run and escalation needed, write F13 escalation marker
  if (needsEscalation && !DRY_RUN) {
    try {
      const dir = path.dirname(F13_SEAL_CHAIN_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const marker = `\n---\n## F13 Escalation — ${new Date().toISOString()}\n\n**Reason:** ${divergingStreak}× consecutive DIVERGING cooling receipts\n**Trigger seqs:** ${triggerSeqs.slice(0, THRESHOLD).join(", ")}\n**Convergence count:** ${divergingStreak}\n\nThis is an automatic F13 escalation per COOLING_RECEIPT_SPEC_v1.md §7: "3× DIVERGING → F13 regardless of individual severity."\n\n**Current drift path:** ${divergingStreak} cooling cycles showing increasing divergence from original SEAL intent.\n**Recommendation:** Arif must decide: (a) ratify the divergence as new intent, (b) issue corrective SEAL, or (c) HOLD for evidence.\n`;

      fs.appendFileSync(F13_SEAL_CHAIN_PATH, marker, "utf-8");
      output.escalation_written_to = F13_SEAL_CHAIN_PATH;
    } catch (err) {
      output.escalation_write_error = err.message;
    }
  }

  console.log(JSON.stringify(output, null, 2));

  // Exit with code if escalation needed
  if (needsEscalation) {
    process.exit(2); // Exit code 2 = escalation needed
  }
}

main();
