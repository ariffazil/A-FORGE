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
