/**
 * ApprovalRouter — orchestrates PolicyEnforcer → ApprovalBoundary → EditorWorker.
 *
 * Takes PlannerOutput + PolicyConfig, runs enforcePolicy(), then:
 *   REJECTED              → return rejection reasons
 *   HUMAN_APPROVAL_REQUIRED → stage in ApprovalBoundary, return holdId + summary
 *   AUTO_APPROVED         → apply patches via EditorWorker, return results
 *
 * The WAITING_FOR_HUMAN path is synchronous — the caller (MCP tool / CLI) gets
 * a holdId and must poll ApprovalBoundary.getHoldItem(holdId) for the human's
 * decision. On APPROVED, the caller re-invokes routeApproval() with the
 * same PlannerOutput + forceApply=true to bypass the human gate.
 */

import { enforcePolicy } from "../governance/PolicyEnforcer.js";
import type { ApprovalOutcome, PatchResult, PolicyConfig } from "../types/policy.js";
import type { PlannerOutput, ProposedChange } from "../types/planner.js";
import { applyPatches, type PatchRequest } from "../tools/EditorTools.js";
import { getApprovalBoundary, type ActionPreview } from "./ApprovalBoundary.js";

export interface RouteApprovalOptions {
  forceApply?: boolean;
}

export async function routeApproval(
  plannerOutput: PlannerOutput,
  policy: PolicyConfig,
  options: RouteApprovalOptions = {},
): Promise<ApprovalOutcome> {
  const verdict = enforcePolicy(plannerOutput, policy);

  if (verdict.type === "REJECTED") {
    return { type: "REJECTED", reason_codes: verdict.reason_codes };
  }

  if (verdict.type === "HUMAN_APPROVAL_REQUIRED") {
    const boundary = getApprovalBoundary();
    const preview = buildActionPreview(plannerOutput, verdict.reason_codes);
    const reasonCodes = verdict.reason_codes;

    const item = boundary.stageAction(
      buildDescription(plannerOutput),
      preview,
      JSON.stringify(plannerOutput, null, 2),
      `planner_${Date.now()}`,
    );

    if (item.state === "ready") {
      const patches = plannerOutputToPatchRequests(plannerOutput);
      const results = await applyPatches(patches);
      boundary.markExecuted(item.holdId, results.every((r) => r.applied) ? "success" : "partial");
      return { type: "AUTO_APPLIED", results };
    }

    return {
      type: "WAITING_FOR_HUMAN",
      holdId: item.holdId,
      summary: buildChangeSummary(plannerOutput, reasonCodes),
      changes: plannerOutput.proposed_changes,
      reason_codes: reasonCodes,
    };
  }

  if (options.forceApply) {
    const patches = plannerOutputToPatchRequests(plannerOutput);
    const results = await applyPatches(patches);
    return { type: "AUTO_APPLIED", results };
  }

  const patches = plannerOutputToPatchRequests(plannerOutput);
  const results = await applyPatches(patches);
  return { type: "AUTO_APPLIED", results };
}

function buildActionPreview(
  plannerOutput: PlannerOutput,
  reasonCodes: string[],
): ActionPreview {
  const modifications = plannerOutput.proposed_changes.map((c) => {
    let op: "create" | "modify" | "delete" = "modify";
    if (c.operation === "create_new") op = "create";
    if (c.operation === "patch_apply" && c.unified_diff?.includes("@@ -")) op = "delete";

    return {
      path: c.file_path,
      operation: op,
      preview: c.unified_diff?.slice(0, 200) ?? c.append_text?.slice(0, 200),
    };
  });

  const riskLevel = computeRiskLevel(plannerOutput, reasonCodes);

  return {
    whatWillHappen: `Apply ${plannerOutput.proposed_changes.length} change(s) to ${new Set(plannerOutput.proposed_changes.map((c) => c.file_path)).size} file(s)`,
    sideEffects: reasonCodes.map((r) => `Policy gate: ${r}`),
    modifications,
    rollbackPlan: buildRollbackPlan(plannerOutput),
    riskAssessment: {
      level: riskLevel,
      concerns: reasonCodes.map((r) => `Policy reason: ${r}`),
      mitigations: buildMitigations(plannerOutput),
    },
    reasoning: plannerOutput.intent,
  };
}

function buildDescription(plannerOutput: PlannerOutput): string {
  const fileCount = new Set(plannerOutput.proposed_changes.map((c) => c.file_path)).size;
  const ops = plannerOutput.proposed_changes.map((c) => c.operation).filter((v, i, a) => a.indexOf(v) === i);
  return `[Planner] ${plannerOutput.intent.slice(0, 80)} — ${ops.join(", ")} on ${fileCount} file(s)`;
}

function buildChangeSummary(plannerOutput: PlannerOutput, reasonCodes: string[]): string {
  const lines: string[] = [];
  lines.push(`Intent: ${plannerOutput.intent}`);
  lines.push(`Confidence: ${plannerOutput.confidence} | Risk: ${plannerOutput.risk_score}`);
  lines.push(`Reason codes: ${reasonCodes.join(", ")}`);
  lines.push("");
  lines.push("Proposed changes:");
  for (const change of plannerOutput.proposed_changes) {
    lines.push(`  [${change.operation}] ${change.file_path}`);
    if (change.rationale) lines.push(`    rationale: ${change.rationale}`);
    if (change.retrieval_evidence.length > 0) {
      lines.push(`    consulted: ${change.retrieval_evidence.slice(0, 3).join(", ")}`);
    }
  }
  return lines.join("\n");
}

function computeRiskLevel(
  plannerOutput: PlannerOutput,
  reasonCodes: string[],
): ActionPreview["riskAssessment"]["level"] {
  const hasDelete = reasonCodes.includes("CONTAINS_DELETE");
  const hasArch = reasonCodes.includes("TOUCHES_ARCH_FILES");
  const hasLowConfidence = reasonCodes.includes("LOW_CONFIDENCE");
  const hasManyFiles = reasonCodes.includes("TOO_MANY_FILES_FOR_AUTO");
  const newFiles = plannerOutput.proposed_changes.some((c) => c.operation === "create_new");

  if (hasDelete || hasArch) return "critical";
  if (hasLowConfidence && hasManyFiles) return "high";
  if (newFiles) return "medium";
  if (hasManyFiles || hasLowConfidence) return "medium";
  return "low";
}

function buildMitigations(plannerOutput: PlannerOutput): string[] {
  const mitigations: string[] = [];
  if (plannerOutput.confidence >= 0.7) mitigations.push("Planner confidence >= 0.7");
  if (plannerOutput.proposed_changes.every((c) => c.retrieval_evidence.length > 0)) {
    mitigations.push("All changes grounded in retrieval evidence");
  }
  if (!plannerOutput.proposed_changes.some((c) => c.operation === "create_new")) {
    mitigations.push("No new files will be created");
  }
  return mitigations;
}

function buildRollbackPlan(plannerOutput: PlannerOutput): string {
  return `Revert ${plannerOutput.proposed_changes.length} patch(es) via git checkout`;
}

function plannerOutputToPatchRequests(plannerOutput: PlannerOutput): PatchRequest[] {
  return plannerOutput.proposed_changes
    .filter((c): c is ProposedChange & { unified_diff: string } =>
      c.operation === "patch_apply" && !!c.unified_diff,
    )
    .map((c) => ({
      file_path: c.file_path,
      unified_diff: c.unified_diff,
    }));
}
