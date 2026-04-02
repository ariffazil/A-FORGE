import type { AgentMessage } from "../types/agent.js";
export declare class ShortTermMemory {
    private readonly transcript;
    append(message: AgentMessage): void;
    appendMany(messages: AgentMessage[]): void;
    getMessages(): AgentMessage[];
    clear(): void;
}
