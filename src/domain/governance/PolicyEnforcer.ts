/**
 * PolicyEnforcer — pure code, no LLM.
 *
 * Validates a PlannerOutput against a PolicyConfig and returns EnforcementVerdict.
 * Sits between PlannerAgent and EditorWorker: no LLM can bypass it.
 *
 * Hard violations → REJECTED (no bypass)
 * Human-gate conditions → HUMAN_APPROVAL_REQUIRED (888_HOLD)
 * All clear → AUTO_APPROVED
 */

import type { PlannerOutput, ChangeOperation } from "../types/planner.js";
import type {
  PolicyConfig,
  EnforcementVerdict,
  RequireHumanIf,
} from "../types/policy.js";

export type { EnforcementVerdict } from "../types/policy.js";

export function enforcePolicy(
  plannerOutput: PlannerOutput,
  policy: PolicyConfig,
): EnforcementVerdict {
  const reasons: string[] = [];
  const paths = new Set(plannerOutput.proposed_changes.map((c) => c.file_path));

  for (const p of paths) {
    if (!isUnderRoots(p, policy.write_roots)) {
      reasons.push(`PATH_OUTSIDE_ROOT:${p}`);
    }
    if (matchesDeny(p, policy.deny_paths)) {
      reasons.push(`PATH_DENIED:${p}`);
    }
  }

  for (const change of plannerOutput.proposed_changes) {
    if (!policy.allowed_ops.includes(change.operation)) {
      reasons.push(`OP_NOT_ALLOWED:${change.operation}`);
    }
    if (policy.forbidden_ops.includes(change.operation)) {
      reasons.push(`OP_FORBIDDEN:${change.operation}`);
    }
  }

  if (paths.size > policy.max_files_per_run) {
    reasons.push(`TOO_MANY_FILES:${paths.size}`);
  }
  if (plannerOutput.proposed_changes.length > policy.max_write_ops_per_run) {
    reasons.push(`TOO_MANY_OPS:${plannerOutput.proposed_changes.length}`);
  }

  const hasNew = plannerOutput.proposed_changes.some(
    (c) => c.operation === "create_new",
  );
  if (hasNew) {
    const allValid = plannerOutput.proposed_changes
      .filter((c) => c.operation === "create_new")
      .every(
        (c) =>
          (c.retrieval_evidence?.length ?? 0) >=
            policy.new_file_rule.require_retrieval_hits &&
          !!plannerOutput.create_new_file_reason,
      );
    if (!allValid) {
      reasons.push("NEW_FILE_WITHOUT_EVIDENCE_OR_REASON");
    }
  }

  const hardViolations = reasons.filter(
    (r) =>
      r.startsWith("PATH_") ||
      r.startsWith("OP_NOT_ALLOWED") ||
      r.startsWith("OP_FORBIDDEN") ||
      r.startsWith("TOO_MANY_OPS") ||
      r === "NEW_FILE_WITHOUT_EVIDENCE_OR_REASON",
  );
  if (hardViolations.length > 0) {
    return { type: "REJECTED", reason_codes: hardViolations };
  }

  const humanReasons = buildHumanGateReasons(
    plannerOutput,
    paths,
    policy.require_human_if,
    policy.arch_files,
  );
  if (humanReasons.length > 0) {
    return { type: "HUMAN_APPROVAL_REQUIRED", reason_codes: humanReasons };
  }

  return { type: "AUTO_APPROVED" };
}

function isUnderRoots(path: string, roots: string[]): boolean {
  return roots.some((r) => path.startsWith(r));
}

function matchesDeny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => new RegExp(p).test(path));
}

function buildHumanGateReasons(
  plannerOutput: PlannerOutput,
  paths: Set<string>,
  requireHumanIf: RequireHumanIf,
  archFiles: string[],
): string[] {
  const reasons: string[] = [];

  const touchesArch = [...paths].some((p) =>
    archFiles.some((a) => p.includes(a)),
  );
  if (touchesArch) reasons.push("TOUCHES_ARCH_FILES");

  if (plannerOutput.confidence < requireHumanIf.confidence_lt) {
    reasons.push("LOW_CONFIDENCE");
  }

  if (paths.size > requireHumanIf.files_changed_gt) {
    reasons.push("TOO_MANY_FILES_FOR_AUTO");
  }

  if (requireHumanIf.contains_delete) {
    const containsDelete = plannerOutput.proposed_changes.some(
      (c) =>
        c.operation === "patch_apply" &&
        c.unified_diff?.includes("@@ -"),
    );
    if (containsDelete) reasons.push("CONTAINS_DELETE");
  }

  return reasons;
}
