/**
 * Policy configuration and enforcement verdict types.
 *
 * PolicyConfig is loaded at startup (or from env/JSON) and passed to
 * PolicyEnforcer.enforcePolicy() — a pure function with no LLM dependency.
 */

import type { ChangeOperation } from "./planner.js";

export interface RequireHumanIf {
  files_changed_gt: number;
  contains_delete: boolean;
  touches_arch_files: boolean;
  confidence_lt: number;
}

export interface NewFileRule {
  require_retrieval_hits: number;
  require_justification: boolean;
}

export interface PolicyConfig {
  write_roots: string[];
  deny_paths: string[];
  allowed_ops: ChangeOperation[];
  forbidden_ops: string[];
  max_files_per_run: number;
  max_write_ops_per_run: number;
  require_human_if: RequireHumanIf;
  new_file_rule: NewFileRule;
  arch_files: string[];
}

export type EnforcementVerdict =
  | { type: "REJECTED"; reason_codes: string[] }
  | { type: "HUMAN_APPROVAL_REQUIRED"; reason_codes: string[] }
  | { type: "AUTO_APPROVED" };

export type ApprovalOutcome =
  | { type: "AUTO_APPLIED"; results: PatchResult[] }
  | { type: "WAITING_FOR_HUMAN"; holdId: string; summary: string; changes: import("./planner.js").ProposedChange[]; reason_codes: string[] }
  | { type: "REJECTED"; reason_codes: string[] };

export interface PatchResult {
  file_path: string;
  applied: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Default policy config — permissive enough for development, safe for production.
 * Override by passing a custom PolicyConfig to routeApproval().
 */
export const defaultPolicyConfig: PolicyConfig = {
  write_roots: ["src/", "lib/", "agents/", "tools/", "governance/", "memory/", "approval/"],
  deny_paths: ["**/.env", "**/secrets/**", "**/credentials/**", "**/id_rsa", "**/id_ed25519"],
  allowed_ops: ["patch_apply", "append", "create_new"],
  forbidden_ops: [],
  max_files_per_run: 10,
  max_write_ops_per_run: 20,
  require_human_if: {
    files_changed_gt: 5,
    contains_delete: true,
    touches_arch_files: true,
    confidence_lt: 0.6,
  },
  new_file_rule: {
    require_retrieval_hits: 1,
    require_justification: true,
  },
  arch_files: ["package.json", "tsconfig.json", "Makefile", "docker-compose.yml", ".env"],
};
