import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_COOLING_LEDGER_DIR = "/root/AAA/registries/cooling_ledger";

export interface CoolingLedgerRecordParams {
  sessionId: string;
  task: string;
  verdict: "SABAR" | "HOLD";
  riskLevel: "low" | "medium" | "high" | "critical";
  intentModel: string;
  message: string;
  signal?: string | null;
  truthStatus?: string | null;
  freshnessBand?: string | null;
  stateAgeHours?: number | null;
  source?: string | null;
  cooldownEntryId: string;
}

export function recordCoolingLedgerEvent(params: CoolingLedgerRecordParams): string {
  const ledgerDir = process.env.COOLING_LEDGER_DIR ?? DEFAULT_COOLING_LEDGER_DIR;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const ledgerPath = `${ledgerDir}/well-runtime-${day}.md`;

  mkdirSync(dirname(ledgerPath), { recursive: true });
  if (!existsSync(ledgerDir)) {
    mkdirSync(ledgerDir, { recursive: true });
  }

  if (!existsSync(ledgerPath)) {
    const header = [
      "---",
      `date: ${day}`,
      "organ: WELL",
      "lane: A-FORGE runtime cooling",
      "status: live",
      "---",
      "",
    ].join("\n");
    appendFileSync(ledgerPath, header, "utf-8");
  }

  const existing = readFileSync(ledgerPath, "utf-8");
  const ordinal = (existing.match(/^## WELL Runtime Cooling Event/mg) ?? []).length + 1;
  const lines = [
    `## WELL Runtime Cooling Event ${ordinal}`,
    `- observed_at: ${now.toISOString()}`,
    `- cooldown_entry_id: ${params.cooldownEntryId}`,
    `- session_id: ${params.sessionId}`,
    `- verdict: ${params.verdict}`,
    `- risk_level: ${params.riskLevel}`,
    `- intent_model: ${params.intentModel}`,
    `- signal: ${params.signal ?? "NONE"}`,
    `- truth_status: ${params.truthStatus ?? "UNKNOWN"}`,
    `- freshness_band: ${params.freshnessBand ?? "UNKNOWN"}`,
    `- state_age_hours: ${params.stateAgeHours ?? "UNKNOWN"}`,
    `- source: ${params.source ?? "UNKNOWN"}`,
    `- task: ${params.task.replace(/\s+/g, " ").trim().slice(0, 500)}`,
    `- message: ${params.message.replace(/\s+/g, " ").trim()}`,
    "",
  ];
  appendFileSync(ledgerPath, `${lines.join("\n")}\n`, "utf-8");

  // P1-5d: Forward cooling ledger event to arifFLOW — fire-and-forget
  setImmediate(() => {
    _forwardCoolingToArifFlow(params, day, ordinal).catch(() => {});
  });

  return ledgerPath;
}

/**
 * P1-5d: Forward cooling ledger event to arifFLOW :7073/receipt/emit.
 * Fire-and-forget — failure is silent, local markdown ledger is canonical.
 * DEPRECATED P1-7: will be replaced by arifFLOW client import post-extraction.
 */
async function _forwardCoolingToArifFlow(
  params: CoolingLedgerRecordParams,
  day: string,
  ordinal: number,
): Promise<void> {
  try {
    await fetch("http://127.0.0.1:7073/receipt/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organ: "A-FORGE",
        producer: "CoolingLedgerRegistry",
        action: "cooling_ledger",
        scope: `well-runtime:${day}`,
        risk: "INTERNAL",
        epistemic_label: "OBS",
        session_id: params.sessionId,
        verdict: params.verdict,
        metadata: {
          cooldown_entry_id: params.cooldownEntryId,
          risk_level: params.riskLevel,
          ordinal,
          task: params.task.slice(0, 500),
          source: params.source,
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // arifFLOW unreachable — local markdown ledger is canonical
  }
}
