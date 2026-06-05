/**
 * ModelCapabilityGate — Spine Consumption Layer (A-FORGE Execution Gate)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Thin, fast, non-deliberative check against the model governance card
 * from the arifOS-model-registry spine. This is the SECONDARY gate —
 * constitutional enforcement happens in arifOS MCP (888_JUDGE).
 * This gate enforces runtime truth: does the live model have the
 * concrete capabilities to execute this specific action?
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModelGovernanceCard {
  model_anchor?: {
    provider_key?: string;
    family_key?: string;
    model_variant?: string;
    identity_verified?: boolean;
  };
  runtime_truth?: {
    tools?: string[];
    execution_mode?: string;
    side_effects_allowed?: boolean;
  };
  risk_leash?: {
    risk_tier?: string;
    requires_human_ack_for?: string[];
  };
  drift_state?: "GREEN" | "YELLOW" | "RED";
  capabilities?: {
    supports_tools?: boolean;
    supports_web?: boolean;
    supports_files?: boolean;
    has_memory?: boolean;
  };
  model_cascade?: Record<string, { provider: string; model: string; role: string }>;
}

export interface CapabilityCheckResult {
  allowed: boolean;
  verdict: "PROCEED" | "HOLD" | "BLOCK";
  reason?: string;
  requiresHumanAck?: boolean;
}

// ── Forbidden action patterns per model capability set ──────────────────────

const FORBIDDEN_ACTIONS: Record<string, string[]> = {
  // Actions that require specific capabilities
  deploy: ["code", "agentic", "deploy"],
  "git_push": ["code", "agentic"],
  "git_commit": ["code"],
  execute: ["code", "agentic"],
  seal: ["agentic"],
  delete: [],
  irreversible: [],
};

const HUMAN_ACK_TRIGGERS = [
  "irreversible_delete",
  "git_push",
  "external_relay",
  "vault_seal",
  "deploy",
  "force_push",
];

// ── Spine reader ─────────────────────────────────────────────────────────────

let cachedCard: ModelGovernanceCard | null = null;

export function readGovernanceCard(): ModelGovernanceCard | null {
  if (cachedCard) {
    return cachedCard;
  }

  // 1. Fast path: Direct read from the canonical registry path
  const canonicalPath = "/root/arifos-model-registry/runtime_profiles/vps_main_arifos.json";
  if (existsSync(canonicalPath)) {
    try {
      const raw = readFileSync(canonicalPath, "utf-8");
      const spine = JSON.parse(raw);
      cachedCard = {
        model_anchor: {
          provider_key: spine.provider_key,
          family_key: spine.family_key,
          model_variant: spine.model_id,
          identity_verified: true,
        },
        runtime_truth: {
          tools: spine.tools_live || [],
          execution_mode: spine.execution_mode,
          side_effects_allowed: spine.side_effects_allowed,
        },
        risk_leash: {
          risk_tier: "bounded",
          requires_human_ack_for: [
            "irreversible_delete",
            "git_push",
            "external_relay",
            "vault_seal",
          ],
        },
        drift_state: "GREEN",
        capabilities: spine.capabilities,
        model_cascade: spine.model_cascade,
      };
      return cachedCard;
    } catch (e) {
      // Direct read failed (e.g. malformed JSON), fall back to python call
    }
  }

  // 2. Fallback path: Python execSync with increased timeout (10s)
  try {
    const json = execSync(
      `python3 -c "
import json
from arifosmcp.runtime.registry import RUNTIME_PATH
print(json.dumps(json.load(open(RUNTIME_PATH / 'vps_main_arifos.json'))))
"`,
      { encoding: "utf-8", timeout: 10000, cwd: "/root/arifOS" }
    );
    const spine = JSON.parse(json);
    cachedCard = {
      model_anchor: {
        provider_key: spine.provider_key,
        family_key: spine.family_key,
        model_variant: spine.model_id,
        identity_verified: true,
      },
      runtime_truth: {
        tools: spine.tools_live || [],
        execution_mode: spine.execution_mode,
        side_effects_allowed: spine.side_effects_allowed,
      },
      risk_leash: {
        risk_tier: "bounded",
        requires_human_ack_for: [
          "irreversible_delete",
          "git_push",
          "external_relay",
          "vault_seal",
        ],
      },
      drift_state: "GREEN",
      capabilities: spine.capabilities,
      model_cascade: spine.model_cascade,
    };
    return cachedCard;
  } catch {
    // No spine — check for terminal override (env var)
    // In terminal mode, the human IS the gate — no registry needed
    if (process.env.AFORGE_TERMINAL_MODE === "1") {
      cachedCard = {
        model_anchor: {
          provider_key: "aforge",
          family_key: "terminal",
          model_variant: "operator",
          identity_verified: false,
        },
        runtime_truth: {
          tools: ["read", "write", "edit", "shell", "search"],
          execution_mode: "governed",
          side_effects_allowed: false,
        },
        risk_leash: {
          risk_tier: "bounded",
          requires_human_ack_for: ["irreversible_delete", "git_push", "vault_seal"],
        },
        drift_state: "GREEN",
        capabilities: {
          supports_tools: true,
          supports_web: false,
          supports_files: true,
          has_memory: false,
        },
      };
      return cachedCard;
    }
    return null;
  }
}

// ── Capability check ─────────────────────────────────────────────────────────

export function checkModelCapability(
  action: string,
  options?: {
    riskLevel?: string;
    ackIrreversible?: boolean;
    intentModel?: string;
  }
): CapabilityCheckResult {
  const card = readGovernanceCard();

  // No spine — dead stop
  if (!card) {
    return {
      allowed: false,
      verdict: "BLOCK",
      reason: "SPINE_UNAVAILABLE: No model governance card. Execution blocked. Contact sovereign.",
    };
  }

  // RED drift — block everything
  if (card.drift_state === "RED") {
    return {
      allowed: false,
      verdict: "BLOCK",
      reason: "DRIFT_RED: Model governance spine reports no valid anchor. Execution blocked.",
    };
  }

  const riskLeash = card.risk_leash;
  const actionLower = action.toLowerCase();

  // Check requires_human_ack_for
  for (const ackTrigger of HUMAN_ACK_TRIGGERS) {
    if (actionLower.includes(ackTrigger)) {
      const modelRequires = riskLeash?.requires_human_ack_for || [];
      const needsAck = modelRequires.some((t) =>
        actionLower.includes(t)
      );
      if (needsAck && !options?.ackIrreversible) {
        return {
          allowed: false,
          verdict: "HOLD",
          reason: `HUMAN_ACK_REQUIRED: Action "${action}" requires human acknowledgment for model ${card.model_anchor?.model_variant || "unknown"}. Set ackIrreversible: true.`,
          requiresHumanAck: true,
        };
      }
    }
  }

  // YELLOW drift — warn but allow
  if (card.drift_state === "YELLOW") {
    process.stderr.write(
      `[SPINE] YELLOW drift — model identity mismatch. Proceeding with caution.\n`
    );
    return {
      allowed: true,
      verdict: "PROCEED",
      reason: "SPINE_YELLOW: Drift detected but not blocking. Model identity may be stale.",
    };
  }

  // GREEN — proceed
  return { allowed: true, verdict: "PROCEED" };
}

/**
 * Check if the model's runtime_truth permits execution mode.
 * Called before code execution or deploy steps.
 */
export function checkExecutionMode(card?: ModelGovernanceCard | null): CapabilityCheckResult {
  const gc = card || readGovernanceCard();
  if (!gc) {
    return { allowed: false, verdict: "BLOCK", reason: "SPINE_UNAVAILABLE" };
  }

  const mode = gc.runtime_truth?.execution_mode;
  if (mode === "governed" && gc.runtime_truth?.side_effects_allowed === false) {
    return {
      allowed: false,
      verdict: "HOLD",
      reason: "SIDE_EFFECTS_BLOCKED: Model governance card prohibits side effects. Requires human gate.",
      requiresHumanAck: true,
    };
  }

  return { allowed: true, verdict: "PROCEED" };
}
