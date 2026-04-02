import type { AgentModeName } from "../types/agent.js";
import { redactForExternalMode } from "../engine/redact.js";

export type ModeSettings = {
  name: AgentModeName;
  allowDangerousTools: boolean;
  allowExperimentalTools: boolean;
  filterAllowedTools(tools: string[]): string[];
  transformOutgoingText(input: string): string;
  transformIncomingText(input: string): string;
};

const externalModeDeniedTools = new Set(["run_command"]);

export function buildModeSettings(modeName: AgentModeName): ModeSettings {
  if (modeName === "internal_mode") {
    return {
      name: modeName,
      allowDangerousTools: true,
      allowExperimentalTools: true,
      filterAllowedTools: (tools) => tools,
      transformOutgoingText: (input) => input,
      transformIncomingText: (input) => input,
    };
  }

  return {
    name: modeName,
    allowDangerousTools: false,
    allowExperimentalTools: false,
    filterAllowedTools: (tools) => tools.filter((tool) => !externalModeDeniedTools.has(tool)),
    transformOutgoingText: (input) => redactForExternalMode(input, modeName),
    transformIncomingText: (input) => redactForExternalMode(input, modeName),
  };
}
