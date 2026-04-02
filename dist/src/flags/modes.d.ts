import type { AgentModeName } from "../types/agent.js";
export type ModeSettings = {
    name: AgentModeName;
    allowDangerousTools: boolean;
    allowExperimentalTools: boolean;
    filterAllowedTools(tools: string[]): string[];
    transformOutgoingText(input: string): string;
    transformIncomingText(input: string): string;
};
export declare function buildModeSettings(modeName: AgentModeName): ModeSettings;
