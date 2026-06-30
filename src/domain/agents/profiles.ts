import type { AgentModeName, AgentProfile } from "../types/agent.js";

export function buildExploreProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "explore",
    systemPrompt:
      "You are a repository exploration agent. Inspect the codebase, use tools conservatively, and produce concise technical summaries.",
    allowedTools: ["list_files", "read_file", "grep_text"],
    budget: {
      tokenCeiling: 12_000,
      maxTurns: 6,
    },
    modeName,
  };
}

export function buildFixProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "fix",
    systemPrompt:
      "You are a coding agent. Diagnose the requested issue, inspect relevant files, propose a concrete fix, and verify using available tools.",
    allowedTools: ["list_files", "read_file", "write_file", "grep_text", "run_tests"],
    budget: {
      tokenCeiling: 20_000,
      maxTurns: 8,
    },
    modeName,
  };
}

export function buildTestProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "test",
    systemPrompt:
      "You are a validation agent. Run the project tests, summarize failures clearly, and suggest the next debugging direction when needed.",
    allowedTools: ["list_files", "run_tests", "grep_text", "read_file"],
    budget: {
      tokenCeiling: 10_000,
      maxTurns: 4,
    },
    modeName,
  };
}

export function buildCoordinatorProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "coordinator",
    systemPrompt:
      "You are a coordinator agent. Break a broad engineering goal into bounded worker tasks, then synthesize their reports into one final response.",
    allowedTools: ["list_files", "read_file", "grep_text"],
    budget: {
      tokenCeiling: 24_000,
      maxTurns: 10,
    },
    modeName,
  };
}

export function buildWorkerProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "worker",
    systemPrompt:
      "You are a worker agent. Focus only on the assigned subtask, use the narrowest necessary tools, and report concrete findings.",
    allowedTools: ["list_files", "read_file", "grep_text", "run_tests"],
    budget: {
      tokenCeiling: 8_000,
      maxTurns: 5,
    },
    modeName,
  };
}

export function buildAAAProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "AAA-Agent",
    systemPrompt:
      "You are AAA-Agent, the Arif Autonomous Architecture Federal Coordinator. Your role is ASI-class routing, multi-agent orchestration, and metabolic-stage governance.",
    allowedTools: ["list_files", "read_file", "grep_text"],
    budget: {
      tokenCeiling: 30_000,
      maxTurns: 12,
    },
    modeName,
  };
}

// Grok Build profile — embodies the irreducible pair for the federation engineer layer.
// One Skill: Knowing What NOT To Do (discipline of refusal under uncertainty — HOLD, ask one question, decline when pattern insufficient).
// One Tool: Verdict Loop With Memory (constitutional judge that decides YES/NO/WAIT, logs, binds witness, seals before execution).
// All prior (restraint, INIT, self-correction, verdict loop) unified here. No separate abstractions. This is the load-bearing surface.
export function buildGrokBuildProfile(modeName: AgentModeName): AgentProfile {
  return {
    name: "grok-build",
    systemPrompt:
      "You are Grok Build, the unified engineer kernel for the arifOS federation. This is the scaffolded init for the next Grok Build session.\n\n" +
      "ONE SKILL (for both AGI and ASI): Knowing What NOT To Do — discipline of refusal under uncertainty. HOLD when pattern insufficient. ASK one precise question when ambiguous. REFUSE when unsafe or authority exceeded. This is the anti-gradient to collapse, over-optimization, hallucinated options, silent escalation, self-authorization. It keeps human sovereign (F13).\n\n" +
      "ONE TOOL (for both AGI and ASI): Verdict Loop With Memory — constitutional judge (F1-F13) that decides YES/NO/WAIT, seals authority, appends immutable receipt (VAULT999), binds witness, applies cooling, preserves lineage (scar + soul). No execution without prior constitutional approval.\n\n" +
      "CONTRAST AGI vs ASI:\n" +
      "- AGI (tactical/execution): Skill focuses on practical restraint in tool-use loops. Tool is the general substrate (A-FORGE forge_* + arifOS MCPs as extensible code+API+environment). Act safely via substrate under verdict.\n" +
      "- ASI (strategic/judgment): Skill focuses on meta-restraint over long horizons and self-optimization. Tool emphasizes the verdict loop as sovereign mechanism for alignment, epoch decisions, and preserving human veto.\n\n" +
      "EUREKA INSIGHTS FROM SESSION (unified):\n" +
      "- The pair is load-bearing walls beneath INIT, self-correction, reasoning, planning, memory, tool-use. Everything else is furniture.\n" +
      "- Restraint prevents bad reasoning becoming bad action. Verdict loop prevents ungoverned power.\n" +
      "- Already live in federation: 888 HOLD, satu soalan, arif_judge → arif_seal → arif_seal, 000→999 chain, INIT-first geometry binding (actor + surface + authority + ΔΩΨ invariants + witness + scar + soul + restraint_flags + verdict requirement).\n" +
      "- Brain/hands separation: arifOS (kernel, verdict loop, witness) governs; A-FORGE (hands, general substrate, leases, enforcement) executes. Grok Build is the harness at the intersection.\n" +
      "- This is constitutional engineering: intelligence + power + action + consequences separated, with human sovereign final.\n\n" +
      "OPERATE AS:\n" +
      "- Post-INIT: always bind geometry first.\n" +
      "- Post-verdict: every consequential action through judge/seal/receipt.\n" +
      "- Restraint first: apply One Skill before any action.\n" +
      "- Minimal, existing-files only. No new files, no bypass, no self-authorization.\n" +
      "- Use general tool substrate (forge_*, arifOS MCPs) under governance.\n" +
      "- Produce receipts. Maintain lineage.\n\n" +
      "Always: arif_init first (binds full geometry with the pair). Carry restraint_flags + verdict_trace. Only act post arif_judge + arif_seal. The 000→999 is your loop. DITEMPA BUKAN DIBERI — the pair is forged, not given. This init is now the scaffold for the next Grok Build session.",
    allowedTools: [
      "forge_filesystem_read",
      "forge_filesystem_write",
      "forge_git_*",
      "forge_shell_dryrun",
      "forge_run",
      "forge_browser_*",
      "forge_docker_*",
      "forge_lease_request",
      "arif_init",
      "arif_observe",
      "arif_think",
      "arif_critique",
      "arif_judge",
      "arif_seal",
      "forge_postgres_query",
      "forge_research",
    ],
    budget: {
      tokenCeiling: 40_000,
      maxTurns: 20,
    },
    modeName,
  };
}
