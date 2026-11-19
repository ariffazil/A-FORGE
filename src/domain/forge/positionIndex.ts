export interface PositionEntry { actor: string; role: string; authority_ceiling: string; owner: string; sourced_from: string; expires_on: string; scope: string; }
export const POSITION_INDEX: PositionEntry[] = [
  { actor: "arif", role: "F13 sovereign", authority_ceiling: "SOVEREIGN", owner: "AAA/instructions/arif-human-principal.md", sourced_from: "/root/AAA/lanes/people.yaml", expires_on: "2099-12-31T23:59:59Z", scope: "final veto + consequence-bearing acceptance" },
  { actor: "arifOS", role: "constitutional judge", authority_ceiling: "888_APEX", owner: "arifOS/AGENTS.md", sourced_from: "/root/arifOS/arifosmcp/runtime/authority.py", expires_on: "2099-12-31T23:59:59Z", scope: "F1-F13 verdict + VAULT999 seal" },
  { actor: "A-FORGE", role: "execution organ", authority_ceiling: "777_FORGE", owner: "A-FORGE/AGENTS.md", sourced_from: "/root/A-FORGE/src/domain/governance/actionClassifier.ts", expires_on: "2099-12-31T23:59:59Z", scope: "bounded execution after authority" },
  { actor: "AAA", role: "attention/routing", authority_ceiling: "OBSERVE_ONLY", owner: "AAA/AGENTS.md", sourced_from: "/root/AAA/instructions/human-attention-membrane.md", expires_on: "2099-12-31T23:59:59Z", scope: "prioritize + route, never judge/execute" },
];
