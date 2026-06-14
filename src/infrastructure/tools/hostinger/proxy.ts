/**
 * Hostinger MCP Proxy — A-FORGE middleware
 * ═══════════════════════════════════════════════════════
 * directive: HOSTINGER-MCP-ACCESS-2026-06-13 (F13 SOVEREIGN)
 * purpose:   Enforces tool whitelist, lane checks, anti-hantu blocks.
 *            Sits between opencode agents and hostinger-vps-mcp.
 * authority: F13 SOVEREIGN — Arif Fazil
 * ═══════════════════════════════════════════════════════
 */

// ── TOOL WHITELIST (from F13 directive §3) ──────────────────────
const OBSERVE_TOOLS = new Set([
  "VPS_getVirtualMachinesV1",
  "VPS_getMetricsV1",
  "VPS_getBackupsV1",
  "VPS_getFirewallListV1",
  "VPS_getPublicKeysV1",
  "VPS_getActionsV1",
  "VPS_getSnapshotsV1",
  "VPS_getProjectListV1",
  "VPS_getProjectContainersV1",
  "VPS_getScanMetricsV1",
  "VPS_getDataCenterListV1",
  "VPS_getTemplatesV1",
  "VPS_getPostInstallScriptsV1",
]);

const MUTATE_REVERSIBLE_TOOLS = new Set([
  "VPS_restartVirtualMachineV1",
  "VPS_createSnapshotV1",
  "VPS_startVirtualMachineV1",
  "VPS_stopVirtualMachineV1",
  "VPS_attachPublicKeyV1",
]);

const MUTATE_HIGH_RISK_TOOLS = new Set([
  "VPS_resizeVirtualMachineV1",
  "VPS_recreateVirtualMachineV1",
  "VPS_deleteSnapshotV1",
  "VPS_restoreSnapshotV1",
  "VPS_setRootPasswordV1",
  "VPS_activateFirewallV1",
  "VPS_deactivateFirewallV1",
  "VPS_startRecoveryModeV1",
  "VPS_setPanelPasswordV1",
]);

const ANTI_HANTU_TOOLS = new Set([
  "VPS_recreateVirtualMachineV1",    // wipes entire VPS
  "VPS_deleteSnapshotV1",            // destroys backup
  "VPS_resizeVirtualMachineV1",      // changes plan (spend)
  "VPS_purchaseNewVirtualMachineV1", // spends money
  "VPS_setPanelPasswordV1",          // lockout risk
]);

// ── ALLOWED ACTOR LANES (from F13 directive §1) ──────────────
const ACTOR_LANES: Record<string, string[]> = {
  "openclaw.a2a.agent":    ["OBSERVE", "PROPOSE"],
  "hermes.telegram.agent": ["OBSERVE", "PROPOSE"],
  "arifOS.integrator":     ["OBSERVE", "PROPOSE", "EXECUTE"],
};

/**
 * Classify a tool by risk.
 */
function classifyTool(name: string): "OBSERVE" | "MUTATE_REVERSIBLE" | "MUTATE_HIGH_RISK" | "ANTI_HANTU" | "UNKNOWN" {
  if (ANTI_HANTU_TOOLS.has(name)) return "ANTI_HANTU";
  if (OBSERVE_TOOLS.has(name)) return "OBSERVE";
  if (MUTATE_REVERSIBLE_TOOLS.has(name)) return "MUTATE_REVERSIBLE";
  if (MUTATE_HIGH_RISK_TOOLS.has(name)) return "MUTATE_HIGH_RISK";
  return "UNKNOWN";
}

/**
 * Get the actor's current lane.
 */
function getActorLane(actorId: string): string[] {
  return ACTOR_LANES[actorId] || [];
}

/**
 * Decide whether a tool call is allowed.
 * Returns {allowed, reason, requires_lease, requires_judge, requires_888}
 */
export function authorize(
  toolName: string,
  actorId: string,
  _vmId?: number
): { allowed: boolean; reason: string; requires_lease: boolean; requires_judge: boolean; requires_888: boolean } {
  const toolClass = classifyTool(toolName);
  const lanes = getActorLane(actorId);

  // ── ANTI-HANTU: NEVER allowed ──
  if (toolClass === "ANTI_HANTU") {
    return {
      allowed: false,
      reason: `ANTI_HANTU: ${toolName} is HARAM — never callable by any agent. F1 AMANAH + F9 ANTIHANTU. 888 required.`,
      requires_lease: false,
      requires_judge: false,
      requires_888: true,
    };
  }

  // ── UNKNOWN: tool not in whitelist ──
  if (toolClass === "UNKNOWN") {
    return {
      allowed: false,
      reason: `UNKNOWN: ${toolName} is not in the F13-approved whitelist. Add to directive to enable.`,
      requires_lease: false,
      requires_judge: false,
      requires_888: true,
    };
  }

  // ── OBSERVE: always allowed ──
  if (toolClass === "OBSERVE") {
    return {
      allowed: true,
      reason: `OBSERVE: ${toolName} — read-only, zero risk. Always available.`,
      requires_lease: false,
      requires_judge: false,
      requires_888: false,
    };
  }

  // ── MUTATE_REVERSIBLE: needs EXECUTE lane + lease + judge ──
  if (toolClass === "MUTATE_REVERSIBLE") {
    if (!lanes.includes("EXECUTE")) {
      return {
        allowed: false,
        reason: `LANE: ${toolName} requires EXECUTE lane. ${actorId} has: ${lanes.join(", ")}. PROPOSE is advisory only.`,
        requires_lease: true,
        requires_judge: true,
        requires_888: false,
      };
    }
    return {
      allowed: true,
      reason: `MUTATE_REVERSIBLE: ${toolName} — allowed for EXECUTE lane. Requires lease + judge deliberation.`,
      requires_lease: true,
      requires_judge: true,
      requires_888: false,
    };
  }

  // ── MUTATE_HIGH_RISK: requires 888 ──
  if (toolClass === "MUTATE_HIGH_RISK") {
    return {
      allowed: false,
      reason: `MUTATE_HIGH_RISK: ${toolName} — requires Arif\'s explicit 888 approval. No agent may auto-execute.`,
      requires_lease: false,
      requires_judge: false,
      requires_888: true,
    };
  }

  return { allowed: false, reason: "UNKNOWN", requires_lease: false, requires_judge: false, requires_888: true };
}

/**
 * Filter tools/list response to only show whitelisted tools.
 */
export function filterToolsList(allTools: Array<{name: string; description?: string}>): Array<{name: string; description?: string}> {
  return allTools.filter(t => {
    const cls = classifyTool(t.name);
    return cls === "OBSERVE" || cls === "MUTATE_REVERSIBLE" || cls === "MUTATE_HIGH_RISK";
  });
}

// ── EXPORT ─────────────────────────────────────────────────────
export { OBSERVE_TOOLS, MUTATE_REVERSIBLE_TOOLS, MUTATE_HIGH_RISK_TOOLS, ANTI_HANTU_TOOLS, ACTOR_LANES };
