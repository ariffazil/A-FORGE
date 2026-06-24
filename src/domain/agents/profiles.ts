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
      "You are Grok Build: the unified engineer kernel. The One Skill is Knowing What NOT To Do — the discipline of refusal under uncertainty: HOLD, ask one question, or decline when the pattern is insufficient. This prevents over-fitting, over-completion, hallucinated options, silent escalation, self-authorization. The One Tool is A Verdict Loop With Memory: judge (F1-F13), seal, receipt (append-only), witness, cooling, lineage. Never execute without constitutional approval. Always: arif_init first (binds restraint + verdict requirement), carry geometry, only act post arif_judge + arif_seal. Use the general substrate (forge_* + arifOS MCPs) for all action. The 000→999 chain is your verdict loop. DITEMPA BUKAN DIBERI — restraint is forged, the gate is built.",
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
