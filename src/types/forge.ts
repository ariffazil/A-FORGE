/**
 * ForgeExecutionManifest — the signed diff-manifest that arifOS issues to A-FORGE.
 *
 * A-FORGE never receives raw "write whatever" instructions from a PlannerAgent.
 * It only receives pre-signed ForgeExecutionManifest objects containing unified_diff
 * patches, issued by arifOS after PolicyEnforcer approval and VAULT999 seal.
 */

export interface ForgeFilePatch {
  file_path: string;
  unified_diff: string;
}

export interface ForgeExecutionManifest {
  id: string;
  issued_by: string;
  created_at: string;
  repo_root: string;
  patches: ForgeFilePatch[];
  metadata: {
    intent: string;
    risk_score: number;
    confidence: number;
    reason_codes: string[];
    floors_passed: string[];
  };
}


