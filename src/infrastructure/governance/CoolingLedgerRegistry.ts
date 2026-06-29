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
  return ledgerPath;
}
