/**
 * sroAdmissibility.ts — SRO v1 read gate (TS port).
 *
 * Canonical gate: arifosmcp/memory/admissibility.py (arifOS). This port gives
 * the A-FORGE forge_memory tool the same admissibility semantics without a
 * cross-language bridge: uniform schema ≠ uniform truth — an EXPIRED memory
 * is structurally valid and still not admissible for operational recall.
 *
 * Policy SOT: /root/arifOS/config/memory-admissibility-policy.yaml.
 * This port consumes the canonical JSON TWIN (memory-admissibility-policy.json)
 * because A-FORGE pins no YAML parser dependency (supply-chain gate). The twin
 * is drift-guarded by arifOS tests (test_policy_json_twin_matches_yaml_sot).
 *
 * Gate scope: collections under the SRO contract. Today that is arifos_memory
 * (99/99 points SRO v1, migrated 2026-09-12). Other collections pass through
 * until they migrate — progressive scope, honestly reported.
 *
 * DITEMPA BUKAN DIBERI ⚒️
 */

import { readFileSync } from "node:fs";

export interface AdmissibilityDecision {
  admitted: boolean;
  reasonCode: string | null;
  effectiveStatus: string | null;
  label: string | null;
}

interface ModeCfg {
  admit_statuses?: string[];
  permit_superseded?: boolean;
  min_confidence?: number | null;
  label?: string;
}

export interface AdmissibilityPolicy {
  policy_version?: number;
  sro_schema_version?: number;
  status_vocabulary?: string[];
  temporal?: { enforce_expires_at?: boolean };
  modes?: Record<string, ModeCfg>;
}

export const POLICY_JSON_PATH =
  process.env.MEMORY_ADMISSIBILITY_POLICY_JSON ||
  "/root/arifOS/config/memory-admissibility-policy.json";

/** Collections under the SRO v1 contract — gated. Others pass through. */
export const SRO_GATED_COLLECTIONS = new Set(["arifos_memory"]);

// Fail-safe: identical semantics to the shipped YAML default mode. Used only
// when the twin is missing/corrupt so recall degrades strict, never open.
const FAILSAFE_POLICY: AdmissibilityPolicy = {
  policy_version: 0,
  sro_schema_version: 1,
  status_vocabulary: ["ACTIVE", "STALE", "EXPIRED", "SUPERSEDED"],
  temporal: { enforce_expires_at: true },
  modes: {
    default: { admit_statuses: ["ACTIVE"], permit_superseded: false, min_confidence: null },
    historical: {
      admit_statuses: ["ACTIVE", "STALE", "EXPIRED", "SUPERSEDED"],
      permit_superseded: true,
      min_confidence: null,
      label: "HISTORICAL",
    },
  },
};

let cachedPolicy: AdmissibilityPolicy | null = null;

export function loadPolicy(): AdmissibilityPolicy {
  if (cachedPolicy) return cachedPolicy;
  try {
    const parsed = JSON.parse(readFileSync(POLICY_JSON_PATH, "utf-8")) as AdmissibilityPolicy;
    if (!parsed?.modes || !parsed?.status_vocabulary) throw new Error("missing modes/status_vocabulary");
    cachedPolicy = parsed;
  } catch {
    // Loud in output, strict in behavior — policy IO failure never opens the gate.
    cachedPolicy = { ...FAILSAFE_POLICY };
  }
  return cachedPolicy;
}

function parseIso(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function evaluateSro(
  payload: Record<string, unknown> | null | undefined,
  mode: string,
  policy?: AdmissibilityPolicy,
  now?: Date,
): AdmissibilityDecision {
  const pol = policy ?? loadPolicy();
  const at = now ?? new Date();

  const modeCfg = pol.modes?.[mode];
  if (!modeCfg) return { admitted: false, reasonCode: "MODE_UNKNOWN", effectiveStatus: null, label: null };

  const sro = payload?.["sro"];
  if (typeof sro !== "object" || sro === null || Array.isArray(sro)) {
    return { admitted: false, reasonCode: "SRO_MISSING", effectiveStatus: null, label: null };
  }
  const s = sro as Record<string, unknown>;

  if (s["sro_version"] !== (pol.sro_schema_version ?? 1)) {
    return { admitted: false, reasonCode: "SRO_VERSION_MISMATCH", effectiveStatus: null, label: null };
  }

  const expiry = s["expiry"];
  if (typeof expiry !== "object" || expiry === null || Array.isArray(expiry)) {
    return { admitted: false, reasonCode: "MALFORMED_SRO", effectiveStatus: null, label: null };
  }
  const e = expiry as Record<string, unknown>;

  const status = e["status"];
  if (typeof status !== "string" || !(pol.status_vocabulary ?? []).includes(status)) {
    return { admitted: false, reasonCode: "MALFORMED_SRO", effectiveStatus: null, label: null };
  }

  // Temporal guard — status can lie (temporal drift); time cannot.
  let effective = status;
  if (
    status === "ACTIVE" &&
    (pol.temporal?.enforce_expires_at ?? true)
  ) {
    const exp = parseIso(e["expires_at"]);
    if (exp !== null && exp < at) effective = "EXPIRED";
  }

  const sup = s["supersession"];
  const supersededBy =
    typeof sup === "object" && sup !== null ? (sup as Record<string, unknown>)["superseded_by"] : null;
  const wasSuperseded = Boolean(supersededBy) || status === "SUPERSEDED" || effective === "SUPERSEDED";
  if (wasSuperseded && !(modeCfg.permit_superseded ?? false)) {
    return { admitted: false, reasonCode: "SUPERSEDED", effectiveStatus: "SUPERSEDED", label: null };
  }

  const admit = new Set(modeCfg.admit_statuses ?? []);
  if (!admit.has(effective)) {
    const reason = status === "ACTIVE" && effective === "EXPIRED" ? "EXPIRED_BY_TIME" : "STATUS_NOT_ADMISSIBLE";
    return { admitted: false, reasonCode: reason, effectiveStatus: effective, label: null };
  }

  const minConf = modeCfg.min_confidence;
  const calib = s["calibration"];
  const conf =
    typeof calib === "object" && calib !== null
      ? (calib as Record<string, unknown>)["confidence_at_creation"]
      : null;
  if (typeof minConf === "number" && typeof conf === "number" && conf < minConf) {
    return { admitted: false, reasonCode: "LOW_CONFIDENCE", effectiveStatus: effective, label: null };
  }

  // Historical mode labels only non-current records; ACTIVE stays unlabeled.
  const label =
    modeCfg.label && (effective !== "ACTIVE" || wasSuperseded) ? modeCfg.label : null;
  return { admitted: true, reasonCode: null, effectiveStatus: effective, label };
}

export function emptyRefusals(): Record<string, number> {
  return {};
}

export function countRefusal(refused: Record<string, number>, reasonCode: string): void {
  refused[reasonCode] = (refused[reasonCode] ?? 0) + 1;
}
